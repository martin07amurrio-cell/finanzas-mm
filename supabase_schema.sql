-- Initial Schema for Finanzas M&M

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Accounts table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_user_id UUID REFERENCES users(id),
    type TEXT NOT NULL, -- 'cash', 'bank', 'fintech', 'savings'
    currency TEXT NOT NULL DEFAULT 'ARS',
    initial_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    is_savings_fund BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'gasto', 'ingreso', 'deuda', 'ahorro', 'inversión', 'pago fijo', 'transferencia'
    color TEXT,
    icon TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debts table
CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creditor_name TEXT NOT NULL,
    original_amount DECIMAL(15, 2) NOT NULL,
    remaining_amount DECIMAL(15, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    installments_total INTEGER DEFAULT 1,
    installments_paid INTEGER DEFAULT 0,
    monthly_payment_amount DECIMAL(15, 2),
    status TEXT NOT NULL DEFAULT 'activa', -- 'activa', 'pagada', 'vencida', 'pausada'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fixed Payments table
CREATE TABLE fixed_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES categories(id),
    estimated_amount DECIMAL(15, 2),
    currency TEXT NOT NULL DEFAULT 'ARS',
    account_id UUID REFERENCES accounts(id),
    frequency TEXT DEFAULT 'mensual',
    due_day INTEGER,
    next_due_date DATE,
    reminder_days_before INTEGER DEFAULT 3,
    requires_manual_confirmation BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'activo',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'ingreso', 'gasto', 'pago fijo', 'deuda adquirida', 'pago de deuda', 'transferencia', 'ahorro', 'inversión', 'compra de dólares'
    amount DECIMAL(15, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    ars_equivalent_amount DECIMAL(15, 2),
    exchange_rate DECIMAL(15, 4),
    description TEXT,
    category_id UUID REFERENCES categories(id),
    account_id UUID REFERENCES accounts(id),
    destination_account_id UUID REFERENCES accounts(id),
    user_id UUID REFERENCES users(id),
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payment_method TEXT,
    source TEXT DEFAULT 'manual', -- 'manual', 'whatsapp', 'quick'
    notes TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    fixed_payment_id UUID REFERENCES fixed_payments(id),
    debt_id UUID REFERENCES debts(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exchange Rates table
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_from TEXT NOT NULL,
    currency_to TEXT NOT NULL,
    rate DECIMAL(15, 4) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT,
    notes TEXT,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets table
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    name TEXT,
    scope TEXT DEFAULT 'pareja', -- 'pareja', 'martin', 'micaela'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(month, year, scope)
);

-- Budget Items table
CREATE TABLE budget_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    planned_amount DECIMAL(15, 2) NOT NULL,
    actual_amount DECIMAL(15, 2) DEFAULT 0,
    difference_amount DECIMAL(15, 2) DEFAULT 0,
    percentage_used DECIMAL(5, 2) DEFAULT 0,
    alert_threshold_percentage DECIMAL(5, 2) DEFAULT 80,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard Widgets table
CREATE TABLE dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    widget_type TEXT NOT NULL,
    title TEXT NOT NULL,
    is_visible BOOLEAN DEFAULT TRUE,
    display_order INTEGER,
    size TEXT DEFAULT 'normal', -- 'small', 'normal', 'large'
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quick Entry Rules table
CREATE TABLE quick_entry_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    transaction_type TEXT,
    category_id UUID REFERENCES categories(id),
    account_id UUID REFERENCES accounts(id),
    user_id UUID REFERENCES users(id),
    default_currency TEXT DEFAULT 'ARS',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Imports table
CREATE TABLE whatsapp_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_message TEXT NOT NULL,
    parsed_payload JSONB,
    status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'error', 'review'
    error_message TEXT,
    matched_user_id UUID REFERENCES users(id),
    created_transaction_id UUID REFERENCES transactions(id),
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- RLS Policies (Basic example)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_entry_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_imports ENABLE ROW LEVEL SECURITY;

-- Initial Policies (Allowing all for MVP as per PRD "Ambos pueden ver todo")
CREATE POLICY "Full access to users" ON users FOR ALL USING (true);
CREATE POLICY "Full access to accounts" ON accounts FOR ALL USING (true);
CREATE POLICY "Full access to categories" ON categories FOR ALL USING (true);
CREATE POLICY "Full access to transactions" ON transactions FOR ALL USING (true);
CREATE POLICY "Full access to debts" ON debts FOR ALL USING (true);
CREATE POLICY "Full access to fixed_payments" ON fixed_payments FOR ALL USING (true);
CREATE POLICY "Full access to exchange_rates" ON exchange_rates FOR ALL USING (true);
CREATE POLICY "Full access to budgets" ON budgets FOR ALL USING (true);
CREATE POLICY "Full access to budget_items" ON budget_items FOR ALL USING (true);
CREATE POLICY "Full access to dashboard_widgets" ON dashboard_widgets FOR ALL USING (true);
CREATE POLICY "Full access to quick_entry_rules" ON quick_entry_rules FOR ALL USING (true);
CREATE POLICY "Full access to whatsapp_imports" ON whatsapp_imports FOR ALL USING (true);
