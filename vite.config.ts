import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-msal",
              test: /[\\/]node_modules[\\/]@azure[\\/]/,
            },
            {
              name: "vendor-graph",
              test: /[\\/]node_modules[\\/]@microsoft[\\/]/,
            },
            {
              name: "vendor-tiptap",
              test: /[\\/]node_modules[\\/](@tiptap|prosemirror)/,
            },
          ],
        },
      },
    },
  },
});
