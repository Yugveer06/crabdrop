import type { FileEntry, FileProgress } from "../types";
import { formatBytes } from "../lib/utils";

interface ProgressListProps {
	progress: FileProgress[];
	entries: FileEntry[];
}

export function ProgressList({ progress, entries }: ProgressListProps) {
	if (progress.length === 0) return null;

	return (
		<div>
			{progress.map((p, i) => {
				const compress = entries[i]?.settings.compress ?? false;

				return (
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
								{compress && (
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
				);
			})}
		</div>
	);
}
