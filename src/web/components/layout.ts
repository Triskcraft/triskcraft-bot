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

                    .button {
                        align-items: center;
                        border: 0;
                        border-radius: 6px;
                        box-sizing: border-box;
                        cursor: pointer;
                        display: inline-flex;
                        font: inherit;
                        font-weight: 700;
                        justify-content: center;
                        padding: 10px 14px;
                        text-decoration: none;
                        transition:
                            background-color 0.2s ease,
                            color 0.2s ease;
                    }

                    .button-primary {
                        color: white;
                        background-color: #5865f2;
                    }

                    .button-primary:hover {
                        background-color: #4752c4;
                    }

                    .button-secondary {
                        background-color: #6c757d;
                        color: white;
                    }

                    .button-secondary:hover {
                        background-color: #5a6268;
                    }

                    .button-danger {
                        background-color: #dc3545;
                        color: white;
                    }

                    .button-danger:hover {
                        background-color: #b42332;
                    }

                    .button:disabled {
                        cursor: not-allowed;
                        opacity: 0.5;
                    }

                    .menu-links .button {
                        width: 100%;
                    }
                </style>
            </head>
            <body>
                ${children}
            </body>
        </html>`
}
