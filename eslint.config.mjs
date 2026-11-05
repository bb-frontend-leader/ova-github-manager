import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generado por Jest
    "coverage/**",
    // Skills de agentes (plantillas de terceros, no son código del proyecto)
    ".agents/**",
    ".claude/**",
    // Scripts de Node (CommonJS) que lanzan la aplicación, no código de la app
    "scripts/**",
  ]),
]);

export default eslintConfig;
