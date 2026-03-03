import { useState } from "react";
import axios from "axios";
import type { CompressionSettings, FileProgress } from "./types";
import { DEFAULT_SETTINGS } from "./lib/constants";
import { buildQueryString } from "./lib/utils";
import { SettingsPanel } from "./components/SettingsPanel";
import { UploadZone } from "./components/UploadZone";
import { ProgressList } from "./components/ProgressList";

function App() {
	const [settings, setSettings] =
		useState<CompressionSettings>(DEFAULT_SETTINGS);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [fileList, setFileList] = useState<File[]>([]);
	const [progress, setProgress] = useState<FileProgress[]>([]);
	const [uploading, setUploading] = useState(false);

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

	return (
		<div>
			<h1>🦀 Crabdrop</h1>
			<p>Fast file sharing with built-in compression</p>

			<SettingsPanel
				settings={settings}
				setSettings={setSettings}
				settingsOpen={settingsOpen}
				setSettingsOpen={setSettingsOpen}
			/>

			<UploadZone
				fileList={fileList}
				handleFiles={handleFiles}
				handleUpload={handleUpload}
				uploading={uploading}
			/>

			<ProgressList progress={progress} compress={settings.compress} />
		</div>
	);
}

export default App;
