import os
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import psycopg
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.auth import (
    check_login_rate_limit,
    clear_login_failures,
    create_session_token,
    register_failed_login,
    require_auth,
    verify_pin,
)


DB_HOST = os.getenv("FINANZAS_DB_HOST", "edith-postgres")
DB_PORT = int(os.getenv("FINANZAS_DB_PORT", "5432"))
DB_NAME = os.getenv("FINANZAS_DB_NAME", "finanzas_mm")
DB_USER = os.getenv("FINANZAS_DB_USER", "finanzas_mm")
DB_PASSWORD_FILE = os.getenv("FINANZAS_DB_PASSWORD_FILE", "/secrets/postgres_password")


app = FastAPI(title="Finanzas MM API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    name: str
    pin: str


class TransactionCreate(BaseModel):
    type: Literal["gasto", "ingreso"]
    amount: float
    currency: Literal["ARS", "USD"] = "ARS"
    description: str | None = None
    category_id: str
    account_id: str
    user_id: str
    transaction_date: str | None = None


class CategoryCreate(BaseModel):
    name: str
    type: Literal["gasto", "ingreso", "reserva"]
    color: str | None = None
    icon: str | None = None


class CategoryUpdate(BaseModel):
    name: str
    type: Literal["gasto", "ingreso", "reserva"]
    color: str | None = None
    icon: str | None = None


def read_password() -> str:
    return Path(DB_PASSWORD_FILE).read_text(encoding="utf-8").strip()


def connect():
    return psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=read_password(),
    )


def clean_value(value: Any):
    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    return value


def rows_to_dicts(cursor):
    columns = [desc[0] for desc in cursor.description]
    return [
        {key: clean_value(value) for key, value in zip(columns, row)}
        for row in cursor.fetchall()
    ]


def parse_amount(value: float) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="El importe no es válido")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="El importe debe ser mayor a cero")

    return amount


def parse_transaction_date(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)

    raw = value.strip()

    if len(raw) == 10:
        raw = f"{raw}T15:00:00+00:00"

    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="La fecha del movimiento no es válida")

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed


def clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned if cleaned else None


def clean_required_text(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field_name} es obligatorio")

    return cleaned


def fetch_active_category(cur, category_id: str) -> dict[str, Any] | None:
    cur.execute(
        """
        SELECT id, name, type, color, icon, is_default, is_active, created_at
        FROM categories
        WHERE id = %s
            AND is_active IS TRUE;
        """,
        (category_id,),
    )
    rows = rows_to_dicts(cur)
    return rows[0] if rows else None


def count_category_transactions(cur, category_id: str) -> int:
    cur.execute(
        "SELECT COUNT(*) FROM transactions WHERE category_id = %s;",
        (category_id,),
    )
    return cur.fetchone()[0]


def fetch_reserve_category_balance(cur, category_id: str) -> Decimal:
    cur.execute(
        """
        SELECT COALESCE(
            SUM(
                CASE
                    WHEN type = 'gasto' THEN amount
                    WHEN type = 'ingreso' THEN -amount
                    ELSE 0
                END
            ),
            0
        )
        FROM transactions
        WHERE category_id = %s;
        """,
        (category_id,),
    )
    return cur.fetchone()[0]


def transaction_from_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "type": row["type"],
        "amount": row["amount"],
        "currency": row["currency"],
        "description": row["description"],
        "category_id": row["category_id"],
        "account_id": row["account_id"],
        "user_id": row["user_id"],
        "transaction_date": row["transaction_date"],
        "created_at": row["created_at"],
        "category": {
            "id": row["category_id"],
            "name": row["category_name"],
            "type": row["category_type"],
            "color": row["category_color"],
            "icon": row["category_icon"],
            "is_default": row["category_is_default"],
            "is_active": row["category_is_active"],
        } if row["category_id"] else None,
        "account": {
            "id": row["account_id"],
            "name": row["account_name"],
            "type": row["account_type"],
            "currency": row["account_currency"],
            "current_balance": row["account_current_balance"],
            "is_active": row["account_is_active"],
        } if row["account_id"] else None,
        "user": {
            "id": row["user_id"],
            "name": row["user_name"],
            "role": row["user_role"],
        } if row["user_id"] else None,
    }


def fetch_transaction(cur, transaction_id: str) -> dict[str, Any] | None:
    cur.execute(
        """
        SELECT
            t.id,
            t.type,
            t.amount,
            t.currency,
            t.description,
            t.category_id,
            t.account_id,
            t.user_id,
            t.transaction_date,
            t.created_at,

            c.name AS category_name,
            c.type AS category_type,
            c.color AS category_color,
            c.icon AS category_icon,
            c.is_default AS category_is_default,
            c.is_active AS category_is_active,

            a.name AS account_name,
            a.type AS account_type,
            a.currency AS account_currency,
            a.current_balance AS account_current_balance,
            a.is_active AS account_is_active,

            u.name AS user_name,
            u.role AS user_role
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN accounts a ON a.id = t.account_id
        LEFT JOIN users u ON u.id = t.user_id
        WHERE t.id = %s;
        """,
        (transaction_id,),
    )

    rows = rows_to_dicts(cur)
    if not rows:
        return None

    return transaction_from_row(rows[0])


@app.get("/health")
def health():
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database(), current_user")
            database, user = cur.fetchone()

            cur.execute("SELECT COUNT(*) FROM transactions")
            transactions_count = cur.fetchone()[0]

    return {
        "status": "ok",
        "database": database,
        "user": user,
        "transactions": transactions_count,
    }


@app.get("/api/auth/users")
def get_auth_users():
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, role, created_at
                FROM users
                WHERE is_active IS TRUE
                ORDER BY name ASC;
                """
            )
            return rows_to_dicts(cur)


@app.post("/api/auth/login")
def login(payload: LoginRequest, request: Request):
    user_name = payload.name.strip()
    pin = payload.pin.strip()

    check_login_rate_limit(request, user_name)

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, pin_hash, role, created_at
                FROM users
                WHERE name = %s AND is_active IS TRUE;
                """,
                (user_name,),
            )
            rows = rows_to_dicts(cur)

    if not rows or not verify_pin(rows[0].get("pin_hash"), pin):
        register_failed_login(request, user_name)
        raise HTTPException(status_code=401, detail="Usuario o PIN incorrecto")

    clear_login_failures(request, user_name)

    user = rows[0]
    token = create_session_token(user)

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "pin_hash": "",
            "role": user["role"],
            "created_at": user["created_at"],
        },
    }


@app.get("/api/users")
def get_users(_auth: dict = Depends(require_auth)):
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, '' AS pin_hash, role, created_at
                FROM users
                WHERE is_active IS TRUE
                ORDER BY name ASC;
                """
            )
            return rows_to_dicts(cur)


@app.get("/api/accounts")
def get_accounts(_auth: dict = Depends(require_auth)):
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    name,
                    owner_user_id,
                    type,
                    currency,
                    initial_balance,
                    current_balance,
                    is_savings_fund,
                    is_active,
                    created_at
                FROM accounts
                WHERE is_active IS TRUE
                ORDER BY name ASC;
                """
            )
            return rows_to_dicts(cur)


@app.get("/api/categories")
def get_categories(_auth: dict = Depends(require_auth)):
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, type, color, icon, is_default, is_active, created_at
                FROM categories
                WHERE is_active IS TRUE
                ORDER BY name ASC;
                """
            )
            return rows_to_dicts(cur)


@app.post("/api/categories", status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, _auth: dict = Depends(require_auth)):
    category_id = str(uuid4())
    name = clean_required_text(payload.name, "El nombre de la categoría")
    color = clean_optional_text(payload.color)
    icon = clean_optional_text(payload.icon)

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO categories (
                    id,
                    name,
                    type,
                    color,
                    icon,
                    is_default,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, FALSE, TRUE, now(), now())
                RETURNING id, name, type, color, icon, is_default, is_active, created_at;
                """,
                (category_id, name, payload.type, color, icon),
            )
            rows = rows_to_dicts(cur)

    return rows[0]


@app.put("/api/categories/{category_id}")
def update_category(category_id: str, payload: CategoryUpdate, _auth: dict = Depends(require_auth)):
    name = clean_required_text(payload.name, "El nombre de la categoría")
    color = clean_optional_text(payload.color)
    icon = clean_optional_text(payload.icon)

    with connect() as conn:
        with conn.cursor() as cur:
            current = fetch_active_category(cur, category_id)
            if not current:
                raise HTTPException(status_code=404, detail="Categoría no encontrada")

            type_changed = payload.type != current["type"]
            if type_changed and current["is_default"]:
                raise HTTPException(
                    status_code=409,
                    detail="No se puede cambiar el tipo de una categoría predeterminada",
                )

            if type_changed and count_category_transactions(cur, category_id) > 0:
                raise HTTPException(
                    status_code=409,
                    detail="No se puede cambiar el tipo de una categoría con movimientos asociados",
                )

            cur.execute(
                """
                UPDATE categories
                SET name = %s,
                    type = %s,
                    color = %s,
                    icon = %s,
                    updated_at = now()
                WHERE id = %s
                    AND is_active IS TRUE
                RETURNING id, name, type, color, icon, is_default, is_active, created_at;
                """,
                (name, payload.type, color, icon, category_id),
            )
            rows = rows_to_dicts(cur)

    if not rows:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    return rows[0]


@app.delete("/api/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: str, _auth: dict = Depends(require_auth)):
    with connect() as conn:
        with conn.cursor() as cur:
            current = fetch_active_category(cur, category_id)
            if not current:
                raise HTTPException(status_code=404, detail="Categoría no encontrada")

            if current["is_default"]:
                raise HTTPException(
                    status_code=409,
                    detail="No se puede eliminar una categoría predeterminada",
                )

            if current["type"] == "reserva":
                reserve_balance = fetch_reserve_category_balance(cur, category_id)
                if reserve_balance != 0:
                    raise HTTPException(
                        status_code=409,
                        detail="No se puede eliminar una categoría de reserva con saldo distinto de cero",
                    )

            cur.execute(
                """
                UPDATE categories
                SET is_active = FALSE,
                    updated_at = now()
                WHERE id = %s
                    AND is_active IS TRUE
                RETURNING id;
                """,
                (category_id,),
            )
            deleted = cur.fetchone()

    if not deleted:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/transactions")
def get_transactions(_auth: dict = Depends(require_auth)):
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    t.id,
                    t.type,
                    t.amount,
                    t.currency,
                    t.description,
                    t.category_id,
                    t.account_id,
                    t.user_id,
                    t.transaction_date,
                    t.created_at,

                    c.name AS category_name,
                    c.type AS category_type,
                    c.color AS category_color,
                    c.icon AS category_icon,
                    c.is_default AS category_is_default,
                    c.is_active AS category_is_active,

                    a.name AS account_name,
                    a.type AS account_type,
                    a.currency AS account_currency,
                    a.current_balance AS account_current_balance,
                    a.is_active AS account_is_active,

                    u.name AS user_name,
                    u.role AS user_role
                FROM transactions t
                LEFT JOIN categories c ON c.id = t.category_id
                LEFT JOIN accounts a ON a.id = t.account_id
                LEFT JOIN users u ON u.id = t.user_id
                ORDER BY t.transaction_date DESC;
                """
            )
            rows = rows_to_dicts(cur)

    return [transaction_from_row(row) for row in rows]


@app.post("/api/transactions", status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate, _auth: dict = Depends(require_auth)):
    amount = parse_amount(payload.amount)
    tx_date = parse_transaction_date(payload.transaction_date)
    tx_id = str(uuid4())
    description = payload.description.strip() if payload.description and payload.description.strip() else None

    balance_delta = amount if payload.type == "ingreso" else -amount

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM accounts WHERE id = %s AND is_active IS TRUE;",
                (payload.account_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=400, detail="La cuenta no existe o está inactiva")

            cur.execute(
                "SELECT id FROM categories WHERE id = %s AND is_active IS TRUE;",
                (payload.category_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=400, detail="La categoría no existe o está inactiva")

            cur.execute(
                "SELECT id FROM users WHERE id = %s AND is_active IS TRUE;",
                (payload.user_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=400, detail="El usuario no existe o está inactivo")

            cur.execute(
                """
                INSERT INTO transactions (
                    id,
                    type,
                    amount,
                    currency,
                    description,
                    category_id,
                    account_id,
                    user_id,
                    transaction_date,
                    source,
                    created_at,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'web-postgres', now(), now());
                """,
                (
                    tx_id,
                    payload.type,
                    amount,
                    payload.currency,
                    description,
                    payload.category_id,
                    payload.account_id,
                    payload.user_id,
                    tx_date,
                ),
            )

            cur.execute(
                """
                UPDATE accounts
                SET current_balance = current_balance + %s,
                    updated_at = now()
                WHERE id = %s;
                """,
                (balance_delta, payload.account_id),
            )

            created = fetch_transaction(cur, tx_id)

    if not created:
        raise HTTPException(status_code=500, detail="No se pudo recuperar el movimiento creado")

    return created


@app.delete("/api/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: str, _auth: dict = Depends(require_auth)):
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, type, amount, account_id
                FROM transactions
                WHERE id = %s;
                """,
                (transaction_id,),
            )
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Movimiento no encontrado")

            _, tx_type, amount, account_id = row
            reverse_delta = -amount if tx_type == "ingreso" else amount

            cur.execute("DELETE FROM transactions WHERE id = %s;", (transaction_id,))

            if account_id:
                cur.execute(
                    """
                    UPDATE accounts
                    SET current_balance = current_balance + %s,
                        updated_at = now()
                    WHERE id = %s;
                    """,
                    (reverse_delta, account_id),
                )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
