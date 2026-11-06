import type { OvaRecord } from '@/core';
import { parseStatus, type OvaStatus } from './ova-status';

export interface OvaQuery {
  schoolId?: number;
  developerId?: number;
  status?: OvaStatus;
  q: string;
}

export function parseId(value: string | undefined): number | undefined {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : undefined;
}

/** Lee los filtros de la URL (los mismos para el listado y para la exportación). */
export function parseOvaQuery(params: {
  schoolId?: string;
  developerId?: string;
  status?: string;
  q?: string;
}): OvaQuery {
  return {
    schoolId: parseId(params.schoolId),
    developerId: parseId(params.developerId),
    status: parseStatus(params.status),
    q: (params.q ?? '').trim(),
  };
}

/** Aplica los filtros y ordena de la más reciente a la más antigua. */
export function filterOvas(all: readonly OvaRecord[], query: OvaQuery): OvaRecord[] {
  const needle = query.q.toLocaleLowerCase('es');
  const includes = (text: string) => text.toLocaleLowerCase('es').includes(needle);
  return all
    .filter((ova) => query.schoolId === undefined || ova.school.id === query.schoolId)
    .filter((ova) => query.developerId === undefined || ova.developer.id === query.developerId)
    .filter((ova) => query.status === undefined || ova.status === query.status)
    .filter(
      (ova) =>
        !needle || includes(ova.repoName) || includes(ova.developer.name) || includes(ova.school.name),
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
