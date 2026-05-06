import { envs, PUBLIC_KEY } from '#/config.ts'
import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from 'node:crypto'
import { hash as argonHash, argon2id, verify } from 'argon2'
import { jwtVerify } from 'jose'
import type { JWTVerifyResult, JWTPayload } from 'jose'

const ALGO = 'aes-256-gcm'

export function encrypt(plaintext: string) {
    const iv = randomBytes(12) // recomendado para GCM

    const cipher = createCipheriv(ALGO, envs.ENCRYPT_KEY, iv)

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ])

    const tag = cipher.getAuthTag()
    const ivr = iv.toString('base64')
    const contentr = encrypted.toString('base64')
    const tagr = tag.toString('base64')

    return {
        iv: ivr,
        content: contentr,
        tag: tagr,
        payload: `${ivr}:${contentr}:${tagr}`,
    }
}

export function decrypt(encrypted: string) {
    const [iv = '', content = '', tag = ''] = encrypted.split(':')
    const decipher = createDecipheriv(
        ALGO,
        envs.ENCRYPT_KEY,
        Buffer.from(iv, 'base64'),
    )

    decipher.setAuthTag(Buffer.from(tag, 'base64'))

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(content, 'base64')),
        decipher.final(),
    ])

    return decrypted.toString('utf8')
}

export function verifyPKCE(verifier: string, challenge: string) {
    const hashed = createHash('sha256').update(verifier).digest('base64url')

    return hashed === challenge
}

export async function hash(content: string) {
    return await argonHash(content, {
        type: argon2id,
        memoryCost: 2 ** 16, // 64 MB
        timeCost: 3,
        parallelism: 1,
    })
}

export function weakHash(raw: string) {
    return createHash('sha256').update(raw).digest('hex')
}

export async function verifyHash(hash: string, str: string) {
    return await verify(hash, str)
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export async function verifyToken<T extends Record<string, unknown> = {}>(
    token: string,
): Promise<JWTVerifyResult<JWTPayload & T> | null> {
    try {
        return await jwtVerify(token, PUBLIC_KEY)
    } catch {
        return null
    }
}

export function generateCodeChallenge(verifier: string) {
    return createHash('sha256').update(verifier).digest('base64url')
}

export function generateCodeVerifier() {
    return randomBytes(32).toString('base64url')
}
