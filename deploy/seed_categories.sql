-- Categorías iniciales editables de Hogarchito (economía familiar).
-- Idempotente: no duplica categoría activa con mismo nombre y tipo.
-- Ejecutar en PostgreSQL del proyecto hogar-mm, no en D3S/JARVIS.
-- Solo crea categorías, sin tocar cuentas, usuarios, movimientos ni PIN.
BEGIN;

INSERT INTO categories (
    id, name, type, color, icon, is_default, is_active, created_at, updated_at
)
SELECT
    gen_random_uuid()::text, seed.name, seed.type, seed.color, seed.icon,
    FALSE, TRUE, now(), now()
FROM (VALUES
    ('Vivienda y alquiler', 'gasto', '#EBC8E6', 'House'),
    ('Servicios (luz, agua y gas)', 'gasto', '#D7C1F5', 'Receipt'),
    ('Internet y celular', 'gasto', '#D9C6F2', 'Smartphone'),
    ('Supermercado', 'gasto', '#F4B4D2', 'ShoppingCart'),
    ('Verdulería y carnicería', 'gasto', '#F8C9DF', 'Carrot'),
    ('Comidas afuera y delivery', 'gasto', '#EDBEDD', 'Utensils'),
    ('Transporte', 'gasto', '#C9B4F3', 'Car'),
    ('Salud y farmacia', 'gasto', '#D7BDF2', 'HeartPulse'),
    ('Cuidado personal', 'gasto', '#F4C1DD', 'Sparkles'),
    ('Hogar y mantenimiento', 'gasto', '#C9B6EF', 'Wrench'),
    ('Ropa y calzado', 'gasto', '#EEC9E8', 'Shirt'),
    ('Salidas y entretenimiento', 'gasto', '#DCB5F4', 'Clapperboard'),
    ('Suscripciones', 'gasto', '#DFC5F2', 'MonitorPlay'),
    ('Regalos y celebraciones', 'gasto', '#F6C8DF', 'Gift'),
    ('Otros gastos e imprevistos', 'gasto', '#D8CEE8', 'CircleHelp'),
    ('Ingresos Martín', 'ingreso', '#BFA8F2', 'Wallet'),
    ('Ingresos Micaela', 'ingreso', '#F5BBD7', 'Wallet'),
    ('Retiros del emprendimiento', 'ingreso', '#D6B9F2', 'HandCoins'),
    ('Reintegros y devoluciones', 'ingreso', '#EBC3E4', 'RefreshCw'),
    ('Otros ingresos', 'ingreso', '#CDC0EF', 'PlusCircle'),
    ('Fondo de emergencia', 'reserva', '#BEAFF3', 'ShieldCheck'),
    ('Ahorro familiar', 'reserva', '#F1BEDD', 'PiggyBank'),
    ('Vacaciones y proyectos', 'reserva', '#D4BFF4', 'Plane')
) AS seed(name, type, color, icon)
WHERE NOT EXISTS (
    SELECT 1
    FROM categories AS existing
    WHERE lower(existing.name) = lower(seed.name)
      AND existing.type = seed.type
      AND existing.is_active IS TRUE
);

COMMIT;
