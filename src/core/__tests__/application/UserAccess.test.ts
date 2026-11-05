import { DuplicateEntryError } from '../../application/errors';
import { ManageUsersUseCase } from '../../application/UserAccessUseCases';
import type { SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

describe('SqliteProjectStore (usuarios)', () => {
  let store: SqliteProjectStore;

  beforeEach(async () => {
    store = await openProjectStore();
  });
  afterEach(() => store.close());

  it('crea y encuentra usuarios sin distinguir mayúsculas', async () => {
    const created = await store.createUser('alejo', 'creator');

    expect(created).toEqual({
      login: 'alejo',
      role: 'creator',
      verified: false,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect((await store.findUser('ALEJO'))?.login).toBe('alejo');
    expect(await store.findUser('nadie')).toBeNull();
  });

  it('rechaza crear dos veces el mismo usuario', async () => {
    await store.createUser('alejo', 'viewer');

    await expect(store.createUser('Alejo', 'admin')).rejects.toBeInstanceOf(DuplicateEntryError);
  });

  it('cambia el rol y devuelve null si el usuario no existe', async () => {
    await store.createUser('alejo', 'viewer');

    expect((await store.setUserRole('alejo', 'admin'))?.role).toBe('admin');
    expect(await store.setUserRole('nadie', 'admin')).toBeNull();
  });

  it('lista ordenado y cuenta por rol', async () => {
    await store.createUser('zoe', 'viewer');
    await store.createUser('ana', 'admin');
    await store.createUser('bea', 'admin');

    expect((await store.listUsers()).map((u) => u.login)).toEqual(['ana', 'bea', 'zoe']);
    expect(await store.countUsersByRole('admin')).toBe(2);
    expect(await store.countUsersByRole('creator')).toBe(0);
  });

  it('la base de datos rechaza roles inválidos', async () => {
    await expect(store.createUser('ana', 'dios' as never)).rejects.toThrow();
  });
});

describe('ManageUsersUseCase', () => {
  let store: SqliteProjectStore;
  let useCase: ManageUsersUseCase;

  beforeEach(async () => {
    store = await openProjectStore();
    useCase = new ManageUsersUseCase(store);
    await store.createUser('alejo', 'admin');
  });
  afterEach(() => store.close());

  it('autoriza de antemano a un usuario con el rol indicado', async () => {
    const user = await useCase.addUser('@Maria', 'creator');

    expect(user).toMatchObject({ login: 'maria', role: 'creator' });
    expect((await useCase.list()).map((u) => u.login)).toEqual(['alejo', 'maria']);
  });

  it('rechaza autorizar dos veces al mismo usuario', async () => {
    await expect(useCase.addUser('ALEJO', 'viewer')).rejects.toBeInstanceOf(DuplicateEntryError);
  });

  it('rechaza roles inválidos al añadir o cambiar', async () => {
    await expect(useCase.addUser('maria', 'dios' as never)).rejects.toThrow('Invalid role');
    await expect(useCase.changeRole('alejo', 'dios' as never)).rejects.toThrow('Invalid role');
  });

  it('cambia el rol de un usuario', async () => {
    await useCase.addUser('maria', 'viewer');

    expect((await useCase.changeRole('maria', 'creator')).role).toBe('creator');
  });

  it('rechaza cambiar el rol de un usuario inexistente', async () => {
    await expect(useCase.changeRole('nadie', 'viewer')).rejects.toThrow('User not found');
  });

  it('impide quitar el rol al último admin', async () => {
    await expect(useCase.changeRole('alejo', 'viewer')).rejects.toThrow('last admin');
    expect((await store.findUser('alejo'))?.role).toBe('admin');
  });

  it('permite quitar el rol a un admin si queda otro', async () => {
    await useCase.addUser('maria', 'admin');

    expect((await useCase.changeRole('alejo', 'viewer')).role).toBe('viewer');
  });

  it('permite "cambiar" a admin a quien ya es el último admin', async () => {
    expect((await useCase.changeRole('alejo', 'admin')).role).toBe('admin');
  });
});
