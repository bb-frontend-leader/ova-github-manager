import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { getServices } from '@/lib/services';

/**
 * Comprueba con el token del propio usuario que es miembro ACTIVO de la organización.
 * Requiere el scope `read:org` y que la organización haya aprobado esta OAuth App.
 */
async function isActiveOrgMember(accessToken: string, org: string): Promise<boolean> {
  const response = await fetch(
    `https://api.github.com/user/memberships/orgs/${encodeURIComponent(org)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    console.warn(`[auth] No se pudo verificar la membresía en "${org}" (HTTP ${response.status})`);
    return false;
  }

  const membership = (await response.json()) as { state?: string };
  return membership.state === 'active';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: 'read:user read:org' } },
    }),
  ],
  session: {
    strategy: 'jwt',
    // Sesión corta: si alguien sale de la organización, pierde el acceso en horas, no en semanas.
    maxAge: 8 * 60 * 60,
  },
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async signIn({ account, profile }) {
      const login = typeof profile?.login === 'string' ? profile.login : undefined;
      if (!login || !account?.access_token) return false;

      // Se comprueba la membresía en la organización de CADA proyecto: entra quien pertenezca a
      // al menos una (o sea super administrador). El rol dentro de cada una lo da el proyecto.
      const token = account.access_token;
      const result = await getServices().signIn.execute(login, (org) =>
        isActiveOrgMember(token, org),
      );
      if (!result.superAdmin && result.projects.length === 0) {
        return '/login?error=NotOrgMember';
      }
      return true;
    },
    jwt({ token, profile }) {
      // Solo se guarda el usuario; el rol se lee de la base de datos en cada petición
      // para que un cambio de rol surta efecto de inmediato.
      if (typeof profile?.login === 'string') {
        token.login = profile.login.toLowerCase();
      }
      return token;
    },
    session({ session, token }) {
      session.user.login = typeof token.login === 'string' ? token.login : '';
      return session;
    },
  },
});
