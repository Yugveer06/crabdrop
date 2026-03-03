/** The broad media category of a file, used to decide which compression controls to show. */
export type FileMediaType =
	| "jpeg"
	| "png"
	| "gif"
	| "webp"
	| "svg"
	| "avif"
	| "bmp"
	| "tiff"
	| "video"
	| "audio"
	| "unknown";

/** Per-file compression settings. Only the fields relevant to the file type need to be set. */
export interface CompressionSettings {
	compress: boolean;
	// Image
	jpeg_quality: number;
	png_level: number;
	webp_quality: number;
	// Video
	video_crf: number;
	video_codec: string;
	video_preset: string;
	// Audio
	audio_bitrate: number;
	audio_codec: string;
}

export interface FileEntry {
	file: File;
	mediaType: FileMediaType;
	settings: CompressionSettings;
}

export interface FileProgress {
	name: string;
	originalSize: number;
	stage: "idle" | "sending" | "compressing" | "uploading" | "done" | "error";
	sendPercent: number;
	compressPercent: number;
	compressedSize?: number;
	url?: string;
	error?: string;
}
