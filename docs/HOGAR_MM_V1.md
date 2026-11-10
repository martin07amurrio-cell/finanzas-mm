# Hogar M&M — primera versión desde cero

## Estado y propósito

La aplicación anterior **no está desplegada ni tiene datos financieros que conservar**. El repositorio de Finanzas M&M se reutiliza como base para una aplicación familiar nueva para Martín y Micaela. No migrar datos ficticios, PIN antiguos ni configuraciones de Firebase heredadas.

El desarrollo está en la rama `desarrollo/hogar-mm`. No ha sido publicado ni verificado contra una instancia real de PostgreSQL.

## Funcionalidades incluidas

- Inicio del hogar con resumen de pendientes y próximas actividades.
- Agenda y tareas asignables a Martín, Micaela o ambos.
- Lista de supermercado y despensa: «Comprado» traslada la cantidad a despensa en una transacción de base de datos.
- Recetas y menú como registros con ingredientes e instrucciones en texto.
- Limpieza con recurrencias sencillas en días.
- Objetivos con avance y valor objetivo.
- Finanzas: conserva el código de saldos, ingresos, gastos y reportes para adaptarlo luego a la estructura familiar.
- API nueva con sesiones existentes, usando el backend FastAPI y PostgreSQL.

## Inicialización en una base vacía

1. Crear **una base de datos PostgreSQL privada** para Hogar M&M y un usuario SQL de privilegios mínimos. No compartir usuarios ni credenciales con JARVIS/D3S.
2. Configurar en el entorno seguro `FINANZAS_DB_HOST`, `FINANZAS_DB_NAME`, `FINANZAS_DB_USER`, `FINANZAS_DB_PASSWORD_FILE` y `FINANZAS_AUTH_SECRET_FILE`. Generar un secreto largo nuevo; no incluirlo en Git.
3. Ejecutar `backend/schema.sql` y luego `backend/migrations/001_hogar_mm.sql`.
4. Configurar **nuevos PIN exclusivos** desde terminal, nunca desde el chat:
   `PYTHONPATH=backend python backend/scripts/bootstrap_user.py --user "Martín"`
   `PYTHONPATH=backend python backend/scripts/bootstrap_user.py --user "Micaela"`
   El script solicita PIN de 4 dígitos y los almacena con PBKDF2-SHA256 + sal.
5. Probar API y frontend sin datos reales. Evitar crear o usar usuarios demo con PIN conocido.
6. Configurar HTTPS y el dominio `finanzas.nerohm.com.ar` o la dirección definitiva que se elija.

## Validaciones

- `npm ci && npm run build`
- `npx eslint src/pages/hogar src/services/hogar.ts`
- `PYTHONPATH=backend python -m unittest discover -s backend/tests`
- `python -m compileall -q backend/app backend/scripts`
- Pruebas manuales con ambos usuarios: inicio de sesión, gastos, compras → despensa, menú, rutina periódica, eliminación y cierre de sesión.

El lint general original tiene errores anteriores a este desarrollo; no declarar el proyecto entero libre de errores mientras no se corrijan.

## Seguridad antes de publicar

- El repositorio público contiene documentación anterior con PIN débiles y reglas antiguas de Firestore. No usar los PIN anteriores. Eliminar contenido sensible y revisar el historial de Git si corresponde.
- Los módulos nuevos comparten datos entre los dos usuarios autorizados. No se implementaron permisos por sección ni auditoría de modificaciones.
- Revisar restricciones CORS, cookies/tokens, caducidad y protección contra fuerza bruta antes de exponer la API a internet.
- Mantener copias de seguridad periódicas de PostgreSQL una vez que se utilicen datos reales.

## Pendiente para futuras iteraciones

- Carga guiada de cuentas y categorías desde la app.
- Sugerencias automáticas de recetas según despensa, descontar alimentos al cocinar y fechas de vencimiento.
- Planificación inteligente semanal en función de los turnos cambiantes.
- Integración de EDITH y calendario externo.
- Recordatorios y notificaciones.
