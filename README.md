# Bot de inactividad para Discord (discord.js)

Bot administrativo para servidores de Discord que permite a los miembros
registrar periodos de inactividad y ofrece a los administradores un panel de
seguimiento por roles, estadísticas históricas y tareas automatizadas. Está
construido con [`discord.js`](https://discord.js.org/), usa PostgreSQL a través
de Prisma y expone una pequeña API HTTP para datos del servidor.

## Características

- **Panel interactivo**: publica un embed con botones para marcar, editar,
  eliminar o consultar tu inactividad; las respuestas son efímeras.
- **Recordatorios automáticos**: cuando expira una inactividad, el bot menciona
  al usuario en el canal configurado y limpia el registro.
- **Slash commands para admins**: listar inactivos, consultar estadísticas por
  rol (con histórico) y administrar los roles monitoreados.
- **Capturas periódicas**: genera snapshots de actividad por rol dos veces al
  día para alimentar el historial.
- **API HTTP**: endpoint `/members` que combina la whitelist de Minecraft con la
  información persistida en base de datos (roles, medios, descripción, etc.).
- **Configuración con toggles**: variables para decidir si se publican comandos
  o el panel en cada arranque, útil para entornos CI/CD.

## Documentación detallada

Además de esta guía rápida, la documentación funcional y de arquitectura está en `docs/`:

- `docs/01-arquitectura-general.md`
- `docs/02-webhooks-y-seguridad.md`
- `docs/03-sistema-posts-blog.md`
- `docs/04-inactividad-y-estadisticas.md`
- `docs/05-mapa-de-archivos.md`

## Requisitos

- Node.js **22.21+** (coincide con `engines` en `package.json`).
- PostgreSQL accesible mediante cadena de conexión.
- Una aplicación/bot en el
  [Portal de Desarrolladores de Discord](https://discord.com/developers/applications).

Instala dependencias con:

```bash
npm install
```

## Variables de entorno

Crea un archivo `.env` en la raíz con al menos estas claves obligatorias:

| Variable                        | Descripción                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`                 | Token del bot de Discord.                                                              |
| `DISCORD_CLIENT_ID`             | ID de cliente de la aplicación.                                                        |
| `DISCORD_GUILD_ID`              | ID del servidor donde se registrarán comandos.                                         |
| `DISCORD_INACTIVITY_CHANNEL_ID` | Canal donde se publica el panel y se envían recordatorios.                             |
| `DISCORD_ADMIN_LOG_CHANNEL_ID`  | Canal opcional para registrar acciones administrativas.                                |
| `PANEL_CHANNEL_ID`              | Canal donde se publica/actualiza el panel de inactividad.                              |
| `ENCRYPT_KEY`                   | Clave simétrica en base64 usada para cifrado/descifrado interno.                       |
| `BLOG_CHANNEL_ID`               | Canal donde se publican notificaciones o posts de blog.                                |
| `BLOG_ROLE_ID`                  | ID del rol asociado a las publicaciones de blog.                                       |
| `S3_URL`                        | URL base del bucket S3 o servidor compatible con S3.                                   |
| `S3_ACCESS_KEY_ID`              | Access key para el servicio S3.                                                        |
| `S3_SECRET_ACCESS_KEY`          | Secret key para el servicio S3.                                                        |
| `DISCORD_CLIENT_SECRET`         | Secreto del cliente de Discord para OAuth.                                             |
| `DISCORD_REDIRECT_URI`          | URI de redirección usada por OAuth de Discord.                                         |
| `API_URL`                       | URL pública de la API, usada por OAuth y callbacks.                                    |
| `DATABASE_PATH`                 | Cadena de conexión PostgreSQL para Prisma (ej. `postgresql://user:pass@host:5432/db`). |

Claves recomendadas y su valor por defecto:

| Variable                    | Descripción                                                         | Predeterminado  |
| --------------------------- | ------------------------------------------------------------------- | --------------- |
| `DEPLOY_COMMAND`            | Si es `true`, registra/actualiza los slash commands en el arranque. | `false`         |
| `DEPLOY_INACTIVITY_PANEL`   | Si es `true`, publica/actualiza el panel de inactividad al iniciar. | `false`         |
| `REMINDER_INTERVAL_MINUTES` | Frecuencia con la que se revisan inactividades vencidas.            | `5`             |
| `API_PORT`                  | Puerto para la API HTTP.                                            | `3000`          |
| `NODE_ENV`                  | Entorno (`development`, `production`, etc.).                        | `development`   |
| `DEFAULT_ROLE_NAME`         | Nombre del rol por defecto cuando no hay rol explícito.             | `Digger`        |
| `DEFAULT_ROLE_ID`           | ID del rol por defecto usado en algunos flujos.                     | ``              |
| `DEFAULT_RANK`              | Nombre del rango por defecto.                                       | `Miembro`       |
| `ROLE_SERVICE`              | Si es `true`, habilita lógica adicional de roles monitoreados.      | `false`         |
| `FRONT_ORIGIN`              | Origen permitido por CORS para la API.                              | sin restricción |

También es necesario generar un par de claves RSA en la raíz del proyecto:

- `private.pem`: clave privada en formato PKCS#8 para firmar JWT.
- `public.pem`: clave pública en formato SPKI para verificar JWT.

Por ejemplo:

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

Ejemplo de `.env`:

```dotenv
DISCORD_TOKEN=tu_token
DISCORD_CLIENT_ID=123456789012345678
DISCORD_GUILD_ID=123456789012345678
DISCORD_INACTIVITY_CHANNEL_ID=123456789012345678
DISCORD_ADMIN_LOG_CHANNEL_ID=123456789012345678
PANEL_CHANNEL_ID=123456789012345678
ENCRYPT_KEY=base64:...  # valor en base64
BLOG_CHANNEL_ID=123456789012345678
BLOG_ROLE_ID=123456789012345678
S3_URL=https://example-bucket.s3.amazonaws.com
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
DISCORD_CLIENT_SECRET=tu_secreto
DISCORD_REDIRECT_URI=https://tudominio.com/oauth/callback
API_URL=https://api.tudominio.com
DATABASE_PATH=postgresql://user:pass@localhost:5432/bot_inactividad
DEPLOY_COMMAND=true
DEPLOY_INACTIVITY_PANEL=true
REMINDER_INTERVAL_MINUTES=5
API_PORT=3000
```

## Puesta en marcha

1. Instala dependencias: `npm install`.
2. Genera el cliente de Prisma y aplica las migraciones (hay SQL inicial en
   `src/prisma/migrations`):

    ```bash
    npx prisma migrate deploy
    npx prisma generate
    ```

3. Arranca el bot (usa las variables `DEPLOY_COMMAND` y `DEPLOY_INACTIVITY_PANEL`
   según necesites desplegar comandos/panel):

    ```bash
    npm start
    ```

    La API HTTP quedará escuchando en `API_PORT` y el bot se conectará al
    servidor de Discord definido por `DISCORD_GUILD_ID`.

## Operación del bot

### Panel para miembros

Los usuarios interactúan con botones en el canal configurado:

- **Marcar/Editar inactividad**: abre un modal para definir duración
  (`3d`, `6h30m`) o fecha exacta (`2024-12-31 18:00`).
- **Desmarcar inactividad**: elimina el registro si vuelve antes de tiempo.
- **Mostrar estado**: responde con la fecha/hora hasta la que permanece inactivo.

### Comandos administrativos (`/inactividad`)

Requieren permisos de administrador:

- `listar`: lista miembros inactivos vs. activos dentro de los roles vigilados.
- `estadisticas`: calcula porcentajes por rol e incluye el historial de las
  últimas capturas.
- `roles agregar rol:<rol>` / `roles eliminar rol:<rol>` / `roles listar`:
  administra los roles que serán monitoreados.

Además, `/dis-session` genera y almacena un código de enlace para usuarios de
Minecraft, enviándolo por DM y respondiendo de forma efímera.

### API HTTP

- `GET /members`: cruza los
  usuarios con la base de datos (rango, roles vinculados, medios, descripción) y
  devuelve la lista enriquecida. Incluye CORS con el origen configurado en
  `FRONT_ORIGIN`.

### Tareas automáticas

- **Recordatorios**: cada `REMINDER_INTERVAL_MINUTES` se revisan inactividades
  vencidas, se notifica al usuario y se limpia el registro.
- **Snapshots**: cada 12 horas se capturan estadísticas de actividad por rol
  monitoreado para construir el historial mostrado en `/inactividad estadisticas`.

## Estructura del proyecto (resumen)

```
src/
├── api/                   # API HTTP con Express (`/members`).
├── client.ts              # Inicializa Discord.js, intents y registro de comandos.
├── commands/              # Implementación de slash commands (p. ej. dis-session).
├── config.ts              # Carga y validación de variables de entorno.
├── handlers/              # Manejo centralizado de interacciones y slash commands.
├── interactions/          # Definición del panel, modales y registro de comandos.
├── prisma/                # Schema, migraciones y cliente generado.
├── services/              # Lógica de dominio: inactividad, roles, scheduler.
├── utils/                 # Utilidades comunes (tiempo, etc.).
└── index.ts               # Punto de entrada: API + bot + scheduler.
```

## Desarrollo y recomendaciones

- Ejecuta `npm run lint` para validar estilo y reglas de ESLint.
- Usa `npm run dev` para recargar automáticamente el bot durante el desarrollo.
- Ajusta `DEPLOY_COMMAND` y `DEPLOY_INACTIVITY_PANEL` a `false` en local si no
  quieres sobrescribir comandos/panel en el servidor de producción.

## Ejemplos de uso actualizados

### Desplegar comandos y panel en un arranque controlado

```bash
DEPLOY_COMMAND=true DEPLOY_INACTIVITY_PANEL=true npm start
```

### Consumir la API v1 desde una herramienta CLI

```bash
curl -s http://localhost:3000/v1/games/minecraft/players | jq
```

### Consultas de administración en Discord

- `/inactividad listar`
- `/inactividad estadisticas`
- `/inactividad roles agregar rol:@Moderadores`

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulta el archivo
[LICENSE](LICENSE) si deseas reutilizarlo o modificarlo.
