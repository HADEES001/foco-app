import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config minima. No se agrega nada que foco.jsx no necesite:
// sin proxies de API, sin variables de entorno, sin plugins extra.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // permite probar en el celular real via `vite --host` durante desarrollo
  },
  build: {
    outDir: "dist", // Capacitor lee de aca (ver capacitor.config.ts -> webDir)
  },
});
