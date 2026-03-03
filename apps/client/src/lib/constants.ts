import type { CompressionSettings } from "../types";

export const DEFAULT_SETTINGS: CompressionSettings = {
	compress: true,
	jpeg_quality: 5,
	png_level: 6,
	webp_quality: 80,
	video_crf: 23,
	video_codec: "libx264",
	video_preset: "medium",
	audio_bitrate: 128,
	audio_codec: "aac",
};

export const VIDEO_PRESETS = [
	"ultrafast",
	"superfast",
	"veryfast",
	"faster",
	"fast",
	"medium",
	"slow",
	"slower",
	"veryslow",
	"placebo",
];
export const VIDEO_CODECS = ["libx264", "libx265", "libvpx-vp9"];
export const AUDIO_CODECS = ["aac", "libmp3lame", "libvorbis", "libopus"];
export const AUDIO_BITRATES = [64, 96, 128, 192, 256, 320];
