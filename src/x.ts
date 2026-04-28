import crypto from 'node:crypto'

function generateCodeChallenge(verifier: string) {
    return crypto.createHash('sha256').update(verifier).digest('base64url')
}

function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url')
}

const code_verifier = generateCodeVerifier()
const code_challenge = generateCodeChallenge(code_verifier)

console.log(code_verifier) // uAfahHX06t2EVvchZFpkeT5vsmvWdJGpCUtMJduJk9g
console.log(code_challenge) // eIVsW83uLPZmbiKwsR7J86HuUoMqpAWFuoLyo36gpaU
