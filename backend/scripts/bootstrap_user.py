"""Crear o actualizar de forma segura los dos usuarios de Hogar M&M.

Ejemplo (después de inicializar PostgreSQL):
    PYTHONPATH=backend python backend/scripts/bootstrap_user.py --user "Martín"
    PYTHONPATH=backend python backend/scripts/bootstrap_user.py --user "Micaela"

Solicita el PIN por terminal sin mostrarlo ni incluirlo en argumentos o Git.
"""
import argparse
import getpass
import os
from pathlib import Path
from uuid import uuid4

import psycopg

from app.auth import hash_pin


def main():
    parser = argparse.ArgumentParser(description="Inicializar usuario familiar (PIN con hash)")
    parser.add_argument("--user", required=True, choices=("Martín", "Micaela"))
    args = parser.parse_args()
    pin = getpass.getpass(f"PIN nuevo de {args.user} (4 dígitos): ")
    confirmation = getpass.getpass("Confirmar PIN: ")
    if pin != confirmation:
        raise SystemExit("Los PIN no coinciden")
    try:
        pin_hash = hash_pin(pin)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    password_path = Path(os.getenv("FINANZAS_DB_PASSWORD_FILE", "/secrets/postgres_password"))
    password = password_path.read_text(encoding="utf-8").strip()
    with psycopg.connect(
        host=os.getenv("FINANZAS_DB_HOST", "localhost"),
        port=int(os.getenv("FINANZAS_DB_PORT", "5432")),
        dbname=os.getenv("FINANZAS_DB_NAME", "finanzas_mm"),
        user=os.getenv("FINANZAS_DB_USER", "finanzas_mm"),
        password=password,
    ) as conn:
        with conn.cursor() as cur:
            # El nombre identifica a uno de los dos miembros existentes.
            cur.execute("SELECT id FROM users WHERE name = %s LIMIT 1 FOR UPDATE", (args.user,))
            row = cur.fetchone()
            if row:
                cur.execute(
                    "UPDATE users SET pin_hash = %s, is_active = true, updated_at = now() WHERE id = %s",
                    (pin_hash, row[0]),
                )
            else:
                cur.execute(
                    """INSERT INTO users (id, name, pin_hash, role, created_at, updated_at, is_active)
                    VALUES (%s, %s, %s, 'user', now(), now(), true)""",
                    (str(uuid4()), args.user, pin_hash),
                )
    print(f"Usuario {args.user} configurado. El PIN no se guardó en texto plano.")


if __name__ == "__main__":
    main()
