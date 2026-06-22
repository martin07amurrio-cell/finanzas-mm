import os
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


DB_HOST = os.getenv("FINANZAS_DB_HOST", "edith-postgres")
DB_PORT = int(os.getenv("FINANZAS_DB_PORT", "5432"))
DB_NAME = os.getenv("FINANZAS_DB_NAME", "finanzas_mm")
DB_USER = os.getenv("FINANZAS_DB_USER", "finanzas_mm")
DB_PASSWORD_FILE = os.getenv("FINANZAS_DB_PASSWORD_FILE", "/secrets/postgres_password")


app = FastAPI(title="Finanzas MM API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.get("/api/users")
def get_users():
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, pin_hash, role, created_at
                FROM users
                ORDER BY name ASC;
                """
            )
            return rows_to_dicts(cur)


@app.get("/api/accounts")
def get_accounts():
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
def get_categories():
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, type, color, icon, is_active, created_at
                FROM categories
                WHERE is_active IS TRUE
                ORDER BY name ASC;
                """
            )
            return rows_to_dicts(cur)


@app.get("/api/transactions")
def get_transactions():
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

    transactions = []

    for row in rows:
        transactions.append(
            {
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
        )

    return transactions
