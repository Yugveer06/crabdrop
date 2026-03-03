import type { CompressionSettings } from "../types";
import {
	VIDEO_PRESETS,
	VIDEO_CODECS,
	AUDIO_CODECS,
	AUDIO_BITRATES,
} from "../lib/constants";

interface SettingsPanelProps {
	settings: CompressionSettings;
	setSettings: React.Dispatch<React.SetStateAction<CompressionSettings>>;
	settingsOpen: boolean;
	setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function SettingsPanel({
	settings,
	setSettings,
	settingsOpen,
	setSettingsOpen,
}: SettingsPanelProps) {
	const set = <K extends keyof CompressionSettings>(
		k: K,
		v: CompressionSettings[K],
	) => setSettings(s => ({ ...s, [k]: v }));

	return (
		<div>
			<button onClick={() => setSettingsOpen(o => !o)}>
				⚙️ Compression Settings (
				{settings.compress ? "enabled" : "disabled"}){" "}
				{settingsOpen ? "▲" : "▼"}
			</button>

			{settingsOpen && (
				<div>
					<label>
						<input
							type='checkbox'
							checked={settings.compress}
							onChange={e => set("compress", e.target.checked)}
						/>{" "}
						Enable compression
					</label>

					{settings.compress && (
						<div>
							<p>Images</p>
							<div>
								<label>
									JPEG quality (qscale):{" "}
									{settings.jpeg_quality}
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
							<div>
								<label>
									PNG compression: {settings.png_level}
									<input
										type='range'
										min={0}
										max={9}
										value={settings.png_level}
										onChange={e =>
											set(
												"png_level",
												Number(e.target.value),
											)
										}
									/>
								</label>
							</div>
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

							<p>Video</p>
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

							<p>Audio</p>
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
						</div>
					)}
				</div>
			)}
		</div>
	);
}
