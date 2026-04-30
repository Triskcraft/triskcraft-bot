export class ApiError extends Error {
    statusCode: number

    constructor(
        message: string,
        statusCode = 500,
        cause: Record<string, unknown> = {},
    ) {
        super(message, { cause })
        this.statusCode = statusCode
    }
}

export class BadRequestError extends ApiError {
    constructor(message: string, cause: Record<string, unknown> = {}) {
        super(message, 400, { cause })
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized', cause: Record<string, unknown> = {}) {
        super(message, 401, { cause })
    }
}

export class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden', cause: Record<string, unknown> = {}) {
        super(message, 403, { cause })
    }
}

export class NotFoundError extends ApiError {
    constructor(message = 'NotFound', cause: Record<string, unknown> = {}) {
        super(message, 404, { cause })
    }
}

export class InternalServerError extends ApiError {
    constructor(
        message = 'Internal Server Error',
        cause: Record<string, unknown> = {},
    ) {
        super(message, 500, { cause })
    }
}
