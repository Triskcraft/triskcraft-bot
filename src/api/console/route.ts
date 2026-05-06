import { html } from '#/utils/html.ts'
import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
    res.send(
        html`<!DOCTYPE html>
            <html lang="es">
                <head>
                    <meta charset="UTF-8" />
                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1.0"
                    />
                    <title>Menú de Herramientas</title>
                    <style>
                        /* Estilos básicos para que se vea limpio */
                        body {
                            font-family:
                                -apple-system, BlinkMacSystemFont, 'Segoe UI',
                                Roboto, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background-color: #f4f4f9;
                        }

                        .container {
                            text-align: center;
                            width: 100%;
                            max-width: 400px;
                            padding: 20px;
                        }

                        h1 {
                            color: #333;
                            margin-bottom: 20px;
                        }

                        .menu-links {
                            display: flex;
                            flex-direction: column;
                            gap: 15px;
                        }

                        .btn {
                            text-decoration: none;
                            color: white;
                            background-color: #007bff;
                            padding: 15px;
                            border-radius: 8px;
                            font-weight: bold;
                            transition: background 0.3s ease;
                        }

                        .btn:hover {
                            background-color: #0056b3;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Mis Herramientas</h1>

                        <nav class="menu-links">
                            <a href="/ruta-1" class="btn">Herramienta 1</a>
                            <a href="/ruta-2" class="btn">Herramienta 2</a>
                            <a href="/ruta-3" class="btn">Herramienta 3</a>
                            <a href="https://google.com" class="btn"
                                >Enlace Externo</a
                            >
                        </nav>
                    </div>
                </body>
            </html>`,
    )
})

export default router
