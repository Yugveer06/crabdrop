import type { CompressionSettings, FileMediaType } from "../types";
import {
	VIDEO_PRESETS,
	VIDEO_CODECS,
	AUDIO_CODECS,
	AUDIO_BITRATES,
} from "../lib/constants";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Badge } from "./ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";

interface FileSettingsProps {
	fileName: string;
	mediaType: FileMediaType;
	settings: CompressionSettings;
	onChange: (settings: CompressionSettings) => void;
}

function mediaTypeLabel(t: FileMediaType): string {
	switch (t) {
		case "jpeg":
			return "JPEG";
		case "png":
			return "PNG";
		case "gif":
			return "GIF";
		case "webp":
			return "WebP";
		case "svg":
			return "SVG";
		case "avif":
			return "AVIF";
		case "bmp":
			return "BMP";
		case "tiff":
			return "TIFF";
		case "video":
			return "Video";
		case "audio":
			return "Audio";
		case "unknown":
			return "File";
	}
}

export function FileSettings({
	mediaType,
	settings,
	onChange,
}: FileSettingsProps) {
	const set = <K extends keyof CompressionSettings>(
		k: K,
		v: CompressionSettings[K],
	) => onChange({ ...settings, [k]: v });

	const hasCompressibleSettings =
		mediaType === "jpeg" ||
		mediaType === "png" ||
		mediaType === "webp" ||
		mediaType === "video" ||
		mediaType === "audio";

	return (
		<div className='space-y-4'>
			{/* Type badge + compress toggle */}
			<div className='flex items-center justify-between'>
				<Badge variant='outline' className='text-xs'>
					{mediaTypeLabel(mediaType)}
				</Badge>
				<div className='flex items-center gap-2'>
					<Checkbox
						id='compress-toggle'
						checked={settings.compress}
						onCheckedChange={checked =>
							set("compress", checked === true)
						}
					/>
					<Label
						htmlFor='compress-toggle'
						className='text-xs text-muted-foreground cursor-pointer'
					>
						Compress
					</Label>
				</div>
			</div>

			{settings.compress && hasCompressibleSettings && (
				<div className='space-y-4'>
					{/* JPEG */}
					{mediaType === "jpeg" && (
						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<Label className='text-xs text-muted-foreground'>
									JPEG quality (qscale)
								</Label>
								<span className='text-xs font-medium text-foreground'>
									{settings.jpeg_quality}
								</span>
							</div>
							<Slider
								min={1}
								max={31}
								step={1}
								value={[settings.jpeg_quality]}
								onValueChange={v => set("jpeg_quality", v[0])}
							/>
						</div>
					)}

					{/* PNG */}
					{mediaType === "png" && (
						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<Label className='text-xs text-muted-foreground'>
									PNG compression level
								</Label>
								<span className='text-xs font-medium text-foreground'>
									{settings.png_level}
								</span>
							</div>
							<Slider
								min={0}
								max={9}
								step={1}
								value={[settings.png_level]}
								onValueChange={v => set("png_level", v[0])}
							/>
						</div>
					)}

					{/* WebP */}
					{mediaType === "webp" && (
						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<Label className='text-xs text-muted-foreground'>
									WebP quality
								</Label>
								<span className='text-xs font-medium text-foreground'>
									{settings.webp_quality}%
								</span>
							</div>
							<Slider
								min={1}
								max={100}
								step={1}
								value={[settings.webp_quality]}
								onValueChange={v => set("webp_quality", v[0])}
							/>
						</div>
					)}

					{/* Video */}
					{mediaType === "video" && (
						<div className='space-y-3'>
							<div className='space-y-2'>
								<div className='flex items-center justify-between'>
									<Label className='text-xs text-muted-foreground'>
										CRF (quality)
									</Label>
									<span className='text-xs font-medium text-foreground'>
										{settings.video_crf}
									</span>
								</div>
								<Slider
									min={0}
									max={51}
									step={1}
									value={[settings.video_crf]}
									onValueChange={v => set("video_crf", v[0])}
								/>
							</div>

							<div className='grid grid-cols-2 gap-3'>
								<div className='space-y-1.5'>
									<Label className='text-xs text-muted-foreground'>
										Codec
									</Label>
									<Select
										value={settings.video_codec}
										onValueChange={v =>
											set("video_codec", v)
										}
									>
										<SelectTrigger className='h-8 text-xs'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{VIDEO_CODECS.map(c => (
												<SelectItem
													key={c}
													value={c}
													className='text-xs'
												>
													{c}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className='space-y-1.5'>
									<Label className='text-xs text-muted-foreground'>
										Preset
									</Label>
									<Select
										value={settings.video_preset}
										onValueChange={v =>
											set("video_preset", v)
										}
									>
										<SelectTrigger className='h-8 text-xs'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{VIDEO_PRESETS.map(p => (
												<SelectItem
													key={p}
													value={p}
													className='text-xs'
												>
													{p}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
					)}

					{/* Audio */}
					{mediaType === "audio" && (
						<div className='grid grid-cols-2 gap-3'>
							<div className='space-y-1.5'>
								<Label className='text-xs text-muted-foreground'>
									Codec
								</Label>
								<Select
									value={settings.audio_codec}
									onValueChange={v => set("audio_codec", v)}
								>
									<SelectTrigger className='h-8 text-xs'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{AUDIO_CODECS.map(c => (
											<SelectItem
												key={c}
												value={c}
												className='text-xs'
											>
												{c}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className='space-y-1.5'>
								<Label className='text-xs text-muted-foreground'>
									Bitrate
								</Label>
								<Select
									value={String(settings.audio_bitrate)}
									onValueChange={v =>
										set("audio_bitrate", Number(v))
									}
								>
									<SelectTrigger className='h-8 text-xs'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{AUDIO_BITRATES.map(b => (
											<SelectItem
												key={b}
												value={String(b)}
												className='text-xs'
											>
												{b} kbps
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					)}
				</div>
			)}

			{settings.compress && !hasCompressibleSettings && (
				<p className='text-xs text-muted-foreground'>
					No configurable compression settings for{" "}
					{mediaTypeLabel(mediaType)} files — the server will apply
					sensible defaults.
				</p>
			)}
		</div>
	);
}
