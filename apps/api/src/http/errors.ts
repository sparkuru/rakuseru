export type ApiErrorCode =
  | 'bad_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'service_unavailable'
  | 'internal_error'

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 503,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ErrorEnvelope {
  readonly error: {
    readonly code: ApiErrorCode
    readonly message: string
    readonly requestId: string
  }
}

export function errorEnvelope(error: unknown, requestId: string): { status: number; body: ErrorEnvelope } {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message, requestId } },
    }
  }
  return {
    status: 500,
    body: { error: { code: 'internal_error', message: 'Internal service error', requestId } },
  }
}
