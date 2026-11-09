# Hogar M&M

Aplicación familiar compartida para dos usuarios, con organización diaria, finanzas, supermercado, despensa, recetas, menú, limpieza y objetivos.

## Tecnologías
- Interfaz: React, Vite, TypeScript y Tailwind CSS.
- API: Python y FastAPI.
- Datos: PostgreSQL.
- Autenticación: PIN de seis dígitos con PBKDF2 y secreto de sesión del servidor.

## Estado
- Desarrollo en `desarrollo/hogar-mm`. No desplegado.
- El backend financiero original y módulos familiares conviven en la misma base PostgreSQL.
- Las integraciones históricas con Firebase y Telegram siguen en el repositorio, pero **no** son necesarias para la aplicación web en esta versión.

## Instalación desde cero
1. Preparar una base PostgreSQL vacía y un usuario con acceso limitado a ella.
2. Aplicar `backend/schema.sql` con `psql -v ON_ERROR_STOP=1 -f backend/schema.sql`. Incluye finanzas y hogar.
3. Crear archivos de secretos **fuera del repositorio** para PostgreSQL (`FINANZAS_DB_PASSWORD_FILE`) y firma de sesiones (`FINANZAS_AUTH_SECRET_FILE`).
4. Instalar dependencias Python de `backend/requirements.txt`, definir `FINANZAS_DB_*` e iniciar FastAPI con `uvicorn app.main:app --app-dir backend`.
5. Crear los dos usuarios (sin publicar ni compartir PIN): `PYTHONPATH=backend python backend/scripts/bootstrap_user.py --user "Martín"` y `--user "Micaela"`. Cada PIN debe ser de seis dígitos.
6. Instalar dependencias frontend (`npm ci`), configurar `VITE_API_BASE_URL` si la API se sirve en distinto origen y generar (`npm run build`).
7. Configurar HTTPS, proxy y `CORS_ORIGINS` exclusivamente con los orígenes autorizados; verificar login, compras, despensa, tareas, limpieza, objetivos y finanzas en dos dispositivos.
8. Configurar backup PostgreSQL cifrado y restauración verificada antes de usar datos reales.

## Seguridad
- No utilizar ningún PIN mencionado en archivos históricos. Los nuevos PIN son hasheados, no se guardan en texto plano.
- El repositorio sigue público y contiene material histórico: revisar y sanear antes de incorporar datos o secretos.
- No publicar una instancia mientras las comprobaciones y pruebas de autenticación no estén completas.
- El límite de intentos de autenticación se implementa actualmente en memoria de proceso; para despliegues con múltiples réplicas requiere una solución centralizada.

## Funcionalidades pendientes
- Interpretar recetas como ingredientes estructurados y generar faltantes automáticamente.
- Control de caducidad y descuento automático de existencias al cocinar.
- Agenda con horas, recurrencias avanzadas y sincronización.
- Reportes integrados de compras y finanzas, junto con más pruebas de integración.
