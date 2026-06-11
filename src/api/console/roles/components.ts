import { Permissions, PermissionsFlagsBits } from '#/classes/permissions.ts'
import { STATE_KEYS } from '#/config.ts'
import type { Role } from '#/db/generated/client.ts'
import { db } from '#/db/prisma.ts'
import { html } from '#/utils/html.ts'

export const FORM_ACTIONS = {
    RMUSR: 'rmusr',
    ADDUSR: 'addusr',
    CHPERM: 'chperm',
    ADDROLE: 'addrole',
    CHNAME: 'chname',
} as const

export type FormAction = (typeof FORM_ACTIONS)[keyof typeof FORM_ACTIONS]

interface GenRoleLIstProps {
    selectedRoleId: string
}
async function GenRoleLIst({ selectedRoleId }: GenRoleLIstProps) {
    const [roles, systemRoleState] = await Promise.all([
        db.role.findMany({
            select: {
                id: true,
                name: true,
            },
        }),
        db.state.findUnique({
            where: { key: STATE_KEYS.SUPER_ROLE_ID },
            select: { value: true },
        }),
    ])

    const roleList = roles
        .map(
            ({ id, name }) =>
                html`<li class="role-item">
                    <a
                        href="/console/roles/${id}"
                        class="role-link ${selectedRoleId == id ? 'active' : (
                            ''
                        )}"
                    >
                        ${name}
                    </a>
                    ${id === systemRoleState?.value ?
                        ''
                    :   html`<a
                            href="/console/roles/${id}/delete"
                            class="btn-remove"
                        >
                            -
                        </a>`}
                </li>`,
        )
        .join('\n')

    return html`<ul class="role-list">
            ${roleList}
        </ul>
        <style>
            .role-list {
                list-style: none;
                margin: 18px 0 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .role-item {
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
                gap: 4px;
            }

            .role-link {
                flex: 1;
                border-radius: 6px;
                color: #4a4f5d;
                display: block;
                font-weight: 600;
                padding: 10px 14px;
                text-decoration: none;
                transition:
                    background-color 0.2s ease,
                    color 0.2s ease;
            }

            .role-link:hover,
            .role-link.active {
                background: #eef0ff;
                color: #4752c4;
            }
        </style>`
}

interface GenPermissionsLIstProps {
    role: Role
}
async function GenPermissionsLIst({ role }: GenPermissionsLIstProps) {
    const permissions = new Permissions(role.permissions)

    const permsList = new Permissions(Object.keys(PermissionsFlagsBits))
        .map(perm => {
            const has = permissions.has(perm)
            return html`<li>
                <label>
                    <span>${perm}</span>
                    <input
                        type="checkbox"
                        ${has ? 'checked' : ''}
                        name="${perm}"
                        value="+"
                    />
                </label>
            </li>`
        })
        .join('\n')

    return html`<form
            action="?ac=${FORM_ACTIONS.CHPERM}"
            method="POST"
            class="roles-panel permissions-form"
        >
            <div class="panel-heading">
                <h2>Permisos</h2>
                <input class="btn-primary" type="submit" value="Guardar" />
            </div>
            <ul class="option-list">
                ${permsList}
            </ul>
        </form>
        <style>
            .role-list {
                list-style: none;
                margin: 18px 0 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .role-link {
                border-radius: 6px;
                color: #4a4f5d;
                display: block;
                font-weight: 600;
                padding: 10px 14px;
                text-decoration: none;
                transition:
                    background-color 0.2s ease,
                    color 0.2s ease;
            }

            .role-link:hover,
            .role-link.active {
                background: #eef0ff;
                color: #4752c4;
            }
        </style>`
}

interface GenUsersLIstProps {
    selectedRoleId: string
}
async function GenUsersLIst({ selectedRoleId }: GenUsersLIstProps) {
    const users = await db.discordUser.findMany({
        where: {
            user: {
                linked_roles: {
                    some: {
                        role_id: selectedRoleId,
                    },
                },
            },
        },
        select: {
            username: true,
            id: true,
        },
    })

    const userList = users
        .map(({ id, username }) => {
            return html`<li>
                <span>${username}</span>
                <form action="?ac=${FORM_ACTIONS.RMUSR}" method="POST">
                    <input type="hidden" name="id" value="${id}" />
                    <input class="btn-remove" type="submit" value="-" />
                </form>
            </li>`
        })
        .join('\n')

    return html`<ul class="member-list">
        ${userList}
    </ul>`
}

interface RolePanelProps {
    role: Role
}
export async function RolePanel({ role }: RolePanelProps) {
    return html`
        <main class="roles-console">
            <header class="roles-header">
                <div>
                    <p class="roles-label">Consola administrativa</p>
                    <div class="title-role">
                        <h1>Administrar rol</h1>
                        <form action="?ac=${FORM_ACTIONS.CHNAME}" method="POST">
                            <input
                                type="text"
                                placeholder="${role.name}"
                                name="id"
                                required
                            />
                            <input type="reset" class="btn btn-secondary" />
                            <input
                                type="submit"
                                value="Guardar"
                                class="btn-primary"
                            />
                        </form>
                    </div>
                    <p class="roles-description">
                        Configura los permisos y miembros asociados a cada rol.
                    </p>
                </div>
                <a href="/console" class="back-link">Volver al menú</a>
            </header>

            <div class="roles-grid">
                <aside class="roles-panel">
                    <form
                        class="member-form"
                        method="POST"
                        action="?ac=${FORM_ACTIONS.ADDROLE}"
                    >
                        <h2>Roles</h2>
                        <div class="member-input-row">
                            <input
                                type="text"
                                name="id"
                                placeholder="Nuevo rol"
                                aria-label="Nuevo rol"
                                required
                            />
                            <input
                                class="btn-primary"
                                type="submit"
                                value="Agregar"
                            />
                        </div>
                    </form>
                    ${await GenRoleLIst({
                        selectedRoleId: role.id,
                    })}
                </aside>

                ${await GenPermissionsLIst({ role })}

                <aside class="roles-panel members-panel">
                    <form
                        class="member-form"
                        method="POST"
                        action="?ac=${FORM_ACTIONS.ADDUSR}"
                    >
                        <h2>Miembros</h2>
                        <div class="member-input-row">
                            <input
                                type="text"
                                name="id"
                                placeholder="ID de Discord"
                                aria-label="ID de Discord"
                                required
                            />
                            <input
                                class="btn-primary"
                                type="submit"
                                value="Agregar"
                            />
                        </div>
                    </form>
                    ${await GenUsersLIst({ selectedRoleId: role.id })}
                </aside>
            </div>
        </main>

        <style>
            .title-role {
                display: flex;
                align-items: center;

                & > form {
                    & > input[type='text'] {
                        background: #f4f4f9;
                        padding: 2px 8px 0px 8px;
                        border: 0;
                        font-size: 2em;
                        font-weight: bold;
                        color: #333;
                    }

                    & > input[type='text']::placeholder {
                        color: #333;
                        font-weight: bold;
                    }
                }
            }

            .roles-console {
                box-sizing: border-box;
                width: min(1100px, calc(100% - 32px));
                margin: auto;
                padding: 32px 0;
            }

            .roles-console * {
                box-sizing: border-box;
            }

            .roles-header {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 24px;
                margin-bottom: 24px;
            }

            .roles-header h1 {
                margin: 0 0 8px;
            }

            .roles-label {
                color: #5865f2;
                font-size: 0.8rem;
                font-weight: 700;
                letter-spacing: 0.04em;
                margin: 0 0 6px;
                text-transform: uppercase;
            }

            .roles-description {
                color: #5d6270;
                margin: 0;
            }

            .back-link {
                color: #5865f2;
                font-size: 0.9rem;
                font-weight: 600;
                text-decoration: none;
                white-space: nowrap;
            }

            .back-link:hover {
                color: #4752c4;
                text-decoration: underline;
            }

            .roles-grid {
                display: grid;
                grid-template-columns:
                    minmax(180px, 1fr) minmax(280px, 1fr)
                    minmax(260px, 1fr);
                gap: 18px;
                align-items: start;
            }

            .roles-panel {
                background: white;
                border: 1px solid #d9dce3;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(31, 35, 48, 0.08);
                min-width: 0;
                padding: 22px;
            }

            .roles-panel h2 {
                color: #333;
                font-size: 1.15rem;
                margin: 0;
            }

            .option-list,
            .member-list {
                list-style: none;
                margin: 18px 0 0;
                padding: 0;
            }

            .panel-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }

            .option-list,
            .member-list {
                border-top: 1px solid #e7e8ed;
            }

            .option-list li,
            .member-list li {
                border-bottom: 1px solid #e7e8ed;
            }

            .option-list label,
            .member-list li {
                align-items: center;
                color: #4a4f5d;
                display: flex;
                justify-content: space-between;
                gap: 16px;
                min-height: 52px;
            }

            .option-list label {
                cursor: pointer;
                font-size: 0.88rem;
                font-weight: 600;
            }

            .option-list input[type='checkbox'] {
                accent-color: #5865f2;
                height: 18px;
                width: 18px;
            }

            .member-form {
                display: flex;
                flex-direction: column;
                gap: 18px;
            }

            .member-input-row {
                display: flex;
                gap: 8px;
            }

            .member-input-row input[type='text'] {
                border: 1px solid #c9ccd5;
                border-radius: 6px;
                font: inherit;
                min-width: 0;
                padding: 10px 14px;
                width: 100%;
            }

            .member-input-row input[type='text']:focus {
                border-color: #5865f2;
                box-shadow: 0 0 0 3px rgba(88, 101, 242, 0.15);
                outline: none;
            }

            @media (max-width: 860px) {
                body {
                    align-items: flex-start;
                    height: auto;
                    min-height: 100vh;
                }

                .roles-grid {
                    grid-template-columns: 1fr 1fr;
                }

                .members-panel {
                    grid-column: 1 / -1;
                }
            }

            @media (max-width: 600px) {
                .roles-console {
                    width: min(100% - 24px, 1100px);
                    padding: 24px 0;
                }

                .roles-header {
                    align-items: flex-start;
                    flex-direction: column;
                    gap: 12px;
                }

                .roles-grid {
                    grid-template-columns: 1fr;
                }

                .members-panel {
                    grid-column: auto;
                }

                .member-input-row {
                    flex-direction: column;
                }
            }
        </style>
    `
}

interface FormProps {
    role: Role
}
export function DeleteRoleForm({ role }: FormProps) {
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

                .btn-upload {
                    width: 100%;
                    background: #3182ce;
                    color: white;
                    border: none;
                    padding: 12px;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
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

                .btn-submit {
                    width: 100%;
                    background-color: #28a745;
                    color: white;
                    border: none;
                    padding: 12px;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.3s;
                }

                .btn-submit:hover {
                    background-color: #218838;
                }

                .back-link {
                    display: block;
                    margin-top: 15px;
                    text-decoration: none;
                    color: #007bff;
                    font-size: 13px;
                }
            </style>

            <h2>Estás seguro de eliminar el rol ${role.name}?</h2>
            <p>Esta acción <strong>no es reversible</strong></p>

            <form action="/console/roles/${role.id}/delete" method="POST">
                <a href="/console/roles" class="btn-primary">Cancelar</a>
                <button type="submit" class="btn-remove">Eliminar</button>
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
    `
}
