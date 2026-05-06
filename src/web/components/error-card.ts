import { html } from '#/utils/html.ts'

interface ErrorCardProps {
    title?: string
    message: string
    code?: number | string
    backUrl?: string
}

export function ErrorCard({
    title = '¡Ups! Algo salió mal',
    message,
    code = 500,
    backUrl = '/',
}: ErrorCardProps) {
    return html`
        <div class="container">
            <div class="error-card">
                <div class="error-icon">⚠️</div>
                <span class="error-code">${code}</span>
                <h1>${title}</h1>
                <p class="error-message">${message}</p>

                <div class="menu-links">
                    <a href="${backUrl}" class="btn btn-secondary">
                        Volver al inicio
                    </a>
                </div>
            </div>
        </div>

        <style>
            .error-card {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                border-top: 5px solid #dc3545;
            }

            .error-icon {
                font-size: 3rem;
                margin-bottom: 10px;
            }

            .error-code {
                display: block;
                font-size: 1.2rem;
                font-weight: bold;
                color: #dc3545;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 5px;
            }

            .error-message {
                color: #666;
                line-height: 1.5;
                margin-bottom: 30px;
            }

            .btn-secondary {
                background-color: #6c757d;
            }

            .btn-secondary:hover {
                background-color: #5a6268;
            }
        </style>
    `
}
