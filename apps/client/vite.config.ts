import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
	plugins: [react(), tailwindcss()],
	base: mode === "production" ? "/crabdrop/" : "/",
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		port: 3000,
		proxy: {
			"/api": {
				target: "http://127.0.0.1:3001",
				changeOrigin: true,
			},
			"/f": {
				target: "http://127.0.0.1:3001",
				changeOrigin: true,
			},
		},
	},
}));
