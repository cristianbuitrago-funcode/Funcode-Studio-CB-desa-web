"""Errores de aplicación con código estable y mensaje legible para el usuario."""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    status_code = 400
    code = "error"

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationFailed(AppError):
    status_code = 422
    code = "validation_error"


class UnsafePathError(AppError):
    status_code = 422
    code = "unsafe_path"


class ConfirmationRequired(AppError):
    status_code = 409
    code = "confirmation_required"


class OperationFailed(AppError):
    status_code = 500
    code = "operation_failed"
