# Despliegue temporal en VPS D3S y posterior migración a Hostinger

La configuración es **autónoma**: Docker Compose crea PostgreSQL, API FastAPI y web Nginx de Hogar M&M, sin enlazar la red `jarvis-net` ni utilizar la base de datos de D3S/JARVIS. El servidor de D3S solo aporta recursos de CPU/RAM/disco y el proxy HTTPS existente.

**No usar** `backend/docker-compose.yml` para esta instalación: es un manifiesto legado que depende de PostgreSQL y secretos del entorno empresarial. Usar siempre `deploy/compose.yaml`.

## Precondiciones

- Confirmar con el administrador de D3S que el VPS tiene capacidad libre y que existe un proxy HTTPS (Caddy/Nginx/Traefik) que pueda servir un host adicional, sin alterar los demás.
- Docker Engine + Docker Compose plugin, Git y OpenSSL instalados en el VPS.
- Acceso SSH administrativo a la máquina. No compartir claves, contraseñas ni PIN por ChatGPT.
- Control DNS de `nerohm.com.ar`. Reservar el host `hogar.nerohm.com.ar` y apuntarlo a la IP pública del VPS de D3S.
- Verificar que el puerto TCP `8035` del host no esté ocupado (`ss -ltn | grep ':8035 '`). Cambiar `HOGAR_HTTP_PORT` si es necesario.

## 1. Preparar instalación limpia

Desde un terminal del VPS con permisos adecuados (adaptar usuario y rutas):

```bash
sudo mkdir -p /opt/hogar-mm/secrets /opt/hogar-mm/backups
sudo chmod 700 /opt/hogar-mm/secrets /opt/hogar-mm/backups
sudo chown "$USER":"$USER" /opt/hogar-mm/secrets /opt/hogar-mm/backups
git clone --branch desarrollo/hogar-mm https://github.com/martin07amurrio-cell/finanzas-mm.git /opt/hogar-mm/app
cd /opt/hogar-mm/app
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
umask 077
openssl rand -base64 48 > /opt/hogar-mm/secrets/db_password
openssl rand -hex 64 > /opt/hogar-mm/secrets/auth_secret
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
```

La base PostgreSQL se inicializa usando `backend/schema.sql` **solo** cuando el volumen está vacío. No hay credenciales predeterminadas ni PIN iniciales. El script de aplicación financiera no recibe acceso a datos de D3S.

## 2. Configurar usuarios

Usar la terminal interactiva del VPS:

```bash
cd /opt/hogar-mm/app
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -it api \
  python /app/scripts/bootstrap_user.py --user "Martín"
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -it api \
  python /app/scripts/bootstrap_user.py --user "Micaela"
```

Cada persona elige un PIN de seis dígitos distinto; el script lo solicita de manera oculta. Nunca colocarlos como argumentos de comandos ni en archivos dentro del repositorio.

## 3. Exponer únicamente HTTPS

La web escucha **solo** en `127.0.0.1:8035` del VPS; la API y PostgreSQL no publican puertos del host. El proxy HTTPS de D3S debe enrutar el host `hogar.nerohm.com.ar` a `http://127.0.0.1:8035`.

Si D3S usa **Caddy**, el administrador puede incorporar este bloque al Caddyfile activo (sin sustituir el resto de hosts):

```caddyfile
hogar.nerohm.com.ar {
    reverse_proxy 127.0.0.1:8035
}
```

Verificar la sintaxis con `caddy validate` y recargar de forma segura según el servicio existente. **No** instalar otro proxy que tome puertos 80/443 si ya están ocupados por JARVIS/D3S.

En el proveedor DNS de NEROHM, crear un registro `A` para `hogar` apuntando a la IP pública de D3S; puede usarse TTL de 300 segundos para facilitar la futura migración (si el proveedor lo permite).

## 4. Verificar antes de cargar datos reales

```bash
cd /opt/hogar-mm/app
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
curl -fsS http://127.0.0.1:8035/health
curl -I https://hogar.nerohm.com.ar/
```

Probar inicio de sesión con ambos usuarios, altas y edición de tareas, compra→despensa, recetas, limpieza y carga de cuentas e ingresos/gastos. La API requiere sesión; no suponer que la compilación de GitHub valida comportamiento con PostgreSQL real.

## 5. Backups

Ejemplo de backup manual:

```bash
cd /opt/hogar-mm/app
BACKUP_DIR=/opt/hogar-mm/backups bash deploy/backup.sh
```

Agregar un trabajo diario supervisado y cifrar/copiar respaldos a un destino **fuera del VPS de D3S** (un backup solo en el mismo VPS no protege frente a falla total o pérdida del acceso). Probar restauraciones periódicamente. No subir los dumps al repositorio.

## 6. Migrar más adelante a VPS de NEROHM/Hostinger

1. Instalar Docker/Compose en el VPS nuevo y usar **el mismo commit** del repositorio, el mismo archivo Compose y las mismas variables `deploy/.env` adaptadas a la ruta nueva.
2. Crear secretos nuevos; mantener seguros los originales hasta verificar la migración. Crear el volumen PostgreSQL nuevo vacío e iniciar los contenedores, lo que aplicará el esquema base.
3. Anunciar ventana de mantenimiento para evitar que se creen datos nuevos durante el traslado.
4. En D3S generar una copia **de datos** compatible con el esquema inicial:
   ```bash
   cd /opt/hogar-mm/app
   umask 077
   docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T db \
     pg_dump -U hogar_mm -d hogar_mm --data-only --format=custom --no-owner --no-privileges \
     > /opt/hogar-mm/backups/hogar-mm-migracion-data.dump
   ```
   Transferir el archivo cifrado por un canal seguro al nuevo VPS. Verificar la integridad del archivo.
5. En el nuevo VPS, con PostgreSQL inicializado con el **mismo esquema** y sin datos previos:
   ```bash
   docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T db \
     pg_restore -U hogar_mm -d hogar_mm --data-only --no-owner --no-privileges \
     < /ruta/segura/hogar-mm-migracion-data.dump
   ```
   Si la estructura cambió desde la primera versión, utilizar una estrategia de migración de esquema y restauración verificada, en vez de ejecutar el ejemplo sin ajustes.
6. Comprobar recuentos e integridad de datos, login, API y frontend en el nuevo VPS (idealmente usando un host temporal de prueba protegido).
7. Cambiar **solo** el registro DNS `A` de `hogar.nerohm.com.ar` a la IP de Hostinger. Esperar propagación; mantener D3S sin permitir nuevas escrituras hasta confirmar el corte definitivo para evitar divergencias.
8. Una vez confirmada la operación y las copias, retirar el servicio temporal de D3S de forma controlada. No eliminar volúmenes de forma anticipada.

El subdominio público permanece igual antes y después de migrar, de modo que los enlaces de los celulares no cambian.
