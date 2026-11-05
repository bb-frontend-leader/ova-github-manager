import { SqliteOvaStore, SqliteProjectStore } from '../infrastructure/sqlite';

let counter = 0;

/** Base en memoria con un proyecto ya creado; devuelve la raíz y el almacén de ese proyecto. */
export async function openProject(
  org = `org-${++counter}`,
): Promise<{ root: SqliteOvaStore; store: SqliteProjectStore; projectId: number }> {
  const root = new SqliteOvaStore(':memory:');
  const project = await root.createProject({
    slug: org.toLowerCase(),
    name: `Proyecto ${org}`,
    org,
    template: 'ova-template',
    defaultTeam: 'Frontend',
    descriptionPrefix: 'OVA',
    total: 10,
  });
  return { root, store: root.forProject(project.id), projectId: project.id };
}

/** Atajo: solo el almacén de un proyecto nuevo. */
export async function openProjectStore(): Promise<SqliteProjectStore> {
  return (await openProject()).store;
}
