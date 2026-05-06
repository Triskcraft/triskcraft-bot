# Documentación técnica exhaustiva: Bot de inactividad

> Alcance: este documento describe el funcionamiento interno del bot y su API
> HTTP, explicando cada módulo y bloque funcional relevante del proyecto.

## Tabla de contenido

1. [Resumen ejecutivo](#resumen-ejecutivo)
2. [Convención de versionado](#convención-de-versionado)
3. [API HTTP v1](#api-http-v1)
4. [Webhooks y seguridad](#webhooks-y-seguridad)
5. [OAuth y autenticación](#oauth-y-autenticación)
6. [Flujo de arranque y apagado](#flujo-de-arranque-y-apagado)
7. [Configuración y dependencias](#configuración-y-dependencias)
8. [Componentes de Discord (clientes, interacciones y comandos)](#componentes-de-discord-clientes-interacciones-y-comandos)
9. [Servicios de dominio](#servicios-de-dominio)
10. [Scheduler y jobs recurrentes](#scheduler-y-jobs-recurrentes)
11. [Persistencia y Prisma](#persistencia-y-prisma)
12. [Utilidades comunes](#utilidades-comunes)
13. [Ejemplos de uso actualizados](#ejemplos-de-uso-actualizados)

---

## Resumen ejecutivo

El proyecto implementa un bot administrativo de Discord con un panel de
autogestión de inactividad, comandos para administradores y una API HTTP de
solo lectura. La arquitectura separa:

- **Capa de integración Discord**: cliente, panel interactivo, comandos.
- **Servicios de dominio**: reglas de negocio para inactividad, roles y
  snapshots.
- **API HTTP**: endpoints versionados bajo `/v1`.
- **Persistencia**: Prisma + PostgreSQL.
- **Scheduler**: jobs periódicos para recordatorios y estadísticas.

---

## Convención de versionado

### Versión de la API

- **Estrategia**: versionado por URL (`/v1`).
- **Motivación**: permite cambios incompatibles sin romper clientes existentes.
- **Estado actual**: la API publicada es **v1** (`/v1/members`).

### Versión del proyecto (runtime)

- **Estrategia**: SemVer (por ejemplo `1.0.0` en `package.json`).
- **Interpretación**:
    - **MAJOR**: cambios de comportamiento o contratos que rompen compatibilidad
      (por ejemplo, un cambio de schema o de payload en API v1).
    - **MINOR**: nuevas funcionalidades compatibles.
    - **PATCH**: correcciones sin cambios de contrato.

### Versionado de base de datos

- **Mecanismo**: migraciones de Prisma (cuando se ejecutan). El schema actual
  define las tablas necesarias para inactividad, roles y vinculación de
  usuarios.

---

## API HTTP v1

### Base URL

```
/v1
```

### Endpoint: `GET /v1/members`

Entrega la lista de jugadores de Minecraft enriquecida con datos de Discord, roles, rangos y medios.

**Origen de datos**

- Modelo `Player` mapeado a la tabla `minecraft_users`.
- Relaciones con `DiscordUser`, `Media`, `LinkedRole` y `Role`.

**Respuesta**

- Formato JSON, con caché pública de 24 horas:
    - Header: `Cache-Control: public, max-age=86400`

**Modelo de respuesta**

```json
[
    {
        "description": "Texto libre",
        "digs": 123,
        "mc_name": "nombre-en-mc",
        "mc_uuid": "uuid",
        "medias": [{ "type": "youtube", "url": "https://..." }],
        "rank": "Miembro",
        "roles": ["Builder", "Streamer"]
    }
]
```

### Endpoint: `GET /v1/posts`

Entrega el listado de publicaciones de blog con estado y metadatos de autor.

**Origen de datos**

- Modelo `Post` con relación a `DiscordUser` y datos opcionales de `Player`.

### Endpoint: `GET /v1/games/minecraft/players`

Devuelve información de los jugadores activos de Minecraft para integraciones externas.

**Características**

- Incluye nombre, UUID, `digs`, `rank` y estado `PLAYER_STATUS`.
- Solo jugadores con estado `ACTIVE` se consideran activos.

### Notas técnicas

- Los endpoints v1 están montados en `src/api/v1/route.ts`.
- Cada ruta utiliza Prisma para cargar relaciones necesarias y devolver datos estructurados.
- Los modelos mapean tablas con nombres personalizados usando `@@map`.

---

## Webhooks y seguridad

La API de webhooks expone rutas que reciben eventos externos del servidor Minecraft y servicios asociados.

### Endpoints de webhook

- `POST /webhooks/digs`
    - Actualiza los contadores `digs` de jugadores.
    - Procesamiento por lote y consolidación periódica para reducir escrituras.
- `POST /webhooks/link`
    - Vincula cuentas Minecraft ↔ Discord usando un código temporal generado por `/dis-session`.
- `POST /webhooks/join`
    - Registra logins de jugadores y actualiza el campo `last_seen`.

### Seguridad de webhooks

- Middleware en `src/api/webhook-auth.middleware.ts` valida JWT y firma HMAC.
- Requiere `Authorization: Bearer <jwt>`, `x-timestamp` y `x-signature`.
- Valida permisos granulares de token (`DIGS`, `LINK`, `JOIN`).
- Protege contra replay attacks con ventana temporal y comparación segura.

---

## OAuth y autenticación

El sistema OAuth implementa un flujo de autorización con PKCE y refresh tokens para aplicaciones externas.

### Endpoints OAuth

- `GET /auth/oauth/authorize` - inicia el flujo de autorización.
- `POST /auth/oauth/token` - intercambia authorization code por tokens.
- `GET /auth/oauth/refresh` - renueva el access token.
- `GET /auth/oauth/me` - obtiene la información del usuario autenticado.
- `GET /auth/oauth/discord` - integración con Discord OAuth.

### Modelo de datos clave

- `User` - usuario canónico del sistema que une `DiscordUser` y `Player`.
- `Client` - aplicación OAuth autorizada con URIs de redirección.
- `AuthorizationCode` - códigos temporales con `code_challenge` para PKCE.
- `Session` - sesiones con `refresh_token` para renovar accesos.

### Flujo de autorización

1. El cliente genera `code_verifier` y `code_challenge`.
2. Redirige a `/auth/oauth/authorize` con `client_id`, `redirect_uri` y `code_challenge`.
3. El servidor valida el cliente y emite un authorization code.
4. El cliente intercambia el code en `/auth/oauth/token` enviando el `code_verifier`.
5. El servidor valida la firma PKCE y devuelve `access_token` + `refresh_token`.

### Seguridad OAuth

- PKCE evita que un authorization code interceptado sea reutilizado.
- `Client.redirect_uris` se valida estrictamente.
- `Session.refresh_token` está almacenado como valor único para revocación.
- `access_token` es un JWT firmado por el servidor.

---

## Flujo de arranque y apagado

### `src/index.ts`

1. **Inicialización de la API HTTP**
    - Levanta el servidor Express en `API_PORT`.
2. **Registro de handlers de Discord**
    - Conecta botones, modales y slash commands.
3. **Instancias de servicios**
    - `InactivityService`, `RoleService` y `Scheduler`.
4. **Despliegue opcional del panel**
    - Controlado por `DEPLOY_INACTIVITY_PANEL`.
5. **Inicio del scheduler**
    - Activa jobs periódicos.
6. **Apagado ordenado**
    - Detiene jobs, cierra Discord y desconecta Prisma en SIGINT/SIGTERM.

---

## Configuración y dependencias

### `src/config.ts`

**Bloques clave**

- **Carga de `.env`**: usa `process.loadEnvFile()`. Si no existe, loguea error.
- **`loadConfig()`**: valida variables obligatorias y advierte faltantes
  recomendadas.
- **`envs`**: objeto inmutable que concentra configuración runtime.
- **`RANK_ROLES`**: orden de prioridad para determinar el rango del usuario.

**Variables críticas**

- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`,
  `DISCORD_INACTIVITY_CHANNEL_ID`, `DISCORD_ADMIN_LOG_CHANNEL_ID`,

### `src/logger.ts`

- **Logger central**: `pino` con nivel configurable por `LOG_LEVEL`.
- **Modo desarrollo**: `pino-pretty` con timestamps legibles.

### `prisma.config.ts`

- **Define schema**: `src/db/schema.prisma`.
- **Datasource**: toma `DATABASE_PATH` desde `.env`.

---

## Componentes de Discord (clientes, interacciones y comandos)

### `src/client.ts`

**Bloques clave**

- **Instancia del cliente**: configura intents y partials necesarios para
  miembros, mensajes y reacciones.
- **Promise `ready`**: asegura que el bot esté listo antes de seguir.
- **Registro condicional de comandos**: se ejecuta si `DEPLOY_COMMAND=true`.
- **Login y exportación**: autentica con `DISCORD_TOKEN` y exporta `client`.

### `src/interactions/commands/inactividad.command.ts`

**Bloques clave**

- Define subcomandos para administración de inactividad.
- Permite listar, ver estadísticas y gestionar roles monitoreados.
- Se utiliza para operaciones de servidor desde Discord.

### `src/interactions/commands/dis-session.command.ts`

**Bloques clave**

- Genera código de vinculación temporal para el flujo Discord ↔ Minecraft.
- Crea o actualiza `LinkCode` y `DiscordUser` en la base de datos.
- Envía el código por DM y confirma en la interacción de Discord.

### Botones y modales

- `src/interactions/buttons/inactivity.ts` - botones de autogestión de inactividad.
- `src/interactions/buttons/wh-add.ts` - abre modal para crear tokens webhook.
- `src/interactions/buttons/wh-delete.ts` - confirma eliminación de token webhook.
- `src/interactions/buttons/blog/blog-create.ts` - inicia creación del borrador de post.
- `src/interactions/buttons/blog/blog-title.ts` - inicia edición del título del post.
- `src/interactions/buttons/blog/blog-post.ts` - publica, despublica o marca posts como obsoletos.
- `src/interactions/buttons/role/*.ts` - flow completo de creación, edición, selección,
  paginación y asignación de roles Minecraft.

- `src/interactions/modals/inactive.ts` - procesa alta y edición de inactividad.
- `src/interactions/modals/webhook-add.ts` - captura permisos y crea token webhook.
- `src/interactions/modals/webhook-delete.ts` - confirma borrado de token webhook.
- `src/interactions/modals/role-create.ts` - crea rol Minecraft desde formulario.
- `src/interactions/modals/role-edit.ts` - edita nombre de rol.
- `src/interactions/modals/blog/blog-create.ts` - captura título para un nuevo post.
- `src/interactions/modals/blog/blog-title.ts` - edita el título de un post existente.

### Menús de selección

- `src/interactions/stringMenu/role.ts` - selecciona jugador para el panel de roles.
- `src/interactions/stringMenu/role-add.ts` - selecciona rol para asignar a un jugador.
- `src/interactions/stringMenu/role-mode.ts` - cambia el modo/vista del panel de roles.

### `src/services/interactions.service.ts`

**Bloques clave**

- Carga y enruta los handlers de comandos, botones, modales y menús.
- Centraliza la resolución de interacciones recibidas desde Discord.

---

## Servicios de dominio

### `src/services/inactivity.service.ts`

**Bloques clave**

- **`markInactivity()`**: crea o actualiza periodo en DB con `upsert`.
- **`clearInactivity()`**: elimina registro por `user_id`.
- **`getInactivity()`**: consulta simple por usuario.
- **`listInactivities()`**: lista por `guild_id` ordenado por fecha.
- **`getExpired()`**: filtra inactividades vencidas no notificadas.
- **`describe()`**: genera texto para administradores.
- **`deployInactivityPanel()`**: inserta o actualiza mensaje del panel.
- **`mapRow()`**: deserializa `role_snapshot` en array utilizable.

### `src/services/roles.service.ts`

**Bloques clave**

- Gestiona el panel y operaciones del sistema de roles Minecraft.
- Controla creación, edición, eliminación y asignación de roles.
- Filtra jugadores `ACTIVE` y genera vistas de rol detalladas.

### `src/services/blog.service.ts`

**Bloques clave**

- Administra el ciclo de vida de publicaciones: `DRAFT`, `PUBLISHED`, `OUTDATED`.
- Sincroniza posts y bloques de mensajes en Discord.
- Actualiza títulos y estados desde botones y modales.

### `src/services/webhook.service.ts`

**Bloques clave**

- Despliega un panel de administración de tokens webhook.
- Crea, lista y revoca tokens con permisos granulares.
- Emite secretos y JWT firmados para el acceso de webhook.

### `src/services/players.service.ts`

**Bloques clave**

- Gestiona jugadores de Minecraft y su estado de vinculación.
- Marca jugadores como `DELETED` cuando hay baneos o removals.
- Actualiza `last_seen` con eventos de webhook.

### `src/services/monitored.service.ts`

**Bloques clave**

- Monitorea roles configurados y agrega snapshots históricos.
- Calcula conteos activos/inactivos por rol.

### `src/services/rank.service.ts`

**Bloques clave**

- Determina el rango de los jugadores según jerarquía de roles Discord.
- Sincroniza el rango de Minecraft con base en roles asignados.

---

## Scheduler y jobs recurrentes

### `src/services/scheduler.ts`

**Bloques clave**

- **`start()`**: registra intervalos:
    - `reminders`: cada `REMINDER_INTERVAL_MINUTES`.
    - `snapshots`: cada 12 horas.
- **`stop()`**: limpia timers activos.
- **`runReminders()`**:
    - Busca inactividades vencidas.
    - Notifica en canal y DM.
    - Limpia el registro en DB.
- **`captureSnapshots()`**:
    - Recorre roles monitoreados.
    - Calcula activos/inactivos.
    - Persiste estadísticas en DB.

---

## Persistencia y Prisma

### `src/prisma/database.ts`

**Bloques clave**

- **Adapter `PrismaPg`**: conecta a PostgreSQL.
- **Exporta `db`**: instancia única para reutilizar conexión.

### `src/db/schema.prisma`

**Modelos esenciales**

- **`InactivityPeriod`**
    - Registra inactividades con `user_id`, `guild_id`, fechas y snapshot de roles.
- **`TrackedRole`**
    - Roles seleccionados por administradores para monitoreo.
- **`RoleStatistic`**
    - Snapshot de conteos activos/inactivos por rol.
- **`LinkCode`**
    - Código temporal de vinculación de cuentas.
- **`Player`**
    - Representa un usuario de Minecraft.
    - Campos clave: `uuid`, `nickname`, `digs`, `rank`, `status`, `last_seen`.
    - `status` usa el enum `PLAYER_STATUS` (`ACTIVE`, `DELETED`) para soft delete.
- **`DiscordUser`**
    - Usuario Discord con relación a inactividad, posts y tokens webhook.
- **`WebhookToken`**
    - Token para autenticación de webhooks con permisos y secreto cifrado.
- **`Post`**
    - Publicaciones de blog con estados `DRAFT`, `PUBLISHED`, `OUTDATED`.
- **`PostBlocks`**
    - Bloques de mensaje asociados a un post, con contenido, embeds y attachments.
- **`User`**
    - Usuario canónico del sistema para OAuth y vinculación de cuentas.
- **`Client`**
    - Aplicación OAuth autorizada con URIs de redirección.
- **`AuthorizationCode`**
    - Códigos temporales para autorización OAuth con PKCE.
- **`Session`**
    - Sesiones activas con `refresh_token` para renovación de accesos.

### Notas del esquema

- El modelo `Player` se mapea a la tabla `minecraft_users`.
- El modelo `User` es el punto de anclaje para OAuth y enlace entre Discord y Minecraft.
- `Client`, `AuthorizationCode` y `Session` sostienen el flujo OAuth con PKCE.
- `WebhookToken.permissions` es un arreglo de strings que define permisos granulares.

---

## Utilidades comunes

### `src/utils/time.ts`

**Bloques clave**

- **`parseUserTime()`**: interpreta duración o fecha absoluta.
- **`parseDuration()`**: soporta `d/h/m/s`.
- **`parseAbsolute()`**: formatos `yyyy-MM-dd`, `dd/MM/yyyy`, ISO, etc.
- **`formatForUser()`**: formatea fechas para Discord usando `<t:...>`.

---

## Ejemplos de uso actualizados

### 1) Arranque del bot

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm start
```

### 2) Desplegar comandos y panel desde variables de entorno

```bash
export DEPLOY_COMMAND=true
export DEPLOY_INACTIVITY_PANEL=true
npm start
```

### 3) Ejemplos de interacción en Discord

- **Marcar inactividad**: botón "Marcar inactividad" → modal → `3d 6h`.
- **Fecha absoluta**: modal → `2024-12-31 18:00`.
- **Administrador**:
    - `/inactividad listar`
    - `/inactividad estadisticas`
    - `/inactividad roles agregar rol:@Moderadores`

### 4) Consumo de API v1

```bash
curl -s http://localhost:3000/v1/members | jq
curl -s http://localhost:3000/v1/posts | jq
```

### 5) Variables mínimas de entorno

```dotenv
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...
DISCORD_INACTIVITY_CHANNEL_ID=...
DISCORD_ADMIN_LOG_CHANNEL_ID=...
DATABASE_PATH=postgresql://user:pass@host:5432/db
```
