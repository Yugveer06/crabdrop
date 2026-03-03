import { useRef } from "react";
import { formatBytes } from "../lib/utils";

interface UploadZoneProps {
	fileList: File[];
	handleFiles: (files: FileList | null) => void;
	handleUpload: () => void;
	uploading: boolean;
}

export function UploadZone({
	fileList,
	handleFiles,
	handleUpload,
	uploading,
}: UploadZoneProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

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
	);
}
