import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages 배포 시 base 경로를 액션에서 주입된 BASE_PATH로 설정
  base: process.env.BASE_PATH || "/",
});
