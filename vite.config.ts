import { defineConfig } from "@tanstack/react-start/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  vite: {
    plugins: [
      tsconfigPaths(),
      TanStackRouterVite(),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
});
