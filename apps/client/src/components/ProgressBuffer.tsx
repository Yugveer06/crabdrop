import type { ProgressEntry } from "../types";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { formatBytes } from "../lib/utils";
import { Loader2 } from "lucide-react";

interface ProgressBufferProps {
	entries: ProgressEntry[];
}

/**
 * Maps multi-stage pipeline into a single 0–100 value.
 *
 * With compression:    sending (0–33) → compressing (33–66) → uploading (66–99)
 * Without compression: sending (0–50) → uploading (50–99)
 */
function overallPercent(e: ProgressEntry): number {
	if (e.compress) {
		if (e.stage === "sending") return Math.round(e.sendPercent * 0.33);
		if (e.stage === "compressing")
			return 33 + Math.round(e.compressPercent * 0.33);
		if (e.stage === "uploading") return 80;
	} else {
		if (e.stage === "sending") return Math.round(e.sendPercent * 0.5);
		if (e.stage === "uploading") return 75;
	}
	return 0;
}

function stageLabel(e: ProgressEntry): string {
	switch (e.stage) {
		case "sending":
			return "Sending…";
		case "compressing":
			return "Compressing…";
		case "uploading":
			return "Uploading…";
	}
}

export function ProgressBuffer({ entries }: ProgressBufferProps) {
	if (entries.length === 0) return null;

	return (
		<Card className='border border-border bg-card/80 backdrop-blur-sm'>
			<CardContent className='p-0'>
				{entries.map((e, i) => {
					const pct = overallPercent(e);
					return (
						<div key={e.id}>
							{i > 0 && <Separator />}
							<div className='px-4 py-3 space-y-2'>
								{/* Row: name + stage badge */}
								<div className='flex items-center justify-between gap-2'>
									<div className='flex items-center gap-2 min-w-0'>
										<Loader2 className='h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0' />
										<span className='text-sm font-medium text-foreground truncate'>
											{e.name}
										</span>
										<span className='text-xs text-muted-foreground shrink-0'>
											{formatBytes(e.originalSize)}
										</span>
									</div>
									<Badge
										variant='secondary'
										className='text-xs shrink-0'
									>
										{stageLabel(e)}
									</Badge>
								</div>

								{/* Single progress bar */}
								<div className='space-y-1'>
									<Progress value={pct} className='h-1.5' />
									<p className='text-xs text-muted-foreground text-right'>
										{pct}%
									</p>
								</div>
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
