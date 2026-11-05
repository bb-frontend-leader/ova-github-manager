import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Módulo nativo: Next debe cargarlo desde node_modules, no empaquetarlo
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
