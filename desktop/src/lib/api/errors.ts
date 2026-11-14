export interface FieldError {
  field: string;
  message: string;
}

/** Error de la API con código estable y mensaje listo para mostrar al usuario. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, status = 0, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  get isNetwork(): boolean {
    return this.code === "network";
  }

  get fieldErrors(): FieldError[] {
    const fields = this.details["fields"];
    return Array.isArray(fields) ? (fields as FieldError[]) : [];
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}
