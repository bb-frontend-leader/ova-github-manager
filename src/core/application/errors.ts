/** Se intentó crear algo que ya existe (OVA, escuela o desarrollador). */
export class DuplicateEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateEntryError';
  }
}
