-- Hogar M&M: datos familiares compartidos. Ejecutar una sola vez en la DB finanzas_mm.
-- No modifica ninguna tabla de finanzas existentes.
CREATE TABLE IF NOT EXISTS household_entries (
    id TEXT PRIMARY KEY,
    section TEXT NOT NULL CHECK (section IN ('agenda','tareas','compras','despensa','recetas','menu','limpieza','objetivos')),
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    notes TEXT,
    details TEXT,
    due_on DATE,
    assignee TEXT CHECK (assignee IN ('Martín','Micaela','Ambos')),
    quantity NUMERIC(12,2) CHECK (quantity IS NULL OR quantity >= 0),
    unit TEXT,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','hecho')),
    repeat_days INTEGER CHECK (repeat_days IS NULL OR repeat_days BETWEEN 1 AND 365),
    progress NUMERIC(12,2) CHECK (progress IS NULL OR progress >= 0),
    target NUMERIC(12,2) CHECK (target IS NULL OR target > 0),
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_household_entries_section_status ON household_entries(section, status);
CREATE INDEX IF NOT EXISTS idx_household_entries_due_on ON household_entries(due_on);
