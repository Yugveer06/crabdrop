import { useState, useRef } from "react";
import axios from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompressionSettings {
	compress: boolean;
	// Image
	jpeg_quality: number;
	png_level: number;
	webp_quality: number;
	// Video
	video_crf: number;
	video_codec: string;
	video_preset: string;
	// Audio
	audio_bitrate: number;
	audio_codec: string;
}

const DEFAULT_SETTINGS: CompressionSettings = {
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

interface FileProgress {
	name: string;
	originalSize: number;
	stage: "idle" | "sending" | "compressing" | "uploading" | "done" | "error";
	sendPercent: number;
	compressPercent: number;
	compressedSize?: number;
	url?: string;
	error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(b: number) {
	if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
	if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
	return `${b} B`;
}

function buildQueryString(settings: CompressionSettings): string {
	if (!settings.compress) return "compress=false";
	const p = new URLSearchParams({
		compress: "true",
		jpeg_quality: String(settings.jpeg_quality),
		png_level: String(settings.png_level),
		webp_quality: String(settings.webp_quality),
		video_crf: String(settings.video_crf),
		video_codec: settings.video_codec,
		video_preset: settings.video_preset,
		audio_bitrate: String(settings.audio_bitrate),
		audio_codec: settings.audio_codec,
	});
	return p.toString();
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
	const [settings, setSettings] =
		useState<CompressionSettings>(DEFAULT_SETTINGS);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [fileList, setFileList] = useState<File[]>([]);
	const [progress, setProgress] = useState<FileProgress[]>([]);
	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const set = <K extends keyof CompressionSettings>(
		k: K,
		v: CompressionSettings[K],
	) => setSettings(s => ({ ...s, [k]: v }));

	const updateProgress = (idx: number, patch: Partial<FileProgress>) =>
		setProgress(prev =>
			prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
		);

	const handleFiles = (files: FileList | null) => {
		if (!files) return;
		setFileList(Array.from(files));
		setProgress(
			Array.from(files).map(f => ({
				name: f.name,
				originalSize: f.size,
				stage: "idle",
				sendPercent: 0,
				compressPercent: 0,
			})),
		);
	};

	const handleUpload = async () => {
		if (!fileList.length) return;
		setUploading(true);

		for (let i = 0; i < fileList.length; i++) {
			const file = fileList[i];
			const jobId = crypto.randomUUID();
			const qs = buildQueryString(settings);

			updateProgress(i, { stage: "sending", sendPercent: 0 });

			const sse = new EventSource(`/api/progress?job_id=${jobId}`);
			sse.onmessage = e => {
				try {
					const data = JSON.parse(e.data) as {
						stage: string;
						percent: number;
					};
					if (data.stage === "compressing") {
						updateProgress(i, {
							stage: "compressing",
							compressPercent: data.percent,
						});
					} else if (data.stage === "uploading") {
						updateProgress(i, { stage: "uploading" });
					} else if (data.stage === "done") {
						sse.close();
					}
				} catch {
					/* ignore */
				}
			};
			sse.onerror = () => sse.close();

			const formData = new FormData();
			formData.append("file", file);

			try {
				const res = await axios.post(
					`/api/upload?job_id=${jobId}&${qs}`,
					formData,
					{
						onUploadProgress: evt => {
							const pct = evt.total
								? Math.round((evt.loaded / evt.total) * 100)
								: 0;
							updateProgress(i, { sendPercent: pct });
						},
					},
				);

				const data = res.data;
				const r2Filename = data.url.split("/").pop();
				const localUrl = `${window.location.origin}/f/${r2Filename}`;

				updateProgress(i, {
					stage: "done",
					compressedSize: data.compressed_size_bytes,
					url: localUrl,
				});
			} catch (err) {
				sse.close();
				let msg = "Upload failed";
				if (axios.isAxiosError(err)) {
					msg = err.response?.data?.error || err.message;
				}
				updateProgress(i, { stage: "error", error: msg });
			}
		}

		setUploading(false);
	};

	const VIDEO_PRESETS = [
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
	const VIDEO_CODECS = ["libx264", "libx265", "libvpx-vp9"];
	const AUDIO_CODECS = ["aac", "libmp3lame", "libvorbis", "libopus"];
	const AUDIO_BITRATES = [64, 96, 128, 192, 256, 320];

	return (
		<div>
			<h1>🦀 Crabdrop</h1>
			<p>Fast file sharing with built-in compression</p>

			{/* Compression Settings */}
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
								onChange={e =>
									set("compress", e.target.checked)
								}
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

			{/* Upload */}
			<div>
				<div
					onClick={() => fileInputRef.current?.click()}
					onDragOver={e => e.preventDefault()}
					onDrop={e => {
						e.preventDefault();
						handleFiles(e.dataTransfer.files);
					}}
				>
					<span>📁</span>
					<p>Drop files here or click to browse</p>
					<p>Images, video, and audio supported</p>
					<input
						ref={fileInputRef}
						type='file'
						multiple
						style={{ display: "none" }}
						onChange={e => handleFiles(e.target.files)}
					/>
				</div>

				{fileList.length > 0 && (
					<ul>
						{fileList.map((f, i) => (
							<li key={i}>
								{f.name} — {formatBytes(f.size)}
							</li>
						))}
					</ul>
				)}

				<button
					onClick={handleUpload}
					disabled={uploading || fileList.length === 0}
				>
					{uploading
						? "Uploading…"
						: `Upload ${fileList.length > 0 ? `${fileList.length} file${fileList.length > 1 ? "s" : ""}` : ""}`}
				</button>
			</div>

			{/* Progress + Results */}
			{progress.length > 0 && (
				<div>
					{progress.map((p, i) => (
						<div key={i}>
							<p>
								{p.name} — {p.stage}
							</p>

							{(p.stage === "sending" ||
								p.stage === "compressing" ||
								p.stage === "uploading" ||
								p.stage === "done") && (
								<div>
									<div>
										<label>📤 Sending to server: </label>
										<progress
											value={
												p.stage === "done" ||
												p.stage === "uploading" ||
												p.stage === "compressing"
													? 100
													: p.sendPercent
											}
											max={100}
										/>
									</div>
									{settings.compress && (
										<div>
											<label>⚙️ Compressing: </label>
											<progress
												value={
													p.stage === "done" ||
													p.stage === "uploading"
														? 100
														: p.compressPercent
												}
												max={100}
											/>
										</div>
									)}
									<div>
										<label>☁️ Uploading to R2: </label>
										<progress
											value={
												p.stage === "done"
													? 100
													: p.stage === "uploading"
														? 50
														: 0
											}
											max={100}
										/>
									</div>
								</div>
							)}

							{p.stage === "done" &&
								p.compressedSize !== undefined && (
									<div>
										<p>
											{formatBytes(p.originalSize)} →{" "}
											{formatBytes(p.compressedSize)}
											{p.compressedSize < p.originalSize
												? ` (-${Math.round((1 - p.compressedSize / p.originalSize) * 100)}% saved)`
												: " (already optimal)"}
										</p>
										{p.url && (
											<a
												href={p.url}
												target='_blank'
												rel='noreferrer'
											>
												{p.url}
											</a>
										)}
									</div>
								)}

							{p.stage === "error" && <p>Error: {p.error}</p>}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export default App;
