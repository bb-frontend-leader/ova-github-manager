import { ovasToCsv } from '../../application/OvaExport';
import type { OvaRecord } from '../../application/registry';

const ova = (overrides: Partial<OvaRecord> = {}): OvaRecord => ({
  id: 1,
  repoName: 'GR-1',
  repoUrl: 'https://github.com/mi-org/GR-1',
  school: { id: 1, name: 'Ingeniería', slug: 'ingenieria' },
  developer: { id: 1, name: 'Juan Pérez', githubLogin: null },
  status: 'development',
  statusChangedAt: '2026-11-05T10:30:00.000Z',
  createdBy: 'alejo',
  createdAt: '2026-11-05T10:30:00.000Z',
  ...overrides,
});

describe('ovasToCsv', () => {
  it('incluye el enlace de cada repositorio y usa ; como separador', () => {
    const lines = ovasToCsv([ova()]).split('\r\n');

    expect(lines[0]).toBe(
      'Repositorio;Enlace del repositorio;Escuela;Topic;Desarrollador;Estado;Creada por;Fecha de creación (UTC)',
    );
    expect(lines[1]).toBe(
      'GR-1;https://github.com/mi-org/GR-1;Ingeniería;ingenieria;Juan Pérez;En desarrollo;alejo;2026-11-05T10:30:00.000Z',
    );
    expect(lines[2]).toBe('');
  });

  it('devuelve solo la cabecera si no hay OVAs', () => {
    expect(ovasToCsv([]).trim().split('\r\n')).toHaveLength(1);
  });

  it('entrecomilla las celdas con separador, comillas o saltos de línea', () => {
    const csv = ovasToCsv([
      ova({ developer: { id: 1, name: 'Pérez; "Juan"\nJr', githubLogin: null } }),
    ]);

    expect(csv).toContain('"Pérez; ""Juan""\nJr"');
  });

  it.each(['=SUMA(A1)', '+1', '-1', '@usuario'])(
    'neutraliza las celdas que Excel leería como fórmula: %s',
    (name) => {
      const csv = ovasToCsv([ova({ developer: { id: 1, name, githubLogin: null } })]);

      expect(csv).toContain(`;'${name};`);
    },
  );
});
