# ARCHIVE REPORT — CarnIA

> Informe histórico de la auditoría del 22/07/2026. Varios pendientes que lista aquí se resolvieron después; consulta [`CHANGELOG.md`](../CHANGELOG.md).

Fecha de cierre: **22 de julio de 2026**  
Destino limpio: `carnia_ARCHIVO_LIMPIO_2026-07-22`  
Archivo: `carnia_ARCHIVO_LIMPIO_2026-07-22.zip`

## Veredicto

CarnIA queda **operativo, compilable, probado y restaurable para continuar el desarrollo**. No se declara listo para exposición pública sin trabajo adicional: la autenticación HTTP necesita rate limiting, los tokens web persisten en `localStorage`, falta lint real fuera de la web y las sesiones Solo son locales al proceso.

La copia limpia conserva código, contratos, assets, migraciones, seed, tests, lockfile, configuraciones de desarrollo/despliegue y documentación. No contiene dependencias instaladas, builds, cachés, logs del navegador ni archivos `.env` reales.

## Estado inicial y protección del original

- Se trabajó únicamente dentro de este proyecto y en una copia de archivo separada.
- No existía `.git`: no había rama, commits ni estado de cambios que pudieran usarse como punto de restauración. No se creó, reescribió ni publicó historial.
- Antes de cambios se creó una instantánea de comparación temporal, excluyendo secretos y artefactos regenerables: 159 archivos, aproximadamente 1,2 MB. La carpeta completa ocupaba aproximadamente 789 MB, principalmente por `node_modules`.
- No se ejecutaron `git reset`, `git clean` ni sustituciones destructivas del proyecto original.
- La base local de Docker era estado externo al proyecto. Al cierre contenía cuatro usuarios locales, dos no pertenecientes a los fixtures demo, y refresh tokens; no se incluyó para evitar archivar hashes/tokens y porque la base funcional se reconstruye mediante migraciones + seed. Si esos datos de prueba fueran importantes, deben exportarse por separado desde el volumen local antes de eliminarlo.

## Inventario y clasificación

| Categoría | Contenido conservado |
| --- | --- |
| Código esencial | `apps/api/src`, `apps/web/src`, `packages/*/src` |
| Configuración | manifests, lockfile, TypeScript, Next, Nest, Turbo, pnpm, Docker Compose |
| Datos y esquema | Prisma schema, tres migraciones y seed de 220 preguntas/880 opciones |
| Tests | 28 tests Vitest de engine, ELO y anti-cheat |
| Assets | CSS, favicon SVG y assets usados desde `apps/web/src` |
| Documentación | `README.md`, este informe y `docs/DEPLOY.md` |
| Despliegue | Dockerfile API, Railway, Fly y Vercel |
| Ejemplos seguros | `.env.example` de raíz, API, web y DB |

No se detectaron binarios fuente grandes ni recursos imprescindibles fuera de estas rutas. El tamaño observado provenía de dependencias, `.next`, `dist` y cachés. No había dumps, archivos comprimidos de producto, modelos, audio o vídeo que debieran conservarse.

## Diagnóstico y reparaciones realizadas

1. **Seed destructivo y no idempotente.** Borraba opciones y después fallaba al borrar preguntas referenciadas por `MatchAnswer`, dejando una base parcial. Ahora identifica preguntas por fuente + prompt, actualiza sin borrar historial, restaura opciones solo si faltan y genera IDs deterministas.
2. **Schema adelantado a las migraciones.** El enum Prisma tenía siete categorías sin migración; el seed fallaba en `LIGHTING`. Se añadió `20260722143000_add_question_categories`. La comparación DB/schema terminó sin diferencias.
3. **Modo Solo devolvía 500.** Un pipe a nivel de método validaba también `CurrentUser` con el schema del body y eliminaba `userId`. Los pipes Zod quedaron ligados únicamente a cada `@Body`, también en auth.
4. **Diagnóstico HTTP opaco.** El filtro global ahora registra la excepción y el stack reales sin exponer detalles internos al cliente.
5. **Compatibilidad NestJS 11.** Se actualizó Nest y el wildcard del request logger se adaptó a `path-to-regexp` moderno (`{*path}`), eliminando el warning de arranque.
6. **Next/React obsoletos con avisos de seguridad.** Se migró de Next 14/React 18 a Next 15.5.18/React 19.1.2, se adaptaron rutas dinámicas a `useParams`, `typedRoutes` y el script ESLint vigente.
7. **Dependencias vulnerables.** Nest, JWT, Passport y transitivas afectadas se actualizaron o fijaron mediante overrides. `pnpm audit --prod` terminó con cero vulnerabilidades conocidas.
8. **Imágenes remotas arbitrarias.** Se centralizó el uso intencional de `<img>` en `ExternalImage`; no se abrió una allowlist global insegura para hosts elegidos por usuarios. El lint web termina sin warnings.
9. **Hook de ronda PvP.** La dependencia del efecto usa un índice escalar estable, evitando reejecuciones por identidad de objeto.
10. **Inconsistencias visibles.** Daily muestra la etiqueta humana de la categoría; PvP ofrece las 20 categorías compartidas; la sala describe correctamente que copia el código.
11. **Favicon ausente.** Se añadió `icon.svg`; producción responde 200 y la consola del navegador quedó en 0 errores/0 warnings.
12. **Configuración local incorrecta.** El puerto PostgreSQL del ejemplo raíz se corrigió a 5433 y se añadió el `.env.example` que Prisma necesita en `packages/db`.
13. **Imagen Docker arrancaba rota.** El build original omitía `node_modules` de contracts y la reinstalación productiva quedaba expuesta a un prompt; el contenedor fallaba con `Cannot find module 'zod'`. Se hizo la instalación no interactiva, se conservó Prisma como dependencia runtime y se copiaron las dependencias aisladas necesarias. El contenedor final arrancó y pasó readiness.
14. **Documentación de recuperación.** El README se reescribió con versiones, comandos, variables, limitaciones y flujo de restauración reales; `.nvmrc`, `.gitignore` y `.dockerignore` se endurecieron.

## Verificación ejecutada

| Comprobación | Resultado real |
| --- | --- |
| Instalación | `pnpm@9.0.0 install --frozen-lockfile`: superada |
| Formato del parche | Prettier check: superado |
| Lint | 4/4 tareas; ESLint web sin warnings. API/DB/contracts solo tienen scripts testimoniales |
| TypeScript | 6/6 tareas, caché forzada: superado |
| Tests | 3 archivos, 28/28 tests: superado |
| Build | 4/4 tareas; Next generó 18 rutas: superado |
| Dependencias | `pnpm audit --prod`: 0 info/low/moderate/high/critical |
| Servicios | PostgreSQL 16 y Redis 7 healthy |
| Migraciones | 3 encontradas, 0 pendientes; diff schema/DB vacío |
| Seed | ejecutado dos veces seguidas; 220 preguntas, 880 opciones, 0 prompts duplicados |
| API producción | liveness y readiness 200; Postgres y Redis `ok` |
| Web producción | inicio correcto; `/icon.svg` 200 |
| Navegador | login, Solo, Daily, Study y PvP real con dos sesiones; consola final 0 errores/0 warnings |
| Docker API | imagen multi-stage construida; contenedor real arrancado; readiness 200 |
| Restauración limpia | instalación, validaciones y build repetidos desde una extracción temporal del contenido archivado |

El flujo PvP se probó con dos contextos independientes: creación y unión por código, presencia de ambos jugadores, ready, countdown y navegación sincronizada al mismo match. El modo Solo se inició, respondió y mostró explicación/puntuación. No se simuló un resultado no observado.

## Contenido excluido deliberadamente

- `node_modules` de raíz y workspaces.
- `.next`, `dist`, `.turbo`, `coverage`, `out`, `build` y `*.tsbuildinfo`.
- `.playwright-cli`, logs, snapshots temporales, `.DS_Store` y archivos de IDE.
- Todos los `.env`, `.env.local` y variantes locales; solo se conservan `.env.example`.
- Volúmenes e imágenes Docker, la base local y la instantánea temporal de trabajo.
- El ZIP no se incluye dentro de sí mismo ni dentro de la carpeta limpia.

Todo lo excluido es regenerable, local, temporal o sensible. El lockfile sí se conserva.

## Seguridad y secretos

La copia y el ZIP se inspeccionaron por nombres de archivos y patrones habituales de tokens, claves privadas, contraseñas y URLs con credenciales. Solo permanecen placeholders de ejemplo y credenciales locales documentadas de Docker/fixtures. No se detectaron claves privadas ni secretos de proveedor.

Los valores `carnia/carnia`, `carnia123` y `change-me-*` son exclusivamente ejemplos locales. Antes de un despliegue real deben sustituirse, eliminarse las cuentas demo y rotarse cualquier secreto que haya sido usado fuera de local.

## Pendientes y riesgos conocidos

Prioridad alta antes de Internet público:

- añadir rate limiting/lockout a register, login y refresh HTTP; el limitador actual cubre eventos Socket.IO;
- mover access/refresh tokens desde `localStorage` a cookies `HttpOnly`, `Secure`, `SameSite` con protección CSRF adecuada;
- definir backup, restore y retención para PostgreSQL;
- verificar las configuraciones Railway/Fly/Vercel contra sus interfaces vigentes.

Prioridad media:

- incorporar ESLint real en API, contracts y DB;
- versionar una suite E2E para los flujos probados manualmente;
- persistir o externalizar sesiones Solo y caché si se usan varias instancias;
- añadir CI que ejecute instalación bloqueada, lint, tipos, tests, build y audit;
- revocar sesiones activas al cambiar contraseña y cubrirlo con tests.

No se modificaron estos puntos porque implican decisiones de seguridad/arquitectura mayores que una reparación localizada y no bloquean la restauración local validada.

## Cómo retomar el proyecto

1. Extrae el ZIP y verifica su SHA-256 con el valor entregado junto al archivo.
2. Lee primero este informe y después `README.md`.
3. Instala Node 20, activa Corepack y usa pnpm 9.
4. Copia los cuatro `.env.example` a las ubicaciones documentadas; genera secretos nuevos si no es local.
5. Levanta Docker, aplica `migrate:deploy`, ejecuta el seed y pasa los checks.
6. Continúa el desarrollo desde la carpeta extraída; crea un repositorio Git antes de nuevos cambios si quieres historial.

El SHA-256 del ZIP se entrega fuera del propio ZIP para evitar una dependencia circular: insertar su hash dentro cambiaría el hash del archivo.
