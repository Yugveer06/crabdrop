import { useState } from "react";
import axios from "axios";

interface UploadedFile {
	slug: string;
	original_filename: string;
	content_type: string;
	size_bytes: number;
	url: string;
	localUrl: string;
}

function App() {
	const [files, setFiles] = useState<FileList | null>(null);
	const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleUpload = async () => {
		if (!files || files.length === 0) return;

		setUploading(true);
		setError(null);

		for (const file of Array.from(files)) {
			const formData = new FormData();
			formData.append("file", file);

			try {
				const res = await axios.post("/api/upload", formData);
				const data = res.data;

				// Extract filename from R2 URL (slug.ext)
				const r2Filename = data.url.split("/").pop();
				const localUrl = `${window.location.origin}/f/${r2Filename}`;

				setUploaded(prev => [...prev, { ...data, localUrl }]);
			} catch (err: unknown) {
				let msg = "Unknown error";
				if (axios.isAxiosError(err)) {
					msg = err.response?.data?.error || err.message;
				} else if (err instanceof Error) {
					msg = err.message;
				}
				setError(`Failed to upload ${file.name}: ${msg}`);
			}
		}

		setUploading(false);
		setFiles(null);
	};

	return (
		<div>
			<h1>Crabdrop</h1>

			<div>
				<input
					type='file'
					multiple
					onChange={e => setFiles(e.target.files)}
				/>
				<button onClick={handleUpload} disabled={uploading || !files}>
					{uploading ? "Uploading..." : "Upload"}
				</button>
			</div>

			{error && <p style={{ color: "red" }}>{error}</p>}

			{uploaded.length > 0 && (
				<div>
					<h2>Uploaded Files</h2>
					<ul>
						{uploaded.map(file => (
							<li key={file.slug}>
								<strong>{file.original_filename}</strong> (
								{(file.size_bytes / 1024).toFixed(1)} KB)
								<br />
								<a href={file.localUrl} target='_blank'>
									{file.localUrl}
								</a>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

export default App;
