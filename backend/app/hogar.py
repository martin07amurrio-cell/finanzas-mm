"""API familiar. Los datos se comparten entre los dos usuarios autenticados.
Requiere ejecutar backend/migrations/001_hogar_mm.sql antes de desplegar.
"""
import os
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Literal
from uuid import uuid4

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth import require_auth

router = APIRouter(prefix="/api/hogar", tags=["hogar"])
Section = Literal["agenda", "tareas", "compras", "despensa", "recetas", "menu", "limpieza", "objetivos"]
Status = Literal["pendiente", "hecho"]
Assignee = Literal["Martín", "Micaela", "Ambos"]


class EntryInput(BaseModel):
    section: Section
    title: str = Field(min_length=1, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    details: str | None = Field(default=None, max_length=4000)
    due_on: date | None = None
    assignee: Assignee | None = None
    quantity: Decimal | None = Field(default=None, ge=0, le=999999999)
    unit: str | None = Field(default=None, max_length=30)
    status: Status = "pendiente"
    repeat_days: int | None = Field(default=None, ge=1, le=365)
    progress: Decimal | None = Field(default=None, ge=0, le=999999999)
    target: Decimal | None = Field(default=None, gt=0, le=999999999)


class Completion(BaseModel):
    done: bool


def connect():
    password = Path(os.getenv("FINANZAS_DB_PASSWORD_FILE", "/secrets/postgres_password")).read_text(encoding="utf-8").strip()
    return psycopg.connect(
        host=os.getenv("FINANZAS_DB_HOST", "edith-postgres"),
        port=int(os.getenv("FINANZAS_DB_PORT", "5432")),
        dbname=os.getenv("FINANZAS_DB_NAME", "finanzas_mm"),
        user=os.getenv("FINANZAS_DB_USER", "finanzas_mm"),
        password=password,
    )


FIELDS = (
    "id, section, title, notes, details, due_on, assignee, quantity, unit, "
    "status, repeat_days, progress, target, created_by, created_at, updated_at"
)


def entry_dict(row, description):
    result = dict(zip([col.name for col in description], row))
    for key in ("quantity", "progress", "target"):
        if result[key] is not None:
            result[key] = float(result[key])
    for key in ("created_at", "updated_at", "due_on"):
        if result[key] is not None:
            result[key] = result[key].isoformat()
    return result


def fetch_entry(cur, entry_id):
    cur.execute(f"SELECT {FIELDS} FROM household_entries WHERE id = %s", (entry_id,))
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Elemento no encontrado")
    return entry_dict(row, cur.description)


def values(payload: EntryInput):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="El título es obligatorio")
    return (
        payload.section, title, payload.notes, payload.details,
        payload.due_on, payload.assignee, payload.quantity,
        payload.unit.strip() if payload.unit else None,
        payload.status, payload.repeat_days, payload.progress, payload.target,
    )


@router.get("/items")
def list_items(section: Section | None = None, _user: dict = Depends(require_auth)):
    with connect() as conn:
        with conn.cursor() as cur:
            if section:
                cur.execute(
                    f"SELECT {FIELDS} FROM household_entries WHERE section = %s ORDER BY CASE WHEN status='pendiente' THEN 0 ELSE 1 END, due_on ASC NULLS LAST, created_at DESC LIMIT 500",
                    (section,),
                )
            else:
                cur.execute(
                    f"SELECT {FIELDS} FROM household_entries ORDER BY created_at DESC LIMIT 1000"
                )
            description = cur.description
            return [entry_dict(row, description) for row in cur.fetchall()]


@router.post("/items", status_code=201)
def create_item(payload: EntryInput, user: dict = Depends(require_auth)):
    entry_id = str(uuid4())
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO household_entries (
                id, section, title, notes, details, due_on, assignee, quantity, unit,
                status, repeat_days, progress, target, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (entry_id, *values(payload), user["sub"]),
            )
            return fetch_entry(cur, entry_id)


@router.put("/items/{entry_id}")
def update_item(entry_id: str, payload: EntryInput, _user: dict = Depends(require_auth)):
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE household_entries
                SET section=%s, title=%s, notes=%s, details=%s, due_on=%s,
                    assignee=%s, quantity=%s, unit=%s, status=%s, repeat_days=%s,
                    progress=%s, target=%s, updated_at=now()
                WHERE id=%s""",
                (*values(payload), entry_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Elemento no encontrado")
            return fetch_entry(cur, entry_id)


@router.delete("/items/{entry_id}", status_code=204)
def delete_item(entry_id: str, _user: dict = Depends(require_auth)):
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM household_entries WHERE id=%s", (entry_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Elemento no encontrado")
    return Response(status_code=204)


@router.post("/items/{entry_id}/complete")
def complete_item(entry_id: str, payload: Completion, _user: dict = Depends(require_auth)):
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT section, due_on, repeat_days FROM household_entries WHERE id=%s FOR UPDATE", (entry_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Elemento no encontrado")
            section, due_on, repeat_days = row
            if section == "compras" and payload.done:
                raise HTTPException(status_code=409, detail="Usá la acción Comprar para actualizar también la despensa")
            if section == "limpieza" and payload.done and repeat_days:
                next_due = max(due_on or date.today(), date.today()) + timedelta(days=repeat_days)
                cur.execute("UPDATE household_entries SET due_on=%s, status='pendiente', updated_at=now() WHERE id=%s", (next_due, entry_id))
            else:
                cur.execute("UPDATE household_entries SET status=%s, updated_at=now() WHERE id=%s", ("hecho" if payload.done else "pendiente", entry_id))
            return fetch_entry(cur, entry_id)


@router.post("/items/{entry_id}/purchase")
def purchase_item(entry_id: str, user: dict = Depends(require_auth)):
    """Compra confirmada: mueve la cantidad a despensa en una transacción atómica.
    No registra gastos automáticamente (se cargan con importe real en Finanzas).
    """
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT title, notes, quantity, unit, status, section FROM household_entries WHERE id=%s FOR UPDATE", (entry_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Producto no encontrado")
            title, notes, quantity, unit, state, section = row
            if section != "compras":
                raise HTTPException(status_code=409, detail="El elemento no pertenece a compras")
            if state == "hecho":
                raise HTTPException(status_code=409, detail="El producto ya fue comprado")
            quantity = quantity if quantity is not None else Decimal("1")
            cur.execute(
                """SELECT id FROM household_entries
                WHERE section='despensa' AND status='pendiente'
                AND lower(title)=lower(%s) AND coalesce(lower(unit),'')=coalesce(lower(%s),'')
                ORDER BY created_at LIMIT 1 FOR UPDATE""",
                (title, unit),
            )
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    "UPDATE household_entries SET quantity=coalesce(quantity,0)+%s, updated_at=now() WHERE id=%s",
                    (quantity, existing[0]),
                )
            else:
                cur.execute(
                    """INSERT INTO household_entries (id,section,title,notes,quantity,unit,status,created_by)
                    VALUES (%s,'despensa',%s,%s,%s,%s,'pendiente',%s)""",
                    (str(uuid4()), title, notes, quantity, unit, user["sub"]),
                )
            cur.execute("UPDATE household_entries SET status='hecho', updated_at=now() WHERE id=%s", (entry_id,))
            return fetch_entry(cur, entry_id)
