# Hogar M&M — primera implementación

Rama: `desarrollo/hogar-mm`. No despliega a producción ni altera finanzas existentes.

## Incluido
- Inicio familiar con resumen de pendientes y accesos rápidos.
- Agenda, tareas, supermercado, despensa, recetas, menú, limpieza y objetivos.
- CRUD con sesiones existentes mediante `/api/hogar/items`.
- Compras: acción explícita «Comprado» incorpora producto a despensa en la misma transacción, sin crear gasto (el importe se carga por Finanzas).
- Limpieza: completar una rutina periódica calcula la próxima fecha; no crea tareas duplicadas.
- Objetivos: progreso y meta numéricos.
- Mantiene Inicio financiero, Movimientos, Cargar, Reportes y Más. El dashboard financiero queda accesible como «Finanzas».

## Pendiente antes de desplegar
1. Hacer backup de la base PostgreSQL.
2. Aplicar una vez `backend/migrations/001_hogar_mm.sql` sobre la base de `finanzas_mm`. La API nueva falla si no se hace.
3. Desplegar API FastAPI y frontend juntos (o indicar `VITE_API_BASE_URL` con CORS restringido al dominio autorizado).
4. Ejecutar `npm ci && npm run build && npm run lint` y `python -m compileall -q backend/app`; realizar pruebas de autenticación y datos desde dos sesiones.
5. No publicar credenciales ni datos de producción en GitHub. El repositorio público contiene documentación histórica con PIN; rotar los PIN e inspeccionar las reglas actuales de Firestore.
6. Verificar copias de seguridad, permisos, HTTPS, recursos del VPS y autorización de usuarios antes de usar datos familiares reales.

## Límites conocidos
- Recetas y menú admiten texto de ingredientes y preparación; no calculan faltantes automáticamente.
- La agenda todavía no sincroniza Google Calendar.
- Limpieza por días, sin reglas complejas de recurrencia.
- Datos compartidos entre ambos usuarios autenticados; no hay control de acceso por área.
- El inicio muestra accesos a Hogar; todos llevan al módulo de Hogar desde donde se elige la sección.
- La creación de compra no genera automáticamente un gasto financiero; esto evita importes inventados.
- El dashboard financiero conserva la lógica anterior.
- El proyecto no está publicado ni verificado con un entorno PostgreSQL real desde este cambio.
