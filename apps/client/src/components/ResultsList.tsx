import { useState } from "react";
import { ExternalLink, Copy, Check, CheckCircle2 } from "lucide-react";
import type { ResultEntry } from "../types";
import { formatBytes } from "../lib/utils";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";

interface ResultsListProps {
	results: ResultEntry[];
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Button
			variant='ghost'
			size='sm'
			className='h-7 w-7 p-0 shrink-0 text-muted-foreground'
			onClick={handleCopy}
		>
			{copied ? (
				<Check className='h-3.5 w-3.5' />
			) : (
				<Copy className='h-3.5 w-3.5' />
			)}
		</Button>
	);
}

export function ResultsList({ results }: ResultsListProps) {
	if (results.length === 0) return null;

	return (
		<Card className='border border-border bg-card/80 backdrop-blur-sm'>
			<CardContent className='p-0'>
				{results.map((r, i) => (
					<div key={r.id}>
						{i > 0 && <Separator />}
						<div className='px-4 py-3 space-y-2'>
							{/* Name + done badge */}
							<div className='flex items-center justify-between gap-2'>
								<span className='text-sm font-medium text-foreground truncate'>
									{r.name}
								</span>
								<Badge
									variant='default'
									className='text-xs shrink-0'
								>
									<CheckCircle2 className='mr-1 h-3 w-3' />
									Done
								</Badge>
							</div>

							{/* Size info */}
							{r.compressedSize !== undefined && (
								<p className='text-xs text-muted-foreground'>
									{formatBytes(r.originalSize)} →{" "}
									{formatBytes(r.compressedSize)}
									{r.compressedSize < r.originalSize
										? ` (−${Math.round((1 - r.compressedSize / r.originalSize) * 100)}% saved)`
										: " (already optimal)"}
								</p>
							)}

							{/* URL row */}
							<div className='flex items-center gap-1'>
								<Button
									variant='outline'
									size='sm'
									className='h-7 text-xs flex-1 justify-start overflow-hidden'
									asChild
								>
									<a
										href={r.url}
										target='_blank'
										rel='noreferrer'
									>
										<ExternalLink className='mr-1.5 h-3 w-3 shrink-0' />
										<span className='truncate'>
											{r.url}
										</span>
									</a>
								</Button>
								<CopyButton text={r.url} />
							</div>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
