import type { CapacitorConfig } from "@capacitor/cli";

/**
 * NagarMitra Android wrapper.
 *
 * The app is a server-rendered TanStack Start application (AI vision, database
 * access and SLA logic all run on the server), so the APK is a native shell
 * that loads the published site. Publishing an update ships it to every
 * installed phone with no new APK.
 *
 * See ANDROID-APK.md for the build steps.
 */
const config: CapacitorConfig = {
  appId: "app.nagarmitra.citizen",
  appName: "NagarMitra",
  webDir: "public",
  server: {
    url: "https://nagarmitra-dashboard.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
