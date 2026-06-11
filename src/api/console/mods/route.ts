import { html, render } from '#/utils/html.ts'
import { Router } from 'express'
import { BUCKETS, ensureBucket, s3 } from '#/db/s3.ts'
import { Upload } from '@aws-sdk/lib-storage'
import Busboy from 'busboy'
import type { CompleteMultipartUploadCommandOutput } from '@aws-sdk/client-s3'
import { Layout } from '#/web/components/layout.ts'
import { Button } from '#/web/components/button.ts'

const router = Router()

await ensureBucket(BUCKETS.WEB)

router.get('/', async (req, res) => {
    render(
        res,
        Layout({
            children: Form(),
        }),
    )
})

router.post('/', async (req, res) => {
    const busboy = Busboy({ headers: req.headers })

    let uploadPromise: Promise<CompleteMultipartUploadCommandOutput> | null =
        null

    busboy.on('file', (fieldname, file, info) => {
        const { mimeType } = info

        const upload = new Upload({
            client: s3,
            params: {
                Bucket: BUCKETS.WEB,
                Key: 'pack-mods-triskcraftsmp.rar',
                Body: file, // stream
                ContentType: mimeType,
            },
            partSize: 10 * 1024 * 1024, // 10MB chunks
            queueSize: 4,
        })

        uploadPromise = upload.done()
    })

    busboy.on('finish', async () => {
        await uploadPromise
        res.json({ ok: true })
    })

    req.pipe(busboy)
})

export default router

function Form() {
    return html`
        <div class="upload-component-wrapper">
            <style>
                .upload-component-wrapper {
                    font-family:
                        -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                        sans-serif;
                    max-width: 400px;
                    background: white;
                    padding: 25px;
                    border-radius: 12px;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                }

                h2 {
                    margin-top: 0;
                    color: #333;
                    font-size: 1.2rem;
                }

                /* Estilos del Formulario */
                .file-box {
                    border: 2px dashed #cbd5e0;
                    padding: 20px;
                    text-align: center;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    cursor: pointer;
                    transition: border-color 0.3s;
                }
                .file-box:hover {
                    border-color: #3182ce;
                }

                input[type='file'] {
                    margin-bottom: 15px;
                    width: 100%;
                }

                /* Estilos de la Barra (Oculta por defecto) */
                .progress-area {
                    display: none; /* Se muestra al iniciar la subida */
                    margin-top: 20px;
                }

                .progress-bar-bg {
                    width: 100%;
                    height: 10px;
                    background: #edf2f7;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-top: 8px;
                }

                .progress-bar-fill {
                    height: 100%;
                    width: 0%;
                    background: #48bb78;
                    transition: width 0.2s;
                }

                .status-info {
                    display: flex;
                    justify-content: space-between;
                    font-size: 13px;
                    color: #4a5568;
                }

                h2 {
                    color: #333;
                    margin-top: 0;
                }
                p {
                    color: #666;
                    font-size: 14px;
                }

                .file-input-group {
                    margin: 20px 0;
                    text-align: left;
                }

                input[type='file'] {
                    width: 100%;
                    padding: 10px;
                    border: 1px dashed #ccc;
                    border-radius: 6px;
                    cursor: pointer;
                    box-sizing: border-box;
                }

                .upload-button {
                    width: 100%;
                }

                .back-link {
                    display: block;
                    margin-top: 15px;
                    text-decoration: none;
                    color: #007bff;
                    font-size: 13px;
                }
            </style>

            <h2>Subir Nuevo Modpack</h2>
            <p>Selecciona tu archivo <strong>.rar</strong> para procesarlo.</p>

            <form id="uploadForm">
                <div class="file-input-group">
                    <input
                        id="modFile"
                        type="file"
                        name="mods"
                        accept=".rar"
                        required
                    />
                </div>

                ${Button({
                    type: 'submit',
                    id: 'uploadBtn',
                    className: 'upload-button',
                    children: 'Subir Archivo',
                })}
            </form>

            <a href="/console" class="back-link">← Volver al menú</a>

            <div id="progressArea" class="progress-area">
                <div class="status-info">
                    <span id="statusText">Subiendo...</span>
                    <span id="percentText">0%</span>
                </div>
                <div class="progress-bar-bg">
                    <div id="progressBar" class="progress-bar-fill"></div>
                </div>
            </div>
        </div>

        <script>
            const uploadForm = document.getElementById('uploadForm')
            const fileInput = document.getElementById('modFile')
            const progressArea = document.getElementById('progressArea')
            const progressBar = document.getElementById('progressBar')
            const percentText = document.getElementById('percentText')
            const statusText = document.getElementById('statusText')
            const uploadBtn = document.getElementById('uploadBtn')

            uploadForm.onsubmit = e => {
                e.preventDefault()

                if (fileInput.files.length === 0) return

                const file = fileInput.files[0]
                const formData = new FormData()
                formData.append('file', file)

                const xhr = new XMLHttpRequest()

                // Mostrar la barra y desactivar botón
                progressArea.style.display = 'block'
                uploadBtn.disabled = true
                uploadBtn.style.opacity = '0.5'

                // EVENTO DE PROGRESO (Aquí ocurre la magia)
                xhr.upload.addEventListener('progress', e => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100)
                        progressBar.style.width = percent + '%'
                        percentText.innerText = percent + '%'
                    }
                })

                // Al finalizar la subida
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        statusText.innerText = '¡Completado con éxito!'
                        progressBar.style.background = '#2ecc71'
                        uploadBtn.disabled = false
                        uploadBtn.style.opacity = '1'
                        uploadForm.reset()
                    } else {
                        statusText.innerText = 'Error al subir.'
                        progressBar.style.background = '#e53e3e'
                    }
                }

                // Enviar a tu ruta /upload
                xhr.open('POST', '/console/mods')
                xhr.send(formData)
            }
        </script>
    `
}
