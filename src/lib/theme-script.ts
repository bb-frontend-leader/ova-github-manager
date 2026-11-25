/**
 * Aplica el tema antes de pintar para evitar el parpadeo claro→oscuro.
 * Orden: preferencia guardada, y si no hay, la del sistema operativo.
 */
export const themeScript = `
(() => {
  try {
    const saved = localStorage.getItem('theme');
    const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (_) {}
})();
`;
