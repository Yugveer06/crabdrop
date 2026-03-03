import { useState } from "react";
import axios from "axios";
import type { CompressionSettings, FileEntry, FileProgress } from "./types";
import { DEFAULT_SETTINGS } from "./lib/constants";
import { buildQueryString, getFileMediaType } from "./lib/utils";
import { UploadZone } from "./components/UploadZone";
import { ProgressList } from "./components/ProgressList";

function App() {
	const [entries, setEntries] = useState<FileEntry[]>([]);
	const [progress, setProgress] = useState<FileProgress[]>([]);
	const [uploading, setUploading] = useState(false);

	const updateProgress = (idx: number, patch: Partial<FileProgress>) =>
		setProgress(prev =>
			prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
		);

	const handleFiles = (files: FileList | null) => {
		if (!files) return;
		const newEntries: FileEntry[] = Array.from(files).map(file => ({
			file,
			mediaType: getFileMediaType(file.type),
			settings: { ...DEFAULT_SETTINGS },
		}));
		setEntries(newEntries);
		setProgress(
			newEntries.map(e => ({
				name: e.file.name,
				originalSize: e.file.size,
				stage: "idle",
				sendPercent: 0,
				compressPercent: 0,
			})),
		);
	};

	const updateEntrySettings = (
		index: number,
		settings: CompressionSettings,
	) => {
		setEntries(prev =>
			prev.map((entry, i) =>
				i === index ? { ...entry, settings } : entry,
			),
		);
	};

	const handleUpload = async () => {
		if (!entries.length) return;
		setUploading(true);

		const uploads = entries.map(async (entry, i) => {
			const jobId = crypto.randomUUID();
			const qs = buildQueryString(entry.settings, entry.mediaType);

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
			formData.append("file", entry.file);

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
		});

		await Promise.all(uploads);
		setUploading(false);
	};

	return (
		<div>
			<h1>🦀 Crabdrop</h1>
			<p>Fast file sharing with built-in compression</p>

			<UploadZone
				entries={entries}
				onUpdateSettings={updateEntrySettings}
				handleFiles={handleFiles}
				handleUpload={handleUpload}
				uploading={uploading}
			/>

			<ProgressList progress={progress} entries={entries} />
		</div>
	);
}

export default App;
