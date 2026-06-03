# Arquitectura general del bot

## Objetivo del proyecto

Este bot unifica cuatro necesidades operativas de la comunidad:

1. **Gestionar inactividad en Discord** (autogestión por usuario + control administrativo).
2. **Sincronizar estado de miembros Minecraft** (vinculación, rango, roles y métricas como `digs`).
3. **Administrar herramientas internas** (tokens de webhook, panel de roles y flujo de publicaciones tipo blog).
4. **Autenticación OAuth 2.0 con PKCE** (integración segura con aplicaciones externas).

## Componentes principales

## 1) Runtime de Discord

- **`src/client.ts`** crea el cliente Discord y registra slash commands (si está habilitado por entorno).
- **`src/services/interactions.service.ts`** detecta interacciones y despacha por tipo (botones, modales, menús, comandos).
- **Servicios de dominio** (`inactivity`, `role`, `blog`, `rank`) ejecutan lógica de negocio.

**Por qué existe:** Discord es la interfaz operativa principal de administradores y miembros.

## 2) API HTTP

- **`src/api/server.ts`** expone rutas `v1` y `webhooks`.
- **`/v1/members`** entrega catálogo enriquecido de miembros Minecraft.
- **`/webhooks/*`** recibe datos externos autenticados y firmados.

**Por qué existe:** permite integrar web, paneles externos y automatizaciones del servidor Minecraft sin depender del cliente Discord.

## 3) Persistencia

- **Prisma + PostgreSQL** (`src/prisma/schema.prisma`, `src/prisma/database.ts`).
- Modela inactividad, roles monitorizados, snapshots históricos, usuarios enlazados, tokens de webhook, posts y bloques.

**Por qué existe:** concentrar estado durable para auditoría, historial y operación reiniciable.

## 4) Tareas recurrentes

- **`src/services/scheduler.ts`**:
    - recordatorios por inactividad vencida,
    - snapshots de actividad por rol.
- **`src/services/digs.service.ts`**:
    - lectura periódica de archivos de estadísticas Minecraft.

**Por qué existe:** no todo depende de interacción humana; parte del sistema necesita mantenimiento automático.

## 5) Autenticación OAuth 2.0

- **`src/api/oauth/`** expone endpoints de autenticación con PKCE:
    - `GET /auth/authorize` - Iniciar flujo de autorización
    - `POST /auth/token` - Intercambiar código por tokens
    - `POST /auth/refresh` - Renovar access tokens
    - `POST /auth/me` - Información del usuario autenticado según scopes
- **Tablas asociadas**: `users`, `clients`, `authorization_codes`, `sessions`
- **Scopes disponibles**: `openid`, `identify`, `minecraft`
- **Integración con Discord OAuth** para autenticación transparente

**Por qué existe:** permite que aplicaciones terceras accedan al sistema de forma segura sin exponer credenciales.

## Flujo de arranque

`src/index.ts` orquesta este orden:

1. Arranque del servidor HTTP.
2. Registro de handlers de interacción.
3. Despliegue opcional del panel de inactividad.
4. Despliegue de paneles de administración (webhooks, roles, blog).
5. Activación de servicios de rango, scheduler y digs.

## Flujo de apagado

En `SIGINT/SIGTERM`, se detienen timers y listeners, se cierra Discord y se desconecta Prisma.

## Estructura general

```text
src/
├── api/                  # API REST y webhooks
├── classes/              # Entidades de dominio y managers en memoria
├── interactions/         # Botones, modales, menús y comandos slash
├── prisma/               # Schema y migraciones
├── services/             # Lógica principal de negocio y orquestación
├── utils/                # Utilidades compartidas
├── client.ts             # Cliente Discord
├── config.ts             # Entorno y constantes globales
└── index.ts              # Punto de entrada
```

## Decisiones de diseño (resumen)

- **Paneles persistentes y pineados:** para tener puntos de control estables en Discord.
- **Estado mínimo en memoria + fuente en BD:** mejora resiliencia tras reinicios.
- **Autenticación con JWT + firma HMAC en webhooks:** protege contra robo/replay/manipulación.
- **Servicios separados por dominio:** reduce acoplamiento y facilita mantenimiento.
- **OAuth 2.0 con PKCE:** flujo seguro para autenticación de terceros sin comprometer credenciales.
- **Soft-delete de jugadores:** uso de `PLAYER_STATUS` enum en lugar de eliminar registros para mantener histórico.
- **Tracking de actividad:** campo `last_seen` registra logins para detectar inactividad en tiempo real.
