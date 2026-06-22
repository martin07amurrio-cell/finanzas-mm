import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import psycopg


BACKUP_DIR = Path(os.environ["BACKUP_DIR"])
DB_HOST = os.getenv("FINANZAS_DB_HOST", "edith-postgres")
DB_PORT = int(os.getenv("FINANZAS_DB_PORT", "5432"))
DB_NAME = os.getenv("FINANZAS_DB_NAME", "finanzas_mm")
DB_USER = os.getenv("FINANZAS_DB_USER", "finanzas_mm")
DB_PASSWORD_FILE = Path(os.environ["FINANZAS_DB_PASSWORD_FILE"])


def read_password():
    return DB_PASSWORD_FILE.read_text(encoding="utf-8").strip()


def connect():
    return psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=read_password(),
    )


def load_docs(collection_name):
    file_path = BACKUP_DIR / f"{collection_name}.json"
    payload = json.loads(file_path.read_text(encoding="utf-8"))
    return payload["docs"]


def parse_timestamp(value):
    if not value:
        return None

    if isinstance(value, dict) and value.get("__type") == "timestamp":
        value = value.get("value")

    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    return None


def as_text(value, default=None):
    if value is None:
        return default
    return str(value)


def as_money(value):
    if value is None or value == "":
        return Decimal("0")
    return Decimal(str(value))


def apply_schema(conn):
    schema = Path("backend/schema.sql").read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(schema)
    conn.commit()


def import_users(conn, docs):
    with conn.cursor() as cur:
        for doc in docs:
            data = doc["data"]
            cur.execute(
                """
                INSERT INTO users (
                    id, name, pin_hash, role, created_at
                )
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    pin_hash = EXCLUDED.pin_hash,
                    role = EXCLUDED.role,
                    created_at = EXCLUDED.created_at;
                """,
                (
                    doc["id"],
                    as_text(data.get("name"), "Sin nombre"),
                    as_text(data.get("pin_hash"), ""),
                    as_text(data.get("role"), "user"),
                    parse_timestamp(data.get("created_at")),
                ),
            )
    conn.commit()


def import_accounts(conn, docs):
    with conn.cursor() as cur:
        for doc in docs:
            data = doc["data"]
            cur.execute(
                """
                INSERT INTO accounts (
                    id, name, owner_user_id, type, currency, current_balance
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    owner_user_id = EXCLUDED.owner_user_id,
                    type = EXCLUDED.type,
                    currency = EXCLUDED.currency,
                    current_balance = EXCLUDED.current_balance;
                """,
                (
                    doc["id"],
                    as_text(data.get("name"), "Cuenta sin nombre"),
                    as_text(data.get("owner_user_id")),
                    as_text(data.get("type"), "cash"),
                    as_text(data.get("currency"), "ARS"),
                    as_money(data.get("current_balance")),
                ),
            )
    conn.commit()


def import_categories(conn, docs):
    with conn.cursor() as cur:
        for doc in docs:
            data = doc["data"]
            cur.execute(
                """
                INSERT INTO categories (
                    id, name, type, color, icon, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    type = EXCLUDED.type,
                    color = EXCLUDED.color,
                    icon = EXCLUDED.icon,
                    created_at = EXCLUDED.created_at;
                """,
                (
                    doc["id"],
                    as_text(data.get("name"), "Sin categoría"),
                    as_text(data.get("type"), "gasto"),
                    as_text(data.get("color")),
                    as_text(data.get("icon")),
                    parse_timestamp(data.get("created_at")),
                ),
            )
    conn.commit()


def import_transactions(conn, docs):
    with conn.cursor() as cur:
        for doc in docs:
            data = doc["data"]
            cur.execute(
                """
                INSERT INTO transactions (
                    id, type, amount, currency, description,
                    category_id, account_id, user_id, transaction_date
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    type = EXCLUDED.type,
                    amount = EXCLUDED.amount,
                    currency = EXCLUDED.currency,
                    description = EXCLUDED.description,
                    category_id = EXCLUDED.category_id,
                    account_id = EXCLUDED.account_id,
                    user_id = EXCLUDED.user_id,
                    transaction_date = EXCLUDED.transaction_date;
                """,
                (
                    doc["id"],
                    as_text(data.get("type"), "gasto"),
                    as_money(data.get("amount")),
                    as_text(data.get("currency"), "ARS"),
                    as_text(data.get("description")),
                    as_text(data.get("category_id")),
                    as_text(data.get("account_id")),
                    as_text(data.get("user_id")),
                    parse_timestamp(data.get("transaction_date")) or datetime.now(timezone.utc),
                ),
            )
    conn.commit()


def count_table(conn, table_name):
    with conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        return cur.fetchone()[0]


def main():
    expected = {
        "users": len(load_docs("users")),
        "accounts": len(load_docs("accounts")),
        "categories": len(load_docs("categories")),
        "transactions": len(load_docs("transactions")),
    }

    with connect() as conn:
        apply_schema(conn)

        import_users(conn, load_docs("users"))
        import_accounts(conn, load_docs("accounts"))
        import_categories(conn, load_docs("categories"))
        import_transactions(conn, load_docs("transactions"))

        actual = {
            "users": count_table(conn, "users"),
            "accounts": count_table(conn, "accounts"),
            "categories": count_table(conn, "categories"),
            "transactions": count_table(conn, "transactions"),
        }

    result = {
        "backup_dir": str(BACKUP_DIR),
        "expected": expected,
        "actual": actual,
        "ok": expected == actual,
    }

    print(json.dumps(result, indent=2, ensure_ascii=False))

    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
