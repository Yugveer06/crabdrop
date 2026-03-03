import type { CompressionSettings, FileMediaType } from "../types";
import {
	VIDEO_PRESETS,
	VIDEO_CODECS,
	AUDIO_CODECS,
	AUDIO_BITRATES,
} from "../lib/constants";

interface FileSettingsProps {
	fileName: string;
	mediaType: FileMediaType;
	settings: CompressionSettings;
	onChange: (settings: CompressionSettings) => void;
}

function mediaTypeLabel(t: FileMediaType): string {
	switch (t) {
		case "jpeg":
			return "JPEG Image";
		case "png":
			return "PNG Image";
		case "gif":
			return "GIF Image";
		case "webp":
			return "WebP Image";
		case "svg":
			return "SVG Image";
		case "avif":
			return "AVIF Image";
		case "bmp":
			return "BMP Image";
		case "tiff":
			return "TIFF Image";
		case "video":
			return "Video";
		case "audio":
			return "Audio";
		case "unknown":
			return "File";
	}
}

export function FileSettings({
	fileName,
	mediaType,
	settings,
	onChange,
}: FileSettingsProps) {
	const set = <K extends keyof CompressionSettings>(
		k: K,
		v: CompressionSettings[K],
	) => onChange({ ...settings, [k]: v });

	const hasCompressibleSettings =
		mediaType === "jpeg" ||
		mediaType === "png" ||
		mediaType === "webp" ||
		mediaType === "video" ||
		mediaType === "audio";

	return (
		<div>
			<p>
				{fileName} <small>({mediaTypeLabel(mediaType)})</small>
			</p>

			<label>
				<input
					type='checkbox'
					checked={settings.compress}
					onChange={e => set("compress", e.target.checked)}
				/>{" "}
				Enable compression
			</label>

			{settings.compress && hasCompressibleSettings && (
				<div>
					{mediaType === "jpeg" && (
						<div>
							<label>
								JPEG quality (qscale): {settings.jpeg_quality}
								<input
									type='range'
									min={1}
									max={31}
									value={settings.jpeg_quality}
									onChange={e =>
										set(
											"jpeg_quality",
											Number(e.target.value),
										)
									}
								/>
							</label>
						</div>
					)}

					{mediaType === "png" && (
						<div>
							<label>
								PNG compression level: {settings.png_level}
								<input
									type='range'
									min={0}
									max={9}
									value={settings.png_level}
									onChange={e =>
										set("png_level", Number(e.target.value))
									}
								/>
							</label>
						</div>
					)}

					{mediaType === "webp" && (
						<div>
							<label>
								WebP quality: {settings.webp_quality}%
								<input
									type='range'
									min={1}
									max={100}
									value={settings.webp_quality}
									onChange={e =>
										set(
											"webp_quality",
											Number(e.target.value),
										)
									}
								/>
							</label>
						</div>
					)}

					{mediaType === "video" && (
						<>
							<div>
								<label>
									CRF (quality): {settings.video_crf}
									<input
										type='range'
										min={0}
										max={51}
										value={settings.video_crf}
										onChange={e =>
											set(
												"video_crf",
												Number(e.target.value),
											)
										}
									/>
								</label>
							</div>
							<div>
								<label>Codec: </label>
								<select
									value={settings.video_codec}
									onChange={e =>
										set("video_codec", e.target.value)
									}
								>
									{VIDEO_CODECS.map(c => (
										<option key={c} value={c}>
											{c}
										</option>
									))}
								</select>
							</div>
							<div>
								<label>Preset: </label>
								<select
									value={settings.video_preset}
									onChange={e =>
										set("video_preset", e.target.value)
									}
								>
									{VIDEO_PRESETS.map(p => (
										<option key={p} value={p}>
											{p}
										</option>
									))}
								</select>
							</div>
						</>
					)}

					{mediaType === "audio" && (
						<>
							<div>
								<label>Codec: </label>
								<select
									value={settings.audio_codec}
									onChange={e =>
										set("audio_codec", e.target.value)
									}
								>
									{AUDIO_CODECS.map(c => (
										<option key={c} value={c}>
											{c}
										</option>
									))}
								</select>
							</div>
							<div>
								<label>Bitrate: </label>
								<select
									value={String(settings.audio_bitrate)}
									onChange={e =>
										set(
											"audio_bitrate",
											Number(e.target.value),
										)
									}
								>
									{AUDIO_BITRATES.map(b => (
										<option key={b} value={String(b)}>
											{b} kbps
										</option>
									))}
								</select>
							</div>
						</>
					)}
				</div>
			)}

			{settings.compress && !hasCompressibleSettings && (
				<p>
					<small>
						No configurable compression settings for{" "}
						{mediaTypeLabel(mediaType)} files — the server will
						apply sensible defaults.
					</small>
				</p>
			)}
		</div>
	);
}
