# Documentación del proyecto

Esta carpeta centraliza documentación **en español** del bot.

## Índice

1. [`01-arquitectura-general.md`](./01-arquitectura-general.md)
   - Visión global del sistema, componentes y flujo de arranque.
2. [`02-webhooks-y-seguridad.md`](./02-webhooks-y-seguridad.md)
   - Cómo funcionan los webhooks (`/webhooks/digs`, `/webhooks/link` y `/webhooks/join`) y por qué existe su capa de seguridad.
3. [`03-sistema-posts-blog.md`](./03-sistema-posts-blog.md)
   - Diseño del panel de publicaciones, borradores, publicación y obsolescencia.
4. [`04-inactividad-y-estadisticas.md`](./04-inactividad-y-estadisticas.md)
   - Flujo completo del sistema de inactividad (panel, comandos, scheduler, snapshots).
5. [`05-mapa-de-archivos.md`](./05-mapa-de-archivos.md)
   - Mapa por archivo del repositorio: qué hace cada archivo, para qué existe y en qué parte del sistema encaja.
6. [`06-oauth-y-autenticacion.md`](./06-oauth-y-autenticacion.md)
   - Sistema OAuth 2.0 con PKCE, integración Discord y gestión de sesiones.
