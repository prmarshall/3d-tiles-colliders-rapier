import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: ["three", "@dimforge/rapier3d-compat"],
  },
  {
    entry: { react: "src/react.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: [
      "three",
      "@dimforge/rapier3d-compat",
      "@react-three/fiber",
      "@react-three/rapier",
      "react",
    ],
  },
]);
