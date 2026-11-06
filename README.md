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

## Varios proyectos (organizaciones)

La herramienta gestiona **varios proyectos de OVAs**; cada uno es una organización de GitHub con su propio catálogo (escuelas y desarrolladores), OVAs, usuarios y registro de actividad. Nada se mezcla entre proyectos.

- Cada proyecto vive en `/p/<identificador>` (panel, crear OVA, actividad, administración, exportación, ajustes).
- Los **super administradores** (`INITIAL_ADMINS`) crean proyectos desde **Nuevo proyecto** (nombre, organización, plantilla, team, prefijo de la descripción y objetivo de OVAs) y los editan en **Proyecto**. Al crearlo se comprueba con GitHub que el token ve la organización y se avisa si la plantilla no existe.
- Se usa **un solo token** (`GITHUB_TOKEN`) que debe tener acceso a todas las organizaciones.
- La organización y el identificador no cambian después de crear el proyecto.

## Puesta en marcha

1. `npm install`
2. Crea una **OAuth App** para el login (mejor en una organización que en tu cuenta personal, para que siga funcionando aunque tu cuenta cambie):
   GitHub → *Settings* → *Developer settings* → *OAuth Apps* → *New OAuth App*.
   - *Homepage URL*: la URL de la herramienta (p. ej. `http://localhost:3000`)
   - *Authorization callback URL*: `http://localhost:3000/api/auth/callback/github`
   - Copia el *Client ID* y genera un *Client secret*. Cada organización de un proyecto debe aprobar esta OAuth App para que se pueda comprobar quién es miembro.
3. Copia `.env.example` a `.env.local` (en la raíz) y rellénalo (`GITHUB_TOKEN`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET`, `INITIAL_ADMINS`).
4. `npm run dev` y entra en `http://localhost:3000`. El puerto se cambia con `PORT` en `.env.local` (también vale para `npm start`); un `-p` en la línea de comandos tiene prioridad: `npm run dev -- -p 4000`.
5. Como super administrador, crea el primer proyecto. Dentro de él, en **Administración**, da de alta las escuelas y los desarrolladores. Después ya se pueden crear OVAs.

### Servirla bajo una ruta (BASE_PATH)

Si la herramienta no vive en la raíz del dominio (p. ej. `https://www.tu-dominio.com/ova-github-manager/app`), define `BASE_PATH=/ova-github-manager/app` en `.env.local` y **vuelve a compilar** (`npm run build`). Next lo aplica como `basePath` y `assetPrefix` y lo lee al compilar **y** al arrancar, por eso va en `.env.local` (o en el entorno de ambos comandos). Además:

- La *Authorization callback URL* de la OAuth App pasa a ser `https://www.tu-dominio.com/ova-github-manager/app/api/auth/callback/github`.
- Si defines `AUTH_URL`, pon solo el dominio (`https://www.tu-dominio.com`); la ruta sale de `BASE_PATH`.
- El proxy del servidor debe reenviar esa ruta tal cual (sin quitar el prefijo) a la aplicación.
- En el código, usa `withBasePath()` (`src/lib/base-path.ts`) para `<a>` y `<form action>` con rutas absolutas; `<Link>`, el router y `redirect()` ya lo añaden solos.

### Migrar desde la versión de un solo proyecto

Si ya tenías una base de datos (`data/ova.db`) de la versión anterior, mantén `GITHUB_ORG`, `OVA_DESCRIPTION_PREFIX`, `OVA_DEFAULT_TEAM`, `OVA_TEMPLATE` y `OVA_TOTAL` en `.env.local` **solo para el primer arranque**: todo lo existente (escuelas, desarrolladores, OVAs, usuarios y actividad, con los mismos ids) pasa a ser el primer proyecto. Antes de migrar se guarda una copia en `data/ova.db.pre-projects.bak`, y la migración es una transacción: o se hace completa o no se cambia nada. Después esas variables ya no se usan.

## Acceso y roles

Entra quien sea **miembro activo de la organización de al menos un proyecto** (se comprueba con GitHub al iniciar sesión, para cada proyecto). Quien entra por primera vez a un proyecto queda como *Lector*; un admin de ese proyecto le sube el rol. **Los roles son por proyecto**: alguien puede ser Creador en uno y Lector en otro.

| Rol (en un proyecto) | Puede |
|---|---|
| Lector | Ver el panel, el tablero y su trabajo |
| Creador | Lo anterior + crear OVAs, editarlas y cambiarles el estado |
| Admin | Lo anterior + gestionar escuelas, desarrolladores y usuarios, y reparar repositorios |
| Super administrador | Admin en todos los proyectos + crear y editar proyectos |

- El rol se lee de la base de datos en **cada petición**: un cambio de rol surte efecto al instante.
- Las sesiones duran 8 horas, y la membresía se vuelve a comprobar al iniciar sesión: quien salga de una organización pierde el acceso a ese proyecto en horas.
- **Recuperación:** los usuarios de `INITIAL_ADMINS` son super administradores. Si se pierde el acceso, añade un usuario a esa variable y reinicia la herramienta.
- No se puede quitar el rol al último admin de un proyecto.
- Cada acción se autoriza en el servidor, junto a la acción; ocultar un botón no es la protección.

## Seguimiento de las OVAs

Cada OVA tiene un **estado**: *En desarrollo* (al crearla), *En revisión* o *Entregada*. Lo cambia quien pueda editar OVAs, con las flechas del tablero o de «Mi trabajo»; cada cambio queda en la actividad.

| Pantalla | Para qué sirve | Quién |
|---|---|---|
| **Tablero** | Las OVAs en tres columnas por estado, con filtros. Cada tarjeta muestra PRs abiertos, resultado del CI y si está estancada. | Todos |
| **Mi trabajo** | Las OVAs de la persona que entró y lo que necesita atención. Un admin puede ver las de otra persona. | Todos |
| **Panel** | Reparto por estado, filtro por estado y «Requieren atención» (OVAs estancadas). | Todos |
| **Carga** | Cuántas OVAs lleva cada persona (desarrollo, revisión, entregadas), quién tiene mucha carga o hueco, y reasignar varias OVAs a otra persona de una vez. | Todos ven; quien puede editar OVAs reasigna |
| **Reparar** | Compara GitHub con el registro: completa lo que falte (topic, team, permiso) y registra repositorios que existen pero la herramienta no conoce. | Admin |

- **Estancada:** una OVA *en curso* (no entregada) sin ningún push desde hace **10 días o más**. Los datos salen de GitHub (una consulta GraphQL por cada 100 repositorios) y se reutilizan 3 minutos; si GitHub falla o tarda, las pantallas funcionan igual y avisan de que no hay datos.
- **Carga:** la carga de una persona son sus OVAs *activas* (en desarrollo + en revisión); las entregadas no cuentan. Se compara con el promedio de **todos** los desarrolladores del catálogo, incluidos los que no tienen OVAs: «Carga alta» es tener al menos 1,5 veces el promedio y 2 OVAs más; «Con hueco», la mitad o menos y 2 menos. Con promedios chicos una diferencia de 1 no se marca.
- **Reasignar en lote:** en *Carga*, abre «Ver y reasignar» de una persona, marca las OVAs (o «Marcar todas»), elige a quién pasarlas y pulsa *Reasignar*. Hasta 200 por vez. Solo cambia quién la lleva en el registro (GitHub no se toca); cada OVA queda anotada en la actividad con quién lo hizo. Si alguna ya no existe se informa y las demás se cambian igual.
- **Mi trabajo** necesita que la persona esté vinculada a un desarrollador: en Administración, el campo «Usuario de GitHub» de cada desarrollador. Un usuario solo puede estar vinculado a un desarrollador por proyecto.
- **Reparar** solo *añade*: nunca quita topics ni baja el permiso de un team. Corrige por tandas de 25 para no saturar a GitHub; se repite hasta que no quede ninguna. Un repositorio que GitHub creó pero respondió con error se puede registrar ahí con su escuela y desarrollador.
- Las bases de datos existentes se actualizan solas al arrancar (columnas `status`, `status_changed_at` y `github_login`); todas las OVAs previas quedan «En desarrollo».

## Copias de seguridad

Toda la información de la herramienta (proyectos, usuarios, OVAs, actividad) vive en un único archivo SQLite (`DATABASE_PATH`). La herramienta lo copia sola, con la API de respaldo de SQLite: la copia es consistente **aunque la base esté en uso**, se comprueba (integridad y esquema) antes de darla por buena y queda como un solo archivo `ova-AAAA-MM-DDTHH-MM-SSZ.db` (hora UTC).

| Variable | Por defecto | Qué hace |
|---|---|---|
| `BACKUP_DIR` | `backups` junto a la base | Carpeta de las copias |
| `BACKUP_INTERVAL_HOURS` | `24` | Cada cuántas horas se copia sola. `0` = sin copias automáticas |
| `BACKUP_KEEP` | `14` | Cuántas se conservan; las más antiguas se borran |

- La comprobación se hace cada 30 minutos mientras la herramienta está en marcha (empieza con la primera petición tras arrancar) y solo copia si la última tiene más de `BACKUP_INTERVAL_HOURS` horas. Al reiniciar no se duplica.
- Un super administrador ve el estado en la pantalla de **Proyectos** («Copias de seguridad»), puede hacer una copia en el momento y ve si la última automática falló. Un fallo nunca detiene la herramienta.
- Solo se borran archivos con el nombre de las copias; el resto de la carpeta no se toca.
- **Una copia en el mismo disco no protege de perder el disco.** Pon `BACKUP_DIR` en otro disco o en una carpeta que ya se respalde fuera del servidor.
- El `.env.local` (token y secretos) **no** va en las copias: guárdalo aparte.

**Restaurar** (con la herramienta detenida):

```bash
node scripts/restore-backup.cjs data/backups/ova-2026-11-06T10-05-09Z.db
```

Comprueba la copia, deja la base actual junto a ella como `ova.db.antes-de-restaurar-<fecha>` y pone la copia en su lugar (`--db <ruta>` para otra base). Después vuelve a arrancar.

## Exportar e importar un proyecto

Un proyecto completo (ajustes, escuelas, desarrolladores, OVAs con su estado y fechas, usuarios con su rol y toda la actividad) cabe en **un archivo JSON**. Sirve para pasarlo a otra instalación de la herramienta, recuperarlo o tener una copia legible. Solo lo hacen los **super administradores**, porque el archivo incluye a los usuarios.

- **Exportar:** en el proyecto → *Proyecto* (ajustes) → «Exportar proyecto». Descarga `<proyecto>-proyecto-AAAA-MM-DD.json`.
- **Importar:** en *Proyectos* → «Importar proyecto», eligiendo el archivo (hasta 8 MB).

Qué hay que saber al importar:

- **Siempre crea un proyecto nuevo**: nunca mezcla ni sobrescribe uno existente. La organización de GitHub debe ser única, así que no se puede importar un proyecto cuya organización ya está registrada aquí (sirve para otra instalación o tras vaciar la base). Si el *identificador* ya está en uso, se puede elegir otro en el formulario.
- **Todo o nada**: el archivo se valida entero antes de guardar nada (formatos, repetidos, escuelas y desarrolladores que no existen, enlaces que no sean https…) y se guarda en una sola transacción. Si algo falla, se indica dónde (p. ej. «ovas[12].status») y no queda nada a medias.
- La herramienta debe poder ver la organización del archivo con su token.
- **Los usuarios conservan su rol, pero entran sin verificar**: recuperan el acceso al iniciar sesión, cuando se comprueba que siguen en la organización. El archivo no puede dar acceso por sí solo.
- **GitHub no se toca**: los repositorios deben existir ya; lo que falte se corrige desde *Reparar*.
- El archivo **no** lleva secretos ni el `.env.local`, pero sí los usuarios y el historial: guárdalo con cuidado.

## Datos de cada OVA

Al llegar una OVA se conocen solo tres datos:

| Dato | Se refleja en GitHub como |
|---|---|
| Nombre | nombre del repositorio (normalizado: `GR 2_88-2027-1` → `GR-2-88-2027-1`) |
| Escuela | topic |
| Desarrollador | se guarda en el registro (SQLite); **no** es un team (ver abajo) |

Todo repo nuevo recibe además:

- **Descripción:** `625 OVAs 2027 - {repo} {emoji aleatorio}`, p. ej. `625 OVAs 2027 - GR-2-88-2027-1 🚀`. El prefijo es configurable.
- **Team `Frontend` con permiso `push` (Write en GitHub):** agrupa a todos los desarrolladores de la organización, así que el mismo team se asigna a cada OVA.
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
- [x] Descripción con prefijo configurable y team por defecto (`Frontend`, `push`) en el caso de uso
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
- Team: uno solo (`Frontend`, `push`) para todas las OVAs; no hay un team por desarrollador.
- Cada OVA tiene **un** desarrollador y **una** escuela.

- El permiso de escritura de cada desarrollador se gestiona **fuera** de la herramienta. Aquí el desarrollador es solo un dato del registro (quién lleva cada OVA); la herramienta no le da permisos en GitHub.

## Pendiente por confirmar

Nada por ahora.
