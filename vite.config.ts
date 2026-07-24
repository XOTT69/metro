import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 3000,
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
  },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 1_000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "maplibre-vendor",
              test: /node_modules\/(?:maplibre-gl|@mapbox|@maplibre|earcut|geojson-vt|pbf|quickselect|tinyqueue|vt-pbf)/,
            },
          ],
        },
      },
    },
  },
});
