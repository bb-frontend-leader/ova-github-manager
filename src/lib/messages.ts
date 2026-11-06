/**
 * Traduce los errores del núcleo (en inglés, pensados para logs y tests) a mensajes para la
 * persona usuaria: qué pasó, por qué y qué hacer. Lo desconocido se muestra tal cual, recortado.
 */

type Rule = [test: RegExp, message: (match: RegExpMatchArray) => string];

const RULES: Rule[] = [
  // Nombre de la OVA
  [/^Repository name cannot be empty/, () => 'Escribe el nombre de la OVA.'],
  [
    /^Repository name can only contain/,
    () => 'El nombre solo puede llevar letras, números y guiones. Quita los símbolos o los acentos.',
  ],
  [/^Repository name cannot start or end/, () => 'El nombre no puede empezar ni terminar con un guion.'],
  [/^Repository name must be between/, () => 'El nombre es demasiado largo. Usa 255 caracteres o menos.'],
  [
    /name already exists|already exists on this account|OVA already registered: (.+)/i,
    () => 'Ya existe un repositorio con ese nombre en la organización. Cambia el nombre e inténtalo de nuevo.',
  ],

  // GitHub
  [
    /Failed to authenticate with GitHub/,
    () => 'GitHub rechazó el token de la herramienta. Avisa a un administrador para que lo renueve.',
  ],
  [
    /Access denied or organization/,
    () => 'La herramienta no tiene acceso a la organización. Avisa a un administrador para revisar el token.',
  ],
  [
    /Failed to create repository: (.*(Not Found|template).*)/i,
    () =>
      'GitHub no encontró la plantilla de OVA. Revisa que el repositorio plantilla exista y esté marcado como "Template repository".',
  ],
  [
    /Failed to create repository: (.+)/,
    (m) => `GitHub no pudo crear el repositorio: ${m[1]}`,
  ],

  [
    /GitHub returned no repositories/,
    () => 'GitHub no devolvió ningún repositorio, así que no se cambió nada. Revisa el token de la herramienta.',
  ],
  [
    /Failed to list repositories|Failed to check repository/,
    () => 'No se pudo consultar GitHub. Inténtalo de nuevo en unos minutos.',
  ],

  [
    /Failed to read repository health|Failed to list repositories of team/,
    () => 'No se pudo consultar la actividad de los repositorios en GitHub. Inténtalo de nuevo en unos minutos.',
  ],
  [/The template repository cannot be registered/, () => 'Ese repositorio es la plantilla de OVAs, no se puede registrar como una OVA.'],
  [/^Repository not found/, () => 'Ese repositorio no existe en GitHub. Puede que lo hayan borrado o renombrado.'],
  [/^Invalid OVA status/, () => 'Elige un estado de la lista.'],
  [/^GitHub user already linked: (.+)/, (m) => `@${m[1]} ya está vinculado a otro desarrollador de este proyecto.`],
  [/^OVA not found/, () => 'Esa OVA ya no existe en el registro. Vuelve al panel y actualiza la lista.'],
  [
    /Failed to (set|read) topics/,
    () => 'GitHub no permitió actualizar el topic del repositorio, así que no se cambió nada. Comprueba que el repositorio siga existiendo y que la herramienta tenga permiso.',
  ],
  [/^School or developer does not exist/, () => 'La escuela o el desarrollador elegido ya no existe. Recarga la página.'],

  // Catálogo
  [/^School name cannot be empty/, () => 'Escribe el nombre de la escuela.'],
  [/^School name cannot exceed (\d+)/, (m) => `El nombre de la escuela admite hasta ${m[1]} caracteres.`],
  [/^School name must contain letters/, () => 'El nombre de la escuela debe llevar letras o números.'],
  [/^School name is too long/, () => 'El nombre de la escuela es demasiado largo para usarse como topic de GitHub.'],
  [/^School already exists: (.+)/, (m) => `La escuela "${m[1]}" ya existe.`],
  [/^Developer name cannot be empty/, () => 'Escribe el nombre del desarrollador.'],
  [/^Developer name cannot exceed (\d+)/, (m) => `El nombre del desarrollador admite hasta ${m[1]} caracteres.`],
  [/^Developer already exists: (.+)/, (m) => `El desarrollador "${m[1]}" ya existe.`],

  // Proyectos
  [/^Project name cannot be empty/, () => 'Escribe el nombre del proyecto.'],
  [/^Project name cannot exceed (\d+)/, (m) => `El nombre del proyecto admite hasta ${m[1]} caracteres.`],
  [/^Organization cannot be empty/, () => 'Escribe la organización de GitHub.'],
  [
    /^Invalid GitHub organization: (.+)/,
    (m) => `"${m[1]}" no es una organización de GitHub válida. Usa letras, números y guiones sueltos.`,
  ],
  [
    /^Invalid project identifier: (.+)/,
    (m) => `El identificador "${m[1]}" no es válido. Usa minúsculas, números y guiones.`,
  ],
  [/^Project identifier is reserved: (.+)/, (m) => `El identificador "${m[1]}" está reservado. Elige otro.`],
  [/^Project total must be/, () => 'El objetivo de OVAs debe ser un número entero entre 1 y 100000.'],
  [
    /^(Template|Team|Description prefix) cannot (be empty|exceed)/,
    (m) => `Revisa el campo "${m[1]}": no puede quedar vacío ni ser demasiado largo.`,
  ],
  [
    /^Organization already registered: (.+)/,
    (m) => `La organización "${m[1]}" ya es un proyecto de la herramienta.`,
  ],
  [
    /^Project already exists: (.+)/,
    (m) => `Ya existe un proyecto con el identificador "${m[1]}". Cambia el nombre o el identificador.`,
  ],
  [/^Project not found/, () => 'Ese proyecto ya no existe.'],

  // Usuarios
  [/^GitHub username cannot be empty/, () => 'Escribe el usuario de GitHub.'],
  [
    /^Invalid GitHub username: (.+)/,
    (m) => `"${m[1]}" no es un usuario de GitHub válido. Usa solo letras, números y guiones.`,
  ],
  [/^User already exists: (.+)/, (m) => `@${m[1]} ya está autorizado. Cambia su rol desde la tabla.`],
  [/^User not found: (.+)/, (m) => `No se encontró a @${m[1]}.`],
  [
    /^Cannot remove the last admin/,
    () => 'Debe quedar al menos un administrador. Nombra a otro antes de cambiar este rol.',
  ],
  [/^Invalid role/, () => 'Elige un rol de la lista.'],
];

export function translateError(error: unknown, fallback = 'Ocurrió un error inesperado. Inténtalo de nuevo.'): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!raw) return fallback;
  for (const [test, message] of RULES) {
    const match = raw.match(test);
    if (match) return message(match);
  }
  return raw.slice(0, 200);
}
