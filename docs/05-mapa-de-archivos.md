# Mapa de archivos del repositorio

> Objetivo: explicar **qué hace**, **para qué existe** y **dónde encaja** cada archivo del proyecto.

## Raíz

- `README.md`: guía de uso rápido y puesta en marcha.
- `DOCUMENTACION_TECNICA.md`: documentación técnica histórica del proyecto.
- `LICENSE`: licencia del repositorio.
- `package.json`: scripts, dependencias y metadatos del proyecto.
- `package-lock.json`: bloqueo de versiones npm.
- `tsconfig.json`: configuración TypeScript.
- `eslint.config.ts`: reglas de lint del código.
- `prisma.config.ts`: configuración de Prisma (schema, datasource, seed).
- `process.excalidraw`: diagrama visual de apoyo para arquitectura/proceso.

## Carpeta `docs/`

- `docs/README.md`: índice de documentación funcional.
- `docs/01-arquitectura-general.md`: arquitectura general y decisiones.
- `docs/02-webhooks-y-seguridad.md`: módulo de webhooks y seguridad.
- `docs/03-sistema-posts-blog.md`: sistema editorial de publicaciones.
- `docs/04-inactividad-y-estadisticas.md`: inactividad, recordatorios y métricas.
- `docs/05-mapa-de-archivos.md`: este mapa completo.
- `docs/06-oauth-y-autenticacion.md`: sistema OAuth 2.0 con PKCE e integración Discord.

## Scripts

- `scripts/copydb.ts`: copia datos de una BD productiva a local para pruebas/migración.

## Núcleo (`src/`)

- `src/index.ts`: punto de entrada; arranca API, servicios y ciclo de vida.
- `src/client.ts`: inicializa cliente Discord y despliegue de comandos.
- `src/config.ts`: carga/valida variables de entorno y constantes globales.
- `src/logger.ts`: logger central (pino).
- `src/types.d.ts`: extensiones de tipos globales (ej. request user en middleware).

## API HTTP (`src/api/`)

- `src/api/server.ts`: servidor Express, CORS y montaje de rutas.
- `src/api/errors.ts`: jerarquía de errores HTTP reutilizable.
- `src/api/webhook-auth.middleware.ts`: autenticación + firma para webhooks.

### OAuth 2.0

- `src/api/oauth/authorize/route.ts`: iniciar flujo OAuth y presentar consentimiento.
- `src/api/oauth/token/route.ts`: intercambiar authorization_code por tokens.
- `src/api/oauth/refresh/route.ts`: renovar access_token usando refresh_token.
- `src/api/oauth/me/route.ts`: obtener información del usuario autenticado.
- `src/api/oauth/discord/route.ts`: integración con Discord OAuth.

### API v1

- `src/api/v1/route.ts`: agregador de rutas v1.
- `src/api/v1/members/route.ts`: router de `/v1/members`.
- `src/api/v1/members/get.ts`: handler de listado enriquecido de miembros.
- `src/api/v1/posts/route.ts`: router de `/v1/posts`.
- `src/api/v1/posts/get.ts`: handler de listado enriquecido de posts.
- `src/api/v1/games/[game]/route.ts`: router de games (Minecraft players).

### Webhooks

- `src/api/webhooks/route.ts`: agregador de rutas webhook.
- `src/api/webhooks/digs/route.ts`: webhook para actualizar `digs` (POST).
- `src/api/webhooks/link/route.ts`: webhook para vinculación Discord↔Minecraft (POST).
- `src/api/webhooks/join/route.ts`: webhook para registrar logins de jugadores (POST).

## Interacciones Discord (`src/interactions/`)

- `src/interactions/commands.ts`: definición y registro de slash commands.

### Comandos

- `src/interactions/commands/inactividad.command.ts`: comando administrativo de inactividad.
- `src/interactions/commands/dis-session.command.ts`: crea código temporal de vinculación.

### Botones

- `src/interactions/buttons/inactivity.ts`: botones de autogestión de inactividad.
- `src/interactions/buttons/wh-add.ts`: abre modal para crear token de webhook.
- `src/interactions/buttons/wh-delete.ts`: abre confirmación para eliminar token.

#### Blog

- `src/interactions/buttons/blog/blog-create.ts`: inicia creación de borrador.
- `src/interactions/buttons/blog/blog-title.ts`: modifica título del post.
- `src/interactions/buttons/blog/blog-post.ts`: cambia estado del post (publicar/despublicar).

#### Roles

- `src/interactions/buttons/role/role-create.ts`: crea rol Minecraft.
- `src/interactions/buttons/role/role-edit.ts`: renombra rol Minecraft.
- `src/interactions/buttons/role/role-delete.ts`: elimina rol Minecraft.
- `src/interactions/buttons/role/role-select.ts`: selecciona rol para vista detallada.
- `src/interactions/buttons/role/role-page.ts`: paginación en vista de rol.
- `src/interactions/buttons/role/role-back.ts`: vuelve a vista principal del panel de roles.
- `src/interactions/buttons/role/role-add.ts`: agrega rol a jugador seleccionado.
- `src/interactions/buttons/role/role-remove.ts`: quita rol a jugador.

### Menús select

- `src/interactions/stringMenu/role.ts`: selector de jugador para panel de roles.
- `src/interactions/stringMenu/role-add.ts`: selector para añadir roles a jugador.
- `src/interactions/stringMenu/role-mode.ts`: selector de modo/vista del panel de roles.

### Modales

- `src/interactions/modals/inactive.ts`: procesa alta/edición de inactividad.
- `src/interactions/modals/webhook-add.ts`: crea token y devuelve credenciales.
- `src/interactions/modals/webhook-delete.ts`: confirma borrado de token.
- `src/interactions/modals/role-create.ts`: crea rol desde formulario.
- `src/interactions/modals/role-edit.ts`: edita nombre de rol.
- `src/interactions/modals/blog/blog-create.ts`: captura título para nuevo borrador (max 100 caracteres).
- `src/interactions/modals/blog/blog-title.ts`: edita título del post existente.

## Servicios (`src/services/`)

- `src/services/interactions.service.ts`: carga dinámica y router de interacciones.
- `src/services/inactivity.service.ts`: CRUD de inactividad y despliegue de panel.
- `src/services/monitored.service.ts`: roles monitorizados y snapshots.
- `src/services/scheduler.ts`: jobs recurrentes (recordatorios + snapshots).
- `src/services/webhook.service.ts`: panel de administración de tokens webhook con permisos granulares.
- `src/services/digs.service.ts`: sincronización periódica de estadística de minería.
- `src/services/rank.service.ts`: sincroniza rango Minecraft según roles Discord.
- `src/services/roles.service.ts`: panel y operaciones de roles Minecraft (filtra jugadores ACTIVE).
- `src/services/blog.service.ts`: panel y flujo de publicaciones/blog con ciclo de vida (DRAFT → PUBLISHED → OUTDATED).
- `src/services/players.service.ts`: gestiona los players y su estado, marca como DELETED en baneos.

## Clases de dominio (`src/classes/`)

- `src/classes/player.ts`: entidad de jugador Minecraft enlazado.
- `src/classes/players-manager.ts`: gestor/cache de jugadores.
- `src/classes/minecraft-role.ts`: entidad de rol Minecraft y asignaciones.
- `src/classes/minecraft-roles-manager.ts`: gestor/cache de roles Minecraft.
- `src/classes/post.ts`: entidad de publicación y sus transiciones.
- `src/classes/posts-manager.ts`: gestor/cache de publicaciones.

## Utilidades (`src/utils/`)

- `src/utils/time.ts`: parseo/formateo de fechas y duraciones.
- `src/utils/format.ts`: helpers de pluralización, IDs, paginación y listados.
- `src/utils/response.ts`: resultado tipado simple (`ok/err`).
- `src/utils/roles.ts`: cálculo de rango por jerarquía de roles Discord.
- `src/utils/encript.ts`: cifrado/descifrado de secretos (AES-GCM).
- `src/utils/polifill.ts`: polyfills necesarios en runtime.

## Prisma y datos (`src/prisma/`)

- `src/prisma/database.ts`: cliente Prisma compartido.
- `src/prisma/schema.prisma`: modelo de datos de toda la aplicación.
- `src/prisma/schema.erd`: diagrama entidad-relación.
- `src/prisma/seed.ts`: siembra/verificación de rol por defecto.

### Migraciones

- `src/prisma/migrations/migration_lock.toml`: lock de motor de migraciones.
- `src/prisma/migrations/20251231000230_init/migration.sql`: base inicial del esquema.
- `src/prisma/migrations/20251231011118_add_rank/migration.sql`: cambios iniciales de rango.
- `src/prisma/migrations/20251231014040_discord_code/migration.sql`: ajustes de códigos Discord.
- `src/prisma/migrations/20260107232913_webhook_tokens/migration.sql`: tablas/campos de tokens webhook.
- `src/prisma/migrations/20260108014222_token_name/migration.sql`: normalización de nombre de token.
- `src/prisma/migrations/20260120042444_states/migration.sql`: estado persistente para paneles.
- `src/prisma/migrations/20260120052250_at/migration.sql`: cambios de timestamps/fechas.
- `src/prisma/migrations/20260120061112_uq_token/migration.sql`: restricción única de token.
- `src/prisma/migrations/20260121013517_uq_nick/migration.sql`: unicidad de nickname Minecraft.
- `src/prisma/migrations/20260125034645_mc_rank/migration.sql`: ajustes de rango en usuario Minecraft.
- `src/prisma/migrations/20260202222436_remove_rank_from_discord/migration.sql`: remueve rango en tabla Discord.
- `src/prisma/migrations/20260202234919_discord_user_username/migration.sql`: campo username en usuario Discord.
- `src/prisma/migrations/20260202235832_uq_discord_username/migration.sql`: unicidad para username Discord.
- `src/prisma/migrations/20260301230127_blog/migration.sql`: estructura para posts/blog.
- `src/prisma/migrations/20260308062159_player_status/migration.sql`: enum PLAYER_STATUS para soft delete (ACTIVE, DELETED).
- `src/prisma/migrations/20260314152500_last_seen/migration.sql`: campo `last_seen` (Datetime?) para tracking de login.
- `src/prisma/migrations/20260430073735_oauth_prepare/migration.sql`: sistema OAuth 2.0 completo (tablas users, clients, authorization_codes, sessions).
