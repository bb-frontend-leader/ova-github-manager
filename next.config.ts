import type { NextConfig } from "next";

// Si la herramienta no vive en la raíz del dominio (p. ej. https://dominio.com/ova-github-manager/app),
// define BASE_PATH=/ova-github-manager/app. Es de compilación: cámbialo y vuelve a ejecutar `npm run build`.
function normalizeBasePath(value: string | undefined): string {
  const trimmed = (value ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  // Para el código de la app (ver src/lib/base-path.ts)
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
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
