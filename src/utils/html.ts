import type { Response } from 'express'

export function html(strings: TemplateStringsArray, ...values: unknown[]) {
    let result = ''

    for (let i = 0; i < strings.length; i++) {
        result += strings[i]
        if (i < values.length) {
            result += values[i]
        }
    }

    return result
}

export function render(res: Response, content: string) {
    return res.send(content)
}
