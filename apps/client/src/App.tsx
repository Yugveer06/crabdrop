import { useState } from "react";
import axios from "axios";
import type {
	CompressionSettings,
	SelectionEntry,
	ProgressEntry,
	ResultEntry,
} from "./types";
import { DEFAULT_SETTINGS } from "./lib/constants";
import { buildQueryString, getFileMediaType } from "./lib/utils";
import { Spotlight } from "./components/ui/spotlight-new";
import { SelectionBuffer } from "./components/SelectionBuffer";
import { ProgressBuffer } from "./components/ProgressBuffer";
import { ResultsList } from "./components/ResultsList";

/** Base URL for API calls. Empty in dev (Vite proxy), full VPS URL in prod. */
const API_URL = import.meta.env.VITE_API_URL ?? "";

const MAX_FILES = 8;
/** Max simultaneous uploads. Keeps the browser responsive for large files. */
const CONCURRENCY = 2;

/**
 * Runs `tasks` with at most `limit` running at the same time.
 * Each task is a zero-arg async function; results are discarded (side-effects only).
 */
async function runLimited(
	tasks: (() => Promise<void>)[],
	limit: number,
): Promise<void> {
	const queue = [...tasks];
	async function worker() {
		while (queue.length) {
			const task = queue.shift();
			if (task) await task();
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(limit, tasks.length) }, worker),
	);
}

function App() {
	// ── Buffer 1: waiting to be uploaded ────────────────────────────────────
	const [selection, setSelection] = useState<SelectionEntry[]>([]);

	// ── Buffer 2: currently uploading ────────────────────────────────────────
	const [uploading, setUploading] = useState<ProgressEntry[]>([]);

	// ── Buffer 3: finished uploads ───────────────────────────────────────────
	const [results, setResults] = useState<ResultEntry[]>([]);

	// ── Selection buffer helpers ─────────────────────────────────────────────
	const addFiles = (files: FileList | null) => {
		if (!files) return;
		setSelection(prev => {
			const slots = MAX_FILES - prev.length;
			if (slots <= 0) return prev;
			const incoming = Array.from(files).slice(0, slots);
			const newEntries: SelectionEntry[] = incoming.map(file => ({
				id: crypto.randomUUID(),
				file,
				mediaType: getFileMediaType(file.type),
				settings: { ...DEFAULT_SETTINGS },
			}));
			return [...prev, ...newEntries];
		});
	};

	const removeFromSelection = (id: string) =>
		setSelection(prev => prev.filter(e => e.id !== id));

	const updateSettings = (id: string, settings: CompressionSettings) =>
		setSelection(prev =>
			prev.map(e => (e.id === id ? { ...e, settings } : e)),
		);

	// ── Progress buffer helpers ──────────────────────────────────────────────
	const patchProgress = (id: string, patch: Partial<ProgressEntry>) =>
		setUploading(prev =>
			prev.map(e => (e.id === id ? { ...e, ...patch } : e)),
		);

	// ── Upload ───────────────────────────────────────────────────────────────
	const handleUpload = async () => {
		if (!selection.length) return;

		// Move everything from selection → progress buffer atomically
		const batch = [...selection];
		setSelection([]);
		setUploading(prev => [
			...prev,
			...batch.map(e => ({
				id: e.id,
				name: e.file.name,
				originalSize: e.file.size,
				compress: e.settings.compress,
				stage: "sending" as const,
				sendPercent: 0,
				compressPercent: 0,
			})),
		]);

		const tasks = batch.map(entry => async () => {
			const jobId = crypto.randomUUID();
			const qs = buildQueryString(entry.settings, entry.mediaType);

			const sse = new EventSource(
				`${API_URL}/api/progress?job_id=${jobId}`,
			);
			sse.onmessage = ev => {
				try {
					const data = JSON.parse(ev.data) as {
						stage: string;
						percent: number;
					};
					if (data.stage === "compressing") {
						patchProgress(entry.id, {
							stage: "compressing",
							compressPercent: data.percent,
						});
					} else if (data.stage === "uploading") {
						patchProgress(entry.id, { stage: "uploading" });
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
					`${API_URL}/api/upload?job_id=${jobId}&${qs}`,
					formData,
					{
						onUploadProgress: evt => {
							const pct = evt.total
								? Math.round((evt.loaded / evt.total) * 100)
								: 0;
							patchProgress(entry.id, { sendPercent: pct });
						},
					},
				);

				const data = res.data;
				const r2Filename = data.url.split("/").pop();
				const localUrl = `${API_URL}/f/${r2Filename}`;

				// SUCCESS → remove from progress, add to results
				setUploading(prev => prev.filter(e => e.id !== entry.id));
				setResults(prev => [
					{
						id: entry.id,
						name: entry.file.name,
						originalSize: entry.file.size,
						compressedSize: data.compressed_size_bytes,
						url: localUrl,
					},
					...prev,
				]);
			} catch (err) {
				sse.close();
				// FAILURE → remove from progress, put back in selection
				setUploading(prev => prev.filter(e => e.id !== entry.id));
				setSelection(prev => [entry, ...prev]);
			}
		});

		await runLimited(tasks, CONCURRENCY);
	};

	const isUploading = uploading.length > 0;

	return (
		<div className='relative min-h-screen bg-background overflow-hidden'>
			<Spotlight />

			<div className='relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12'>
				<div className='w-full max-w-lg space-y-5'>
					{/* Header */}
					<div className='text-center space-y-1'>
						<h1 className='text-2xl font-semibold tracking-tight text-foreground'>
							🦀 crabdrop
						</h1>
						<p className='text-sm text-muted-foreground'>
							fast file sharing with built-in compression
						</p>
					</div>

					{/* Buffer 1 — selection */}
					<SelectionBuffer
						entries={selection}
						onAddFiles={addFiles}
						onRemove={removeFromSelection}
						onUpdateSettings={updateSettings}
						onUpload={handleUpload}
						disabled={isUploading}
						maxFiles={MAX_FILES}
					/>

					{/* Buffer 2 — progress */}
					<ProgressBuffer entries={uploading} />

					{/* Buffer 3 — results */}
					<ResultsList results={results} />
				</div>
			</div>
		</div>
	);
}

export default App;
