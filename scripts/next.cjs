/**
 * Lanzador de `next dev` / `next start` que toma el puerto de la variable PORT.
 *
 * Next solo lee PORT del entorno del proceso, no de `.env.local`. Aquí se carga primero la
 * configuración de entorno de Next (.env.local, etc.) y después se arranca con ese puerto,
 * así PORT puede vivir junto al resto de la configuración. Sin PORT se usa el 3000.
 * Un `-p` pasado en la línea de comandos tiene prioridad: `npm run dev -- -p 4000`.
 */
const { spawn } = require('node:child_process');
const { loadEnvConfig } = require('@next/env');

const command = process.argv[2];
if (command !== 'dev' && command !== 'start') {
  console.error('Uso: node scripts/next.cjs <dev|start> [opciones de next]');
  process.exit(1);
}

loadEnvConfig(process.cwd(), command === 'dev');

const port = (process.env.PORT ?? '').trim() || '3000';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error(`PORT inválido: "${port}". Usa un número entre 1 y 65535.`);
  process.exit(1);
}

const nextBin = require.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, command, '-p', port, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: process.env,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
