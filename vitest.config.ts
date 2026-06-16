import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // dates.ts / period.ts มี `import "server-only"` ซึ่งรันใน node ไม่ได้ → ใช้ stub ว่าง
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
      // ให้ alias "@/..." ตรงกับ tsconfig (รากโปรเจกต์)
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
