#!/usr/bin/env bash
# Backup portátil PostgreSQL en formato personalizado.
# Invocar con BACKUP_DIR apuntando a una ruta externa al repositorio.
set -euo pipefail
umask 077

: "${BACKUP_DIR:?Definí BACKUP_DIR con una carpeta protegida fuera del repositorio}"
if [[ "${BACKUP_DIR}" != /* || "${BACKUP_DIR}" == "/" ]]; then
  echo "BACKUP_DIR debe ser una ruta absoluta válida." >&2
  exit 1
fi

cd "$(dirname "$0")/.."
mkdir -p "$BACKUP_DIR"
outfile="$BACKUP_DIR/hogar-mm-$(date -u +%Y%m%dT%H%M%SZ).dump"
if docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T db \
    pg_dump -U hogar_mm -d hogar_mm --format=custom --no-owner --no-privileges > "$outfile"; then
  if [[ ! -s "$outfile" ]]; then
    rm -f "$outfile"
    echo "La copia se generó vacía; revisá PostgreSQL." >&2
    exit 1
  fi
  chmod 600 "$outfile"
  echo "Backup creado: $outfile"
else
  rm -f "$outfile"
  echo "Falló el backup: no se conservaron archivos incompletos." >&2
  exit 1
fi
