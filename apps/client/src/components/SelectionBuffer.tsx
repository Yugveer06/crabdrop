import { useRef, useState, useEffect } from "react";
import { Upload, ChevronDown, ChevronUp, X, FileIcon } from "lucide-react";
import { formatBytes } from "../lib/utils";
import type { CompressionSettings, SelectionEntry } from "../types";
import { FileSettings } from "./SettingsPanel";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "./ui/collapsible";

interface SelectionBufferProps {
	entries: SelectionEntry[];
	onAddFiles: (files: FileList | null) => void;
	onRemove: (id: string) => void;
	onUpdateSettings: (id: string, settings: CompressionSettings) => void;
	onUpload: () => void;
	disabled: boolean;
	maxFiles: number;
}

function isImage(file: File): boolean {
	return file.type.startsWith("image/");
}

export function SelectionBuffer({
	entries,
	onAddFiles,
	onRemove,
	onUpdateSettings,
	onUpload,
	disabled,
	maxFiles,
}: SelectionBufferProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	// Stable URL cache: entry id → object URL.
	// - Created once when an entry is first seen.
	// - Revoked immediately when an entry leaves the list.
	// - All remaining revoked on component unmount.
	const urlCache = useRef<Map<string, string>>(new Map());

	useEffect(() => {
		const cache = urlCache.current;
		const currentIds = new Set(entries.map(e => e.id));

		// Revoke URLs for entries that are no longer in the list
		for (const [id, url] of cache) {
			if (!currentIds.has(id)) {
				URL.revokeObjectURL(url);
				cache.delete(id);
			}
		}

		// Create URLs only for newly added image entries
		for (const entry of entries) {
			if (!cache.has(entry.id) && isImage(entry.file)) {
				cache.set(entry.id, URL.createObjectURL(entry.file));
			}
		}
	}, [entries]);

	// Revoke everything on unmount
	useEffect(() => {
		return () => {
			for (const url of urlCache.current.values()) {
				URL.revokeObjectURL(url);
			}
			urlCache.current.clear();
		};
	}, []);

	const atLimit = entries.length >= maxFiles;

	return (
		<div className='space-y-3'>
			{/* Drop zone */}
			<Card
				className={`border border-border bg-card/80 backdrop-blur-sm transition-colors ${
					atLimit || disabled
						? "opacity-50 cursor-not-allowed"
						: "cursor-pointer hover:bg-accent/50"
				}`}
				onClick={() =>
					!atLimit && !disabled && fileInputRef.current?.click()
				}
				onDragOver={e => e.preventDefault()}
				onDrop={e => {
					e.preventDefault();
					if (!atLimit && !disabled) onAddFiles(e.dataTransfer.files);
				}}
			>
				<CardContent className='flex flex-col items-center justify-center py-10 gap-2'>
					<Upload className='h-8 w-8 text-muted-foreground' />
					<p className='text-sm font-medium text-foreground'>
						Drop files here or click to browse
					</p>
					<p className='text-xs text-muted-foreground'>
						{atLimit
							? `Limit reached (${maxFiles} files max)`
							: `Images, video, and audio · max ${maxFiles} files`}
					</p>
					<input
						ref={fileInputRef}
						type='file'
						multiple
						className='hidden'
						onChange={e => {
							onAddFiles(e.target.files);
							e.target.value = "";
						}}
					/>
				</CardContent>
			</Card>

			{/* File list */}
			{entries.length > 0 && (
				<Card className='border border-border bg-card/80 backdrop-blur-sm'>
					<CardContent className='p-0'>
						{entries.map((entry, i) => {
							const previewUrl = urlCache.current.get(entry.id);
							return (
								<div key={entry.id}>
									{i > 0 && <Separator />}
									<Collapsible
										open={expandedId === entry.id}
										onOpenChange={open =>
											setExpandedId(
												open ? entry.id : null,
											)
										}
									>
										<div className='flex items-center gap-3 px-4 py-3'>
											{/* Thumbnail / icon */}
											<div className='h-10 w-10 shrink-0 rounded-md border border-border bg-muted flex items-center justify-center overflow-hidden'>
												{previewUrl ? (
													<img
														src={previewUrl}
														alt={entry.file.name}
														className='h-full w-full object-cover'
													/>
												) : (
													<FileIcon className='h-4 w-4 text-muted-foreground' />
												)}
											</div>

											{/* Name + size */}
											<div className='flex-1 min-w-0'>
												<p className='text-sm font-medium text-foreground truncate'>
													{entry.file.name}
												</p>
												<p className='text-xs text-muted-foreground'>
													{formatBytes(
														entry.file.size,
													)}
												</p>
											</div>

											{/* Actions */}
											<div className='flex items-center gap-1 shrink-0'>
												<CollapsibleTrigger asChild>
													<Button
														variant='ghost'
														size='sm'
														className='h-7 w-7 p-0 text-muted-foreground'
													>
														{expandedId ===
														entry.id ? (
															<ChevronUp className='h-4 w-4' />
														) : (
															<ChevronDown className='h-4 w-4' />
														)}
													</Button>
												</CollapsibleTrigger>
												<Button
													variant='ghost'
													size='sm'
													className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive'
													onClick={e => {
														e.stopPropagation();
														if (
															expandedId ===
															entry.id
														)
															setExpandedId(null);
														onRemove(entry.id);
													}}
													disabled={disabled}
												>
													<X className='h-4 w-4' />
												</Button>
											</div>
										</div>

										<CollapsibleContent>
											<Separator />
											<div className='px-4 py-3'>
												<FileSettings
													fileName={entry.file.name}
													mediaType={entry.mediaType}
													settings={entry.settings}
													onChange={s =>
														onUpdateSettings(
															entry.id,
															s,
														)
													}
												/>
											</div>
										</CollapsibleContent>
									</Collapsible>
								</div>
							);
						})}
					</CardContent>
				</Card>
			)}

			{/* Upload button */}
			<Button
				onClick={onUpload}
				disabled={disabled || entries.length === 0}
				className='w-full'
				size='lg'
			>
				<Upload className='mr-2 h-4 w-4' />
				{entries.length > 0
					? `Upload ${entries.length} file${entries.length > 1 ? "s" : ""}`
					: "Upload"}
			</Button>
		</div>
	);
}
