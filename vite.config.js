import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173, // El puerto por defecto
  },
  build: {
    target: "esnext", // Para usar Vanilla JS moderno sin problemas
  },
});
