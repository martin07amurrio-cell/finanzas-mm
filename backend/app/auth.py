import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from typing import Annotated, Any

from fastapi import Header, HTTPException, Request, status


AUTH_SECRET_FILE = os.getenv("FINANZAS_AUTH_SECRET_FILE", "/secrets/auth_secret")
TOKEN_TTL_SECONDS = int(os.getenv("FINANZAS_TOKEN_TTL_SECONDS", str(60 * 60 * 24 * 30)))
LOGIN_WINDOW_SECONDS = int(os.getenv("FINANZAS_LOGIN_WINDOW_SECONDS", "600"))
LOGIN_MAX_ATTEMPTS = int(os.getenv("FINANZAS_LOGIN_MAX_ATTEMPTS", "5"))

_login_attempts: dict[str, list[float]] = {}


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
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",", 1)[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    return f"{ip}:{user_name}"


def check_login_rate_limit(request: Request, user_name: str) -> None:
    key = client_key(request, user_name)
    now = time.time()
    recent = [ts for ts in _login_attempts.get(key, []) if now - ts < LOGIN_WINDOW_SECONDS]
    _login_attempts[key] = recent

    if len(recent) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Esperá unos minutos y volvé a probar.",
        )


def register_failed_login(request: Request, user_name: str) -> None:
    key = client_key(request, user_name)
    now = time.time()
    recent = [ts for ts in _login_attempts.get(key, []) if now - ts < LOGIN_WINDOW_SECONDS]
    recent.append(now)
    _login_attempts[key] = recent


def clear_login_failures(request: Request, user_name: str) -> None:
    key = client_key(request, user_name)
    _login_attempts.pop(key, None)


def verify_pin(stored_pin: str | None, provided_pin: str | None) -> bool:
    return hmac.compare_digest(str(stored_pin or ""), str(provided_pin or ""))
