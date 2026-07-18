import { escapeAttribute, html } from '#/utils/html.ts'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'

interface BaseButtonProps {
    variant?: ButtonVariant
    className?: string
    id?: string
}

interface ButtonProps extends BaseButtonProps {
    children: string
    type?: 'button' | 'reset' | 'submit'
    disabled?: boolean
}

interface AnchorButtonProps extends BaseButtonProps {
    children: string
    href: string
}

interface InputSubmitButtonProps extends BaseButtonProps {
    value: string
    name?: string
    disabled?: boolean
}

function getButtonAttributes({
    variant = 'primary',
    className,
    id,
}: BaseButtonProps) {
    const classes = ['button', `button-${variant}`, className]
        .filter(Boolean)
        .join(' ')

    return html`class="${escapeAttribute(classes)}"${
        id ? html` id="${escapeAttribute(id)}"` : ''
    }`
}

export function Button({
    children,
    type = 'button',
    disabled = false,
    ...props
}: ButtonProps) {
    return html`<button
        type="${type}"
        ${getButtonAttributes(props)}
        ${disabled ? 'disabled' : ''}
    >
        ${children}
    </button>`
}

export function AnchorButton({ children, href, ...props }: AnchorButtonProps) {
    return html`<a
        href="${escapeAttribute(href)}"
        ${getButtonAttributes(props)}
    >
        ${children}
    </a>`
}

export function InputSubmitButton({
    value,
    name,
    disabled = false,
    ...props
}: InputSubmitButtonProps) {
    return html`<input
        type="submit"
        value="${escapeAttribute(value)}"
        ${name ? html`name="${escapeAttribute(name)}"` : ''}
        ${getButtonAttributes(props)}
        ${disabled ? 'disabled' : ''}
    />`
}
