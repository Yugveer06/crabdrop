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

/** An item sitting in the selection buffer, waiting to be uploaded. */
export interface SelectionEntry {
	/** Stable unique id for this entry (used as React key + to update state). */
	id: string;
	file: File;
	mediaType: FileMediaType;
	settings: CompressionSettings;
}

/** An item currently being uploaded — lives in the progress buffer. */
export interface ProgressEntry {
	id: string;
	name: string;
	originalSize: number;
	compress: boolean;
	stage: "sending" | "compressing" | "uploading";
	sendPercent: number;
	compressPercent: number;
}

/** A successfully uploaded file — lives in the results list. */
export interface ResultEntry {
	id: string;
	name: string;
	originalSize: number;
	compressedSize?: number;
	url: string;
}
