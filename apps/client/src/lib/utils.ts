import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CompressionSettings } from "../types";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatBytes(b: number) {
	if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
	if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
	return `${b} B`;
}

export function buildQueryString(settings: CompressionSettings): string {
	if (!settings.compress) return "compress=false";
	const p = new URLSearchParams({
		compress: "true",
		jpeg_quality: String(settings.jpeg_quality),
		png_level: String(settings.png_level),
		webp_quality: String(settings.webp_quality),
		video_crf: String(settings.video_crf),
		video_codec: settings.video_codec,
		video_preset: settings.video_preset,
		audio_bitrate: String(settings.audio_bitrate),
		audio_codec: settings.audio_codec,
	});
	return p.toString();
}
