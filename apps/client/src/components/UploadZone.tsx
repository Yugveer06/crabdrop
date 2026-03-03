import { useRef, useState } from "react";
import { formatBytes } from "../lib/utils";
import type { CompressionSettings, FileEntry } from "../types";
import { FileSettings } from "./SettingsPanel";

interface UploadZoneProps {
	entries: FileEntry[];
	onUpdateSettings: (index: number, settings: CompressionSettings) => void;
	handleFiles: (files: FileList | null) => void;
	handleUpload: () => void;
	uploading: boolean;
}

export function UploadZone({
	entries,
	onUpdateSettings,
	handleFiles,
	handleUpload,
	uploading,
}: UploadZoneProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

	return (
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

			{entries.length > 0 && (
				<ul>
					{entries.map((entry, i) => (
						<li key={i}>
							<div>
								<span>
									{entry.file.name} —{" "}
									{formatBytes(entry.file.size)}
								</span>
								<button
									type='button'
									onClick={() =>
										setExpandedIndex(
											expandedIndex === i ? null : i,
										)
									}
								>
									⚙️ {expandedIndex === i ? "▲" : "▼"}
								</button>
							</div>
							{expandedIndex === i && (
								<FileSettings
									fileName={entry.file.name}
									mediaType={entry.mediaType}
									settings={entry.settings}
									onChange={s => onUpdateSettings(i, s)}
								/>
							)}
						</li>
					))}
				</ul>
			)}

			<button
				onClick={handleUpload}
				disabled={uploading || entries.length === 0}
			>
				{uploading
					? "Uploading…"
					: `Upload ${entries.length > 0 ? `${entries.length} file${entries.length > 1 ? "s" : ""}` : ""}`}
			</button>
		</div>
	);
}
