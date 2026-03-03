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
