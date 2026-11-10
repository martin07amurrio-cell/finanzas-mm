import base64
import hashlib
import hmac
import json
import os
import time
import threading
from pathlib import Path
from typing import Annotated, Any

from fastapi import Header, HTTPException, Request, status


AUTH_SECRET_FILE = os.getenv("FINANZAS_AUTH_SECRET_FILE", "/secrets/auth_secret")
TOKEN_TTL_SECONDS = int(os.getenv("FINANZAS_TOKEN_TTL_SECONDS", str(60 * 60 * 24 * 30)))
LOGIN_WINDOW_SECONDS = int(os.getenv("FINANZAS_LOGIN_WINDOW_SECONDS", "3600"))
LOGIN_MAX_ATTEMPTS = int(os.getenv("FINANZAS_LOGIN_MAX_ATTEMPTS", "5"))

_login_attempts: dict[str, list[float]] = {}
_login_lock = threading.Lock()


def read_auth_secret() -> bytes:
    secret = Path(AUTH_SECRET_FILE).read_text(encoding="utf-8").strip()
    if not secret:
        raise RuntimeError("FINANZAS auth secret vacío")
    return secret.encode("utf-8")


def b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def sign(payload_b64: str) -> str:
    digest = hmac.new(read_auth_secret(), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    return b64_encode(digest)


def create_session_token(user: dict[str, Any]) -> str:
    now = int(time.time())
    payload = {
        "sub": user["id"],
        "name": user["name"],
        "role": user.get("role", "user"),
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
    }
    payload_b64 = b64_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    signature = sign(payload_b64)
    return f"{payload_b64}.{signature}"


def verify_session_token(token: str) -> dict[str, Any]:
    try:
        payload_b64, signature = token.split(".", 1)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    expected = sign(payload_b64)
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Firma de token inválida")

    try:
        payload = json.loads(b64_decode(payload_b64).decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Payload de token inválido")

    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión vencida")

    return payload


def require_auth(
    x_finanzas_token: Annotated[str | None, Header(alias="X-Finanzas-Token")] = None,
) -> dict[str, Any]:
    if not x_finanzas_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token faltante")
    return verify_session_token(x_finanzas_token)


def client_key(request: Request, user_name: str) -> str:
    """Límite global por identidad, no por IP o X-Forwarded-For manipulable.

    Solo hay dos identidades válidas; los nombres desconocidos comparten cupo
    para que un atacante no cree infinitas entradas en memoria.
    """
    canonical = user_name.strip().casefold()
    return canonical if canonical in ("martín", "micaela") else "desconocido"


def check_login_rate_limit(request: Request, user_name: str) -> None:
    """Reserva cada intento antes de verificar el PIN, evitando carreras triviales.

    Máximo de cinco inicios de sesión por identidad y hora. El contador está
    en memoria: no sustituye un control distribuido o un segundo factor.
    """
    key = client_key(request, user_name)
    now = time.monotonic()
    with _login_lock:
        recent = [ts for ts in _login_attempts.get(key, []) if now - ts < LOGIN_WINDOW_SECONDS]
        if len(recent) >= LOGIN_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos. Volvé a probar en una hora.",
            )
        recent.append(now)
        _login_attempts[key] = recent


# Los PIN nuevos se almacenan como hashes PBKDF2 con sal aleatoria por usuario.
# La compatibilidad con PIN en texto plano se elimina: no hay usuarios activos que migrar.
PIN_ITERATIONS = 600_000


def hash_pin(pin: str) -> str:
    if not (pin.isascii() and pin.isdigit() and len(pin) == 4):
        raise ValueError("El PIN debe tener exactamente 4 dígitos")
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, PIN_ITERATIONS)
    return f"pbkdf2_sha256${PIN_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_pin(stored_pin: str | None, provided_pin: str | None) -> bool:
    if not stored_pin or not provided_pin:
        return False
    try:
        algorithm, iterations, salt_hex, expected_hex = stored_pin.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        rounds = int(iterations)
        if rounds < 100_000 or rounds > 1_000_000:
            return False
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(expected_hex)
        if len(salt) != 16 or len(expected) != 32:
            return False
        digest = hashlib.pbkdf2_hmac("sha256", provided_pin.encode("utf-8"), salt, rounds)
        return hmac.compare_digest(digest, expected)
    except (ValueError, TypeError):
        return False
