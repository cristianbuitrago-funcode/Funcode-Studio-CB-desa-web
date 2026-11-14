"""Evita que secretos (token de sesión, claves) lleguen a los registros."""

from __future__ import annotations

import logging
import re

REDACTED = "[REDACTADO]"

# Patrones genéricos: cabecera Authorization y pares clave=valor sensibles.
_PATTERNS = (
    re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]{8,}"),
    re.compile(
        r"(?i)((?:api[_-]?key|token|secret|password|authorization)\"?\s*[=:]\s*\"?)[^\s\"',}]{6,}"
    ),
)


class SecretRedactor:
    """Mantiene los secretos conocidos y los sustituye en cualquier texto."""

    def __init__(self) -> None:
        self._secrets: set[str] = set()

    def register(self, secret: str) -> None:
        if secret and len(secret) >= 6:
            self._secrets.add(secret)

    def redact(self, text: str) -> str:
        for secret in self._secrets:
            if secret in text:
                text = text.replace(secret, REDACTED)
        for pattern in _PATTERNS:
            text = pattern.sub(lambda m: f"{m.group(1)}{REDACTED}", text)
        return text


redactor = SecretRedactor()


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        redacted = redactor.redact(message)
        if redacted != message:
            record.msg = redacted
            record.args = None
        if record.exc_text:
            record.exc_text = redactor.redact(record.exc_text)
        return True
