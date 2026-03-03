use ffmpeg_next as ffmpeg;
use ffmpeg_next::{
    codec, decoder, encoder, format, frame, media, Dictionary, Packet, Rational,
};
use serde::Deserialize;
use std::io::Read;
use tempfile::NamedTempFile;
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// Progress events emitted during compression and upload stages.
#[derive(Debug, Clone)]
pub struct ProgressEvent {
    pub stage: String,   // "compressing" | "uploading" | "done"
    pub percent: u8,
}

/// Query-parameter driven compression settings for a single upload.
#[derive(Deserialize, Clone, Debug, Default)]
pub struct CompressionParams {
    /// Master switch — set to false to skip compression entirely (default: true)
    pub compress: Option<bool>,

    // ---------- Image ----------
    /// JPEG quality: ffmpeg qscale:v 1 (best) – 31 (worst), default 5
    pub jpeg_quality: Option<u8>,
    /// PNG compression level 0–9, default 6
    pub png_level: Option<u8>,
    /// WebP quality 1.0–100.0, default 80.0
    pub webp_quality: Option<f32>,

    // ---------- Video ----------
    /// H.264 / H.265 CRF 0–51, default 23
    pub video_crf: Option<u8>,
    /// Video encoder name, default "libx264"
    pub video_codec: Option<String>,
    /// Video preset (ultrafast … placebo), default "medium"
    pub video_preset: Option<String>,

    // ---------- Audio ----------
    /// Target audio bitrate in kbps, default 128
    pub audio_bitrate: Option<u32>,
    /// Audio encoder name, default "aac"
    pub audio_codec: Option<String>,
}

impl CompressionParams {
    pub fn is_enabled(&self) -> bool {
        self.compress.unwrap_or(true)
    }
}

/// Classify a content-type string into one of three media categories.
enum MediaKind {
    Image,
    Video,
    Audio,
}

fn classify(content_type: &str) -> Option<MediaKind> {
    if content_type.starts_with("image/") {
        Some(MediaKind::Image)
    } else if content_type.starts_with("video/") {
        Some(MediaKind::Video)
    } else if content_type.starts_with("audio/") {
        Some(MediaKind::Audio)
    } else {
        None
    }
}

/// Write bytes to a NamedTempFile and return it (kept open so the path stays valid on all OSes).
fn bytes_to_tempfile(bytes: &[u8], suffix: &str) -> Result<NamedTempFile, String> {
    use std::io::Write;
    let mut f = tempfile::Builder::new()
        .suffix(suffix)
        .tempfile()
        .map_err(|e| format!("tempfile create: {e}"))?;
    f.write_all(bytes)
        .map_err(|e| format!("tempfile write: {e}"))?;
    Ok(f)
}

/// Read all bytes from a NamedTempFile.
fn tempfile_to_bytes(f: &mut NamedTempFile) -> Result<Vec<u8>, String> {
    // Seek back to start — ffmpeg may have moved the file pointer.
    use std::io::Seek;
    f.seek(std::io::SeekFrom::Start(0))
        .map_err(|e| format!("seek: {e}"))?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf)
        .map_err(|e| format!("read: {e}"))?;
    Ok(buf)
}

/// Compress `bytes` according to `params`.
///
/// Returns `(compressed_bytes, effective_content_type)`.
/// Optionally sends progress events via `progress_tx` if provided.
///
/// **Must be called on a blocking thread** (use `tokio::task::spawn_blocking`).
pub fn compress(
    bytes: Vec<u8>,
    content_type: &str,
    params: &CompressionParams,
    progress_tx: Option<mpsc::Sender<ProgressEvent>>,
) -> Result<(Vec<u8>, String), String> {
    if !params.is_enabled() {
        return Ok((bytes, content_type.to_string()));
    }

    ffmpeg::init().map_err(|e| format!("ffmpeg init: {e}"))?;

    let kind = match classify(content_type) {
        Some(k) => k,
        None => return Ok((bytes, content_type.to_string())),
    };

    let send_progress = move |stage: &str, percent: u8| {
        if let Some(tx) = &progress_tx {
            let _ = tx.blocking_send(ProgressEvent {
                stage: stage.to_string(),
                percent,
            });
        }
    };

    let result = match kind {
        MediaKind::Image => {
            info!(content_type, "Compressing image");
            compress_image(&bytes, content_type, params, &send_progress)
        }
        MediaKind::Video => {
            info!(content_type, "Compressing video");
            compress_video(&bytes, content_type, params, &send_progress)
        }
        MediaKind::Audio => {
            info!(content_type, "Compressing audio");
            compress_audio(&bytes, content_type, params, &send_progress)
        }
    };

    match &result {
        Ok((out, ct)) => info!(
            input_size = bytes.len(),
            output_size = out.len(),
            output_content_type = %ct,
            "Compression finished"
        ),
        Err(e) => warn!("Compression error: {}", e),
    }

    send_progress("done", 100);
    result
}

// ---------------------------------------------------------------------------
// Image compression via ffmpeg-next
// ---------------------------------------------------------------------------

fn image_encoder_config(content_type: &str, params: &CompressionParams) -> (&'static str, String, Dictionary<'static>) {
    let mut opts = Dictionary::new();
    match content_type {
        "image/jpeg" => {
            let q = params.jpeg_quality.unwrap_or(5).clamp(1, 31);
            opts.set("qscale:v", &q.to_string());
            ("mjpeg", "image/jpeg".to_string(), opts)
        }
        "image/webp" => {
            let q = params.webp_quality.unwrap_or(80.0).clamp(1.0, 100.0);
            opts.set("quality", &(q as u32).to_string());
            ("libwebp", "image/webp".to_string(), opts)
        }
        // PNG is lossless — re-encoding PNG→PNG through ffmpeg cannot reduce
        // size and often *increases* it (RGBA expansion, different zlib params).
        // Instead, convert to lossy WebP which can dramatically shrink the file.
        "image/png" => {
            let q = params.webp_quality.unwrap_or(80.0).clamp(1.0, 100.0);
            opts.set("quality", &(q as u32).to_string());
            ("libwebp", "image/webp".to_string(), opts)
        }
        // Everything else also falls through to WebP for best compression
        _ => {
            let q = params.webp_quality.unwrap_or(80.0).clamp(1.0, 100.0);
            opts.set("quality", &(q as u32).to_string());
            ("libwebp", "image/webp".to_string(), opts)
        }
    }
}

fn compress_image(
    bytes: &[u8],
    content_type: &str,
    params: &CompressionParams,
    send_progress: &impl Fn(&str, u8),
) -> Result<(Vec<u8>, String), String> {
    send_progress("compressing", 0);

    // Determine input suffix for ffmpeg format detection
    let input_suffix = format!(".{}", extension_for_mime(content_type));
    let (encoder_name, out_content_type, enc_opts) = image_encoder_config(content_type, params);

    let input_tmp = bytes_to_tempfile(bytes, &input_suffix)?;

    send_progress("compressing", 10);

    // Open input
    let mut ictx = format::input(&input_tmp.path())
        .map_err(|e| format!("ffmpeg open input: {e}"))?;

    let input_stream = ictx
        .streams()
        .best(media::Type::Video)
        .ok_or("no video/image stream in input")?;

    let stream_idx = input_stream.index();

    let mut dec_ctx = codec::Context::from_parameters(input_stream.parameters())
        .map_err(|e| format!("dec context: {e}"))?;
    let mut decoder = dec_ctx
        .decoder()
        .video()
        .map_err(|e| format!("decoder: {e}"))?;

    send_progress("compressing", 30);

    // Decode first frame — send all packets, then EOF, then drain
    let mut decoded = frame::Video::empty();
    let mut got_frame = false;

    for (stream, packet) in ictx.packets() {
        if stream.index() == stream_idx {
            decoder
                .send_packet(&packet)
                .map_err(|e| format!("send packet: {e}"))?;
            if decoder.receive_frame(&mut decoded).is_ok() {
                got_frame = true;
                break;
            }
        }
    }

    if !got_frame {
        decoder.send_eof().ok();
        if decoder.receive_frame(&mut decoded).is_ok() {
            got_frame = true;
        }
    }

    // If decoding failed, skip compression and return the original bytes
    if !got_frame || decoded.width() == 0 || decoded.height() == 0 {
        warn!("Failed to decode image frame, skipping compression");
        return Ok((bytes.to_vec(), content_type.to_string()));
    }

    debug!(
        width = decoded.width(),
        height = decoded.height(),
        format = ?decoded.format(),
        "Decoded image frame"
    );

    send_progress("compressing", 60);

    // Pick a pixel format the encoder supports
    let target_format = match encoder_name {
        "mjpeg" => format::Pixel::YUVJ420P,
        "libwebp" => format::Pixel::YUV420P,
        "png" => format::Pixel::RGBA,
        _ => format::Pixel::RGB24,
    };

    // Convert frame to the target pixel format using the software scaler
    let converted = if decoded.format() != target_format {
        debug!(
            from = ?decoded.format(),
            to = ?target_format,
            "Converting pixel format"
        );
        let mut scaler = ffmpeg::software::scaling::Context::get(
            decoded.format(),
            decoded.width(),
            decoded.height(),
            target_format,
            decoded.width(),
            decoded.height(),
            ffmpeg::software::scaling::Flags::BILINEAR,
        )
        .map_err(|e| format!("scaler init: {e}"))?;

        let mut converted_frame = frame::Video::empty();
        scaler
            .run(&decoded, &mut converted_frame)
            .map_err(|e| format!("scale: {e}"))?;
        converted_frame.set_pts(decoded.pts());
        converted_frame
    } else {
        decoded
    };

    // Encode the frame
    let enc = encoder::find_by_name(encoder_name)
        .ok_or_else(|| format!("encoder '{}' not found", encoder_name))?;

    let mut enc_ctx = codec::Context::new_with_codec(enc);
    let mut video_enc = enc_ctx
        .encoder()
        .video()
        .map_err(|e| format!("enc video: {e}"))?;

    video_enc.set_width(converted.width());
    video_enc.set_height(converted.height());
    video_enc.set_format(target_format);
    video_enc.set_time_base(Rational::new(1, 1));

    let mut encoder = video_enc
        .open_with(enc_opts)
        .map_err(|e| format!("open encoder: {e}"))?;

    encoder
        .send_frame(&converted)
        .map_err(|e| format!("send frame: {e}"))?;
    encoder.send_eof().map_err(|e| format!("eof: {e}"))?;

    // For WebP: the encoded packet data IS a complete WebP file, so we grab
    // it directly instead of going through ffmpeg's problematic WebP muxer.
    // For other formats (JPEG, etc.) we also just use raw packet data — for
    // single-image codecs the packet is a self-contained file.
    let mut out_bytes: Vec<u8> = Vec::new();
    let mut encoded = Packet::empty();
    while encoder.receive_packet(&mut encoded).is_ok() {
        if let Some(data) = encoded.data() {
            out_bytes.extend_from_slice(data);
        }
    }

    if out_bytes.is_empty() {
        warn!("Encoder produced no output packets, returning original");
        return Ok((bytes.to_vec(), content_type.to_string()));
    }

    send_progress("compressing", 90);

    // Safety net: if "compressed" output is larger than the original, skip it.
    if out_bytes.len() >= bytes.len() {
        warn!(
            original_size = bytes.len(),
            compressed_size = out_bytes.len(),
            "Compressed image is larger than original, returning original"
        );
        return Ok((bytes.to_vec(), content_type.to_string()));
    }

    send_progress("compressing", 100);

    Ok((out_bytes, out_content_type))
}

// ---------------------------------------------------------------------------
// Video compression
// ---------------------------------------------------------------------------

fn compress_video(
    bytes: &[u8],
    content_type: &str,
    params: &CompressionParams,
    send_progress: &impl Fn(&str, u8),
) -> Result<(Vec<u8>, String), String> {
    send_progress("compressing", 0);

    let codec_name = params.video_codec.as_deref().unwrap_or("libx264");
    let preset = params.video_preset.as_deref().unwrap_or("medium");
    let crf = params.video_crf.unwrap_or(23).clamp(0, 51);

    let input_suffix = format!(".{}", extension_for_mime(content_type));
    let input_tmp = bytes_to_tempfile(bytes, &input_suffix)?;
    let mut output_tmp = tempfile::Builder::new()
        .suffix(".mp4")
        .tempfile()
        .map_err(|e| format!("output tempfile: {e}"))?;

    let mut ictx = format::input(&input_tmp.path())
        .map_err(|e| format!("ffmpeg open input: {e}"))?;

    // Find best video and audio streams
    let video_stream_idx = ictx
        .streams()
        .best(media::Type::Video)
        .map(|s| s.index());
    let audio_stream_idx = ictx
        .streams()
        .best(media::Type::Audio)
        .map(|s| s.index());

    let video_stream_idx = video_stream_idx.ok_or("no video stream")?;

    // Set up decoder for video
    let video_params = ictx.stream(video_stream_idx).unwrap().parameters();
    let mut vid_dec_ctx =
        codec::Context::from_parameters(video_params).map_err(|e| format!("vid dec ctx: {e}"))?;
    let mut video_decoder = vid_dec_ctx
        .decoder()
        .video()
        .map_err(|e| format!("vid decoder: {e}"))?;

    // Set up decoder for audio if present
    let audio_decoder_opt = if let Some(aidx) = audio_stream_idx {
        let audio_params = ictx.stream(aidx).unwrap().parameters();
        let mut aud_dec_ctx = codec::Context::from_parameters(audio_params)
            .map_err(|e| format!("aud dec ctx: {e}"))?;
        Some(
            aud_dec_ctx
                .decoder()
                .audio()
                .map_err(|e| format!("aud decoder: {e}"))?,
        )
    } else {
        None
    };

    send_progress("compressing", 10);

    // Open output context
    let mut octx = format::output(&output_tmp.path())
        .map_err(|e| format!("output ctx: {e}"))?;

    // Set up video encoder
    let video_enc_codec = encoder::find_by_name(codec_name)
        .ok_or_else(|| format!("video encoder '{}' not found", codec_name))?;

    let mut vid_enc_ctx = codec::Context::new_with_codec(video_enc_codec);
    let mut vid_enc = vid_enc_ctx
        .encoder()
        .video()
        .map_err(|e| format!("vid enc: {e}"))?;

    let in_time_base = ictx.stream(video_stream_idx).unwrap().time_base();
    vid_enc.set_width(video_decoder.width());
    vid_enc.set_height(video_decoder.height());
    vid_enc.set_format(video_decoder.format());
    vid_enc.set_time_base(in_time_base);
    vid_enc.set_frame_rate(Some(ictx.stream(video_stream_idx).unwrap().avg_frame_rate()));

    let mut vid_enc_opts = Dictionary::new();
    vid_enc_opts.set("crf", &crf.to_string());
    vid_enc_opts.set("preset", preset);

    let mut out_video_stream = octx
        .add_stream(video_enc_codec)
        .map_err(|e| format!("add video stream: {e}"))?;
    out_video_stream.set_time_base(in_time_base);
    let out_video_idx = out_video_stream.index();

    let mut video_encoder = vid_enc
        .open_with(vid_enc_opts)
        .map_err(|e| format!("open vid encoder: {e}"))?;

    // Set up audio encoder if we have audio
    let (mut audio_encoder_opt, out_audio_idx_opt) = if let Some(mut aud_dec) = audio_decoder_opt {
        let audio_codec_name = params.audio_codec.as_deref().unwrap_or("aac");
        let aud_enc_codec = encoder::find_by_name(audio_codec_name)
            .ok_or_else(|| format!("audio encoder '{}' not found", audio_codec_name))?;

        let mut aud_enc_ctx = codec::Context::new_with_codec(aud_enc_codec);
        let mut aud_enc = aud_enc_ctx
            .encoder()
            .audio()
            .map_err(|e| format!("aud enc: {e}"))?;

        let bitrate_bps = (params.audio_bitrate.unwrap_or(128) as i64) * 1000;
        aud_enc.set_bit_rate(bitrate_bps as usize);
        aud_enc.set_rate(aud_dec.rate() as i32);
        aud_enc.set_channel_layout(aud_dec.channel_layout());
        aud_enc.set_format(
            aud_enc_codec
                .audio()
                .map_err(|e| format!("codec audio: {e}"))?
                .formats()
                .expect("no formats")
                .next()
                .ok_or("no audio format")?,
        );
        aud_enc.set_time_base(Rational::new(1, aud_dec.rate() as i32));

        let mut out_audio_stream = octx
            .add_stream(aud_enc_codec)
            .map_err(|e| format!("add audio stream: {e}"))?;
        let out_audio_idx = out_audio_stream.index();
        out_audio_stream.set_time_base(Rational::new(1, aud_dec.rate() as i32));

        let audio_encoder = aud_enc
            .open_as(aud_enc_codec)
            .map_err(|e| format!("open aud encoder: {e}"))?;

        (Some((audio_encoder, aud_dec)), Some(out_audio_idx))
    } else {
        (None, None)
    };

    octx.write_header().map_err(|e| format!("write header: {e}"))?;

    send_progress("compressing", 20);

    // Process packets
    let packets: Vec<_> = ictx.packets().collect();
    let total = packets.len().max(1);

    for (idx, (stream, packet)) in packets.into_iter().enumerate() {
        let percent = 20 + ((idx as f64 / total as f64) * 70.0) as u8;
        if idx % (total / 20).max(1) == 0 {
            send_progress("compressing", percent);
        }

        if stream.index() == video_stream_idx {
            let mut decoded = frame::Video::empty();
            video_decoder
                .send_packet(&packet)
                .map_err(|e| format!("vid send pkt: {e}"))?;

            while video_decoder.receive_frame(&mut decoded).is_ok() {
                let mut encoded = Packet::empty();
                video_encoder
                    .send_frame(&decoded)
                    .map_err(|e| format!("vid send frame: {e}"))?;

                while video_encoder.receive_packet(&mut encoded).is_ok() {
                    encoded.set_stream(out_video_idx);
                    encoded
                        .write_interleaved(&mut octx)
                        .map_err(|e| format!("vid write pkt: {e}"))?;
                }
            }
        } else if let Some(aidx) = audio_stream_idx {
            if stream.index() == aidx {
                if let Some((ref mut aud_enc, ref mut aud_dec)) = audio_encoder_opt {
                    let mut decoded = frame::Audio::empty();
                    aud_dec
                        .send_packet(&packet)
                        .map_err(|e| format!("aud send pkt: {e}"))?;

                    while aud_dec.receive_frame(&mut decoded).is_ok() {
                        let mut encoded = Packet::empty();
                        aud_enc
                            .send_frame(&decoded)
                            .map_err(|e| format!("aud send frame: {e}"))?;

                        while aud_enc.receive_packet(&mut encoded).is_ok() {
                            if let Some(out_aidx) = out_audio_idx_opt {
                                encoded.set_stream(out_aidx);
                                encoded
                                    .write_interleaved(&mut octx)
                                    .map_err(|e| format!("aud write pkt: {e}"))?;
                            }
                        }
                    }
                }
            }
        }
    }

    // Flush encoders
    video_decoder.send_eof().ok();
    {
        let mut decoded = frame::Video::empty();
        while video_decoder.receive_frame(&mut decoded).is_ok() {
            let mut encoded = Packet::empty();
            video_encoder.send_frame(&decoded).ok();
            while video_encoder.receive_packet(&mut encoded).is_ok() {
                encoded.set_stream(out_video_idx);
                encoded.write_interleaved(&mut octx).ok();
            }
        }
    }
    video_encoder.send_eof().ok();
    {
        let mut encoded = Packet::empty();
        while video_encoder.receive_packet(&mut encoded).is_ok() {
            encoded.set_stream(out_video_idx);
            encoded.write_interleaved(&mut octx).ok();
        }
    }

    if let Some((ref mut aud_enc, ref mut aud_dec)) = audio_encoder_opt {
        aud_dec.send_eof().ok();
        let mut decoded = frame::Audio::empty();
        while aud_dec.receive_frame(&mut decoded).is_ok() {
            aud_enc.send_frame(&decoded).ok();
            let mut encoded = Packet::empty();
            while aud_enc.receive_packet(&mut encoded).is_ok() {
                if let Some(out_aidx) = out_audio_idx_opt {
                    encoded.set_stream(out_aidx);
                    encoded.write_interleaved(&mut octx).ok();
                }
            }
        }
        aud_enc.send_eof().ok();
        let mut encoded = Packet::empty();
        while aud_enc.receive_packet(&mut encoded).is_ok() {
            if let Some(out_aidx) = out_audio_idx_opt {
                encoded.set_stream(out_aidx);
                encoded.write_interleaved(&mut octx).ok();
            }
        }
    }

    octx.write_trailer().map_err(|e| format!("write trailer: {e}"))?;
    drop(octx);

    send_progress("compressing", 90);

    let out_bytes = tempfile_to_bytes(&mut output_tmp)?;
    send_progress("compressing", 100);

    Ok((out_bytes, "video/mp4".to_string()))
}

// ---------------------------------------------------------------------------
// Audio compression
// ---------------------------------------------------------------------------

fn compress_audio(
    bytes: &[u8],
    content_type: &str,
    params: &CompressionParams,
    send_progress: &impl Fn(&str, u8),
) -> Result<(Vec<u8>, String), String> {
    send_progress("compressing", 0);

    let codec_name = params.audio_codec.as_deref().unwrap_or("aac");
    let out_content_type = if codec_name == "libmp3lame" {
        "audio/mpeg"
    } else if codec_name == "libvorbis" {
        "audio/ogg"
    } else {
        "audio/aac"
    };

    let input_suffix = format!(".{}", extension_for_mime(content_type));
    let out_ext = format!(".{}", extension_for_mime(out_content_type));

    let input_tmp = bytes_to_tempfile(bytes, &input_suffix)?;
    let mut output_tmp = tempfile::Builder::new()
        .suffix(&out_ext)
        .tempfile()
        .map_err(|e| format!("output tempfile: {e}"))?;

    let mut ictx = format::input(&input_tmp.path())
        .map_err(|e| format!("ffmpeg open input: {e}"))?;

    let audio_stream = ictx
        .streams()
        .best(media::Type::Audio)
        .ok_or("no audio stream")?;
    let aidx = audio_stream.index();

    let mut dec_ctx = codec::Context::from_parameters(audio_stream.parameters())
        .map_err(|e| format!("dec ctx: {e}"))?;
    let mut decoder = dec_ctx
        .decoder()
        .audio()
        .map_err(|e| format!("decoder: {e}"))?;

    send_progress("compressing", 15);

    let aud_enc_codec = encoder::find_by_name(codec_name)
        .ok_or_else(|| format!("audio encoder '{}' not found", codec_name))?;

    let mut enc_ctx = codec::Context::new_with_codec(aud_enc_codec);
    let mut aud_enc = enc_ctx
        .encoder()
        .audio()
        .map_err(|e| format!("enc: {e}"))?;

    let bitrate_bps = (params.audio_bitrate.unwrap_or(128) as i64) * 1000;
    aud_enc.set_bit_rate(bitrate_bps as usize);
    aud_enc.set_rate(decoder.rate() as i32);
    aud_enc.set_channel_layout(decoder.channel_layout());
    aud_enc.set_format(
        aud_enc_codec
            .audio()
            .map_err(|e| format!("codec audio: {e}"))?
            .formats()
            .expect("no formats")
            .next()
            .ok_or("no audio format")?,
    );
    aud_enc.set_time_base(Rational::new(1, decoder.rate() as i32));

    let mut octx = format::output(&output_tmp.path())
        .map_err(|e| format!("output ctx: {e}"))?;

    let mut out_stream = octx
        .add_stream(aud_enc_codec)
        .map_err(|e| format!("add stream: {e}"))?;
    out_stream.set_time_base(Rational::new(1, decoder.rate() as i32));
    let out_stream_idx = out_stream.index();

    let mut encoder = aud_enc
        .open_as(aud_enc_codec)
        .map_err(|e| format!("open encoder: {e}"))?;

    octx.write_header().map_err(|e| format!("write header: {e}"))?;

    send_progress("compressing", 25);

    let packets: Vec<_> = ictx.packets().collect();
    let total = packets.len().max(1);

    for (idx, (stream, packet)) in packets.into_iter().enumerate() {
        if stream.index() != aidx {
            continue;
        }
        let percent = 25 + ((idx as f64 / total as f64) * 65.0) as u8;
        if idx % (total / 20).max(1) == 0 {
            send_progress("compressing", percent);
        }

        let mut decoded = frame::Audio::empty();
        decoder
            .send_packet(&packet)
            .map_err(|e| format!("send pkt: {e}"))?;

        while decoder.receive_frame(&mut decoded).is_ok() {
            encoder
                .send_frame(&decoded)
                .map_err(|e| format!("send frame: {e}"))?;

            let mut encoded = Packet::empty();
            while encoder.receive_packet(&mut encoded).is_ok() {
                encoded.set_stream(out_stream_idx);
                encoded
                    .write_interleaved(&mut octx)
                    .map_err(|e| format!("write pkt: {e}"))?;
            }
        }
    }

    // Flush
    decoder.send_eof().ok();
    let mut decoded = frame::Audio::empty();
    while decoder.receive_frame(&mut decoded).is_ok() {
        encoder.send_frame(&decoded).ok();
        let mut encoded = Packet::empty();
        while encoder.receive_packet(&mut encoded).is_ok() {
            encoded.set_stream(out_stream_idx);
            encoded.write_interleaved(&mut octx).ok();
        }
    }
    encoder.send_eof().ok();
    let mut encoded = Packet::empty();
    while encoder.receive_packet(&mut encoded).is_ok() {
        encoded.set_stream(out_stream_idx);
        encoded.write_interleaved(&mut octx).ok();
    }

    octx.write_trailer().map_err(|e| format!("write trailer: {e}"))?;
    drop(octx);

    send_progress("compressing", 90);

    let out_bytes = tempfile_to_bytes(&mut output_tmp)?;
    send_progress("compressing", 100);

    Ok((out_bytes, out_content_type.to_string()))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extension_for_mime(ct: &str) -> &str {
    match ct {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/avif" => "avif",
        "image/bmp" => "bmp",
        "image/tiff" => "tiff",
        "video/mp4" => "mp4",
        "video/webm" => "webm",
        "video/quicktime" => "mov",
        "audio/mpeg" => "mp3",
        "audio/ogg" => "ogg",
        "audio/wav" => "wav",
        "audio/flac" => "flac",
        "audio/aac" => "aac",
        "audio/webm" => "weba",
        _ => "bin",
    }
}
