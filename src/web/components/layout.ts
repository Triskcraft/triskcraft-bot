import { html } from '#/utils/html.ts'

interface LayoutProps {
    children: string
    title?: string
}
export function Layout({ children, title = 'Console Admin' }: LayoutProps) {
    return html`<!DOCTYPE html>
        <html lang="es">
            <head>
                <meta charset="UTF-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                />
                <title>${title}</title>
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

                    .btn-remove {
                        background: #fbeaec;
                        color: #b42332;
                        padding: 10px 14px;
                    }

                    .btn-remove:hover {
                        background: #f5d2d7;
                    }

                    .btn-primary,
                    .btn-remove,
                    .btn-secondary {
                        text-decoration: none;
                        border: 0;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 700;
                        padding: 10px 14px;
                        transition: background-color 0.2s ease;
                    }

                    .btn-primary {
                        background: #5865f2;
                        color: white;
                    }

                    .btn-primary:hover {
                        background: #4752c4;
                    }

                    .btn-secondary {
                        background-color: #6c757d;
                    }

                    .btn-secondary:hover {
                        background-color: #5a6268;
                    }
                </style>
            </head>
            <body>
                ${children}
            </body>
        </html>`
}
