import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.foco.app",
  appName: "FOCO",
  webDir: "dist",

  // Fix #2 del audit: foco.jsx abre WhatsApp/Twitter con window.open() a un
  // dominio externo (wa.me, twitter.com). Sin esto, el WebView de Capacitor
  // puede intentar navegar esas URLs adentro de la app en vez de entregarlas
  // al sistema (que abriria la app de WhatsApp/Twitter o el navegador).
  // No se toco ninguna linea de foco.jsx para este fix — es solo config.
  server: {
    allowNavigation: ["wa.me", "*.wa.me", "twitter.com", "*.twitter.com", "x.com", "*.x.com"],
  },
};

export default config;
