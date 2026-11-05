# OVA GitHub Manager

Dashboard web para crear y llevar el registro de los repositorios OVA del proyecto
**625-OVAS-2027** en la organización de GitHub, de modo que cualquier miembro del equipo
pueda crear OVAs sin depender de una sola persona.

## Estructura

Un solo proyecto Next.js (React + shadcn/ui + TypeScript). La lógica de negocio vive aparte, en `src/core`:

```
src/
├─ app/    Páginas y acciones de servidor (UI y API)
├─ lib/    Capa de servidor de la web: configuración (env), servicios, control de acceso (dal)
├─ components/
└─ core/   Lógica de negocio, sin dependencia de Next ni de React
   ├─ domain/          Value objects y reglas (RepositoryName, Topics, School, Role...)
   ├─ application/     Casos de uso + puertos (RepositoryGateway, OvaRegistry, UserStore...)
   ├─ infrastructure/  Adaptadores concretos (Octokit, SQLite)
   └─ __tests__/
```

**Regla de dependencias** (hay que respetarla a mano, ya no la impone un paquete aparte):
`domain` ← `application` ← `infrastructure`; `core` nunca importa de `app`, `lib` ni `components`.
Las páginas y acciones solo traducen peticiones hacia los casos de uso; no contienen reglas de negocio.

Los componentes de cliente (`'use client'`) **no deben importar `@/core`**: el índice arrastra SQLite y Octokit al navegador. Reciben los datos por props desde el servidor.

## Comandos

```bash
npm install          # instala dependencias
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm test             # tests del core (src/core)
npm run test:coverage
npm run typecheck    # tipos (ejecuta antes un build o dev: Next genera tipos de rutas)
npm run lint
```

## Puesta en marcha

1. `npm install`
2. Crea una **OAuth App en la organización** (no en tu cuenta personal), para que siga funcionando aunque tu cuenta cambie:
   GitHub → la organización → *Settings* → *Developer settings* → *OAuth Apps* → *New OAuth App*.
   - *Homepage URL*: la URL de la herramienta (p. ej. `http://localhost:3000`)
   - *Authorization callback URL*: `http://localhost:3000/api/auth/callback/github`
   - Copia el *Client ID* y genera un *Client secret*.
3. Copia `.env.example` a `.env.local` (en la raíz) y rellénalo (`GITHUB_ORG`, `GITHUB_TOKEN`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET`, `INITIAL_ADMINS`).
4. `npm run dev` y entra en `http://localhost:3000`.
5. Como admin, en **Administración** da de alta las escuelas y los desarrolladores. Después ya se pueden crear OVAs.

## Acceso y roles

Solo entran **miembros activos de la organización** (se comprueba con GitHub al iniciar sesión). Quien entra por primera vez queda como *Lector*; un admin le sube el rol.

| Rol | Puede |
|---|---|
| Lector | Ver el panel y el listado |
| Creador | Lo anterior + crear OVAs |
| Admin | Lo anterior + gestionar escuelas, desarrolladores y usuarios |

- El rol se lee de la base de datos en **cada petición**: un cambio de rol surte efecto al instante.
- Las sesiones duran 8 horas, así que quien salga de la organización pierde el acceso en horas.
- **Recuperación:** los usuarios de `INITIAL_ADMINS` son siempre admin. Si se pierde el acceso, añade un usuario a esa variable y reinicia la herramienta.
- No se puede quitar el rol al último admin.
- Cada acción se autoriza en el servidor, junto a la acción; ocultar un botón no es la protección.

## Datos de cada OVA

Al llegar una OVA se conocen solo tres datos:

| Dato | Se refleja en GitHub como |
|---|---|
| Nombre | nombre del repositorio (normalizado: `GR 2_88-2027-1` → `GR-2-88-2027-1`) |
| Escuela | topic |
| Desarrollador | se guarda en el registro (SQLite); **no** es un team (ver abajo) |

Todo repo nuevo recibe además:

- **Descripción:** `625 OVAs 2027 - {repo} {emoji aleatorio}`, p. ej. `625 OVAs 2027 - GR-2-88-2027-1 🚀`. El prefijo es configurable.
- **Team `Frontend` con permiso `pull`:** agrupa a todos los desarrolladores de la organización, así que el mismo team se asigna a cada OVA.
- **Contenido inicial copiado del repositorio plantilla `ova-template`** de la organización (configurable con `OVA_TEMPLATE`). Debe estar marcado como *Template repository* en GitHub.
- **Repositorio privado.**

## Decisiones tomadas

- **Base de datos:** SQLite en el servidor local (registro de OVAs, catálogo de escuelas y desarrolladores, auditoría).
- **Login:** GitHub OAuth, limitado a miembros de la organización. Roles: `admin`, `creador`, `lector`.
- **Acceso a GitHub:** una **GitHub App** de la organización, no un token personal, para que el sistema no dependa de una cuenta individual.
- **Seguridad:** secretos solo en el servidor; la web **no** ofrece borrar ni transferir repositorios; toda acción queda en un registro de auditoría.
- Los fallos parciales al crear (asignar team, poner topics) se devuelven como `warnings`, nunca se ocultan.

## Hoja de ruta

- [x] `src/core` con dominio y caso de uso Crear repositorio (con `warnings`)
- [x] Next.js y shadcn/ui en la raíz, conectados al core
- [x] Descripción con prefijo configurable y team por defecto (`Frontend`, `pull`) en el caso de uso
- [ ] Configuración en la app: prefijo `625 OVAs 2027`, team `Frontend` y template
- [x] SQLite en el core: registro de OVAs, catálogo de escuelas/desarrolladores, detección de duplicados, estadísticas por escuela y desarrollador (`SqliteOvaStore`, `CreateOvaUseCase`, `ManageCatalogUseCase`)
- [x] Registro conectado a la web (SQLite, servicios en el servidor)
- [x] Login con GitHub (Auth.js) limitado a miembros de la organización + roles (Lector / Creador / Admin)
- [x] Pantallas: panel con progreso (`x / 625`) por escuela y desarrollador y listado con filtros, crear OVA, administración (escuelas, desarrolladores, usuarios)
- [ ] Probar el flujo completo con una OAuth App real y la organización real
- [ ] GitHub App en lugar de token personal
- [ ] Reasignar desarrollador, sincronizar con GitHub, historial de auditoría
- [ ] Despliegue y guía de traspaso (rotar claves, añadir admins)

## Decisiones cerradas

- Descripción: prefijo fijo `625 OVAs 2027` + emoji aleatorio.
- Team: uno solo (`Frontend`, `pull`) para todas las OVAs; no hay un team por desarrollador.
- Cada OVA tiene **un** desarrollador y **una** escuela.

- El permiso de escritura de cada desarrollador se gestiona **fuera** de la herramienta. Aquí el desarrollador es solo un dato del registro (quién lleva cada OVA); la herramienta no le da permisos en GitHub.

## Pendiente por confirmar

Nada por ahora.
