import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CompressionSettings, FileMediaType } from "../types";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatBytes(b: number) {
	if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
	if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
	return `${b} B`;
}

/**
 * Map a MIME type to a FileMediaType.
 * Covers every type from the backend ALLOWED_CONTENT_TYPES list.
 */
export function getFileMediaType(mime: string): FileMediaType {
	switch (mime) {
		case "image/jpeg":
			return "jpeg";
		case "image/png":
			return "png";
		case "image/gif":
			return "gif";
		case "image/webp":
			return "webp";
		case "image/svg+xml":
			return "svg";
		case "image/avif":
			return "avif";
		case "image/bmp":
			return "bmp";
		case "image/tiff":
			return "tiff";
		case "video/mp4":
		case "video/webm":
		case "video/quicktime":
			return "video";
		case "audio/mpeg":
		case "audio/ogg":
		case "audio/wav":
		case "audio/webm":
		case "audio/flac":
			return "audio";
		default:
			return "unknown";
	}
}

/**
 * Build a query string that only sends the compression params relevant to the
 * file's media type.
 */
export function buildQueryString(
	settings: CompressionSettings,
	mediaType: FileMediaType,
): string {
	const p = new URLSearchParams();
	if (settings.expires_in) p.set("expires_in", settings.expires_in);

	if (!settings.compress) {
		p.set("compress", "false");
		return p.toString();
	}

	p.set("compress", "true");

	switch (mediaType) {
		case "jpeg":
			p.set("jpeg_quality", String(settings.jpeg_quality));
			break;
		case "png":
			p.set("png_level", String(settings.png_level));
			break;
		case "webp":
			p.set("webp_quality", String(settings.webp_quality));
			break;
		case "gif":
		case "svg":
		case "avif":
		case "bmp":
		case "tiff":
			// These image types don't have dedicated compression params;
			// the backend handles them with sensible defaults.
			break;
		case "video":
			p.set("video_crf", String(settings.video_crf));
			p.set("video_codec", settings.video_codec);
			p.set("video_preset", settings.video_preset);
			break;
		case "audio":
			p.set("audio_bitrate", String(settings.audio_bitrate));
			p.set("audio_codec", settings.audio_codec);
			break;
		case "unknown":
			// No specific compression params
			break;
	}

	return p.toString();
}
