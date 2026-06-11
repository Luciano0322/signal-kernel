export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  compatibilityDate: "2026-06-08",
  css: ["~/assets/styles.css"],
  experimental: {
    viteEnvironmentApi: true,
  },
  typescript: {
    strict: true,
  },
});
