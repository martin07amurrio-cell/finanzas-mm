CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pin_hash TEXT DEFAULT '',
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_user_id TEXT,
    type TEXT NOT NULL DEFAULT 'cash',
    currency TEXT NOT NULL DEFAULT 'ARS',
    initial_balance NUMERIC(15, 2) DEFAULT 0,
    current_balance NUMERIC(15, 2) DEFAULT 0,
    is_savings_fund BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'ARS',
    description TEXT,
    category_id TEXT,
    account_id TEXT,
    destination_account_id TEXT,
    user_id TEXT,
    transaction_date TIMESTAMPTZ,
    payment_method TEXT,
    source TEXT DEFAULT 'manual',
    notes TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    fixed_payment_id TEXT,
    debt_id TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_accounts_owner_user_id
ON accounts (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_categories_type
ON categories (type);

CREATE INDEX IF NOT EXISTS idx_transactions_date
ON transactions (transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_type
ON transactions (type);

CREATE INDEX IF NOT EXISTS idx_transactions_account_id
ON transactions (account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_category_id
ON transactions (category_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
ON transactions (user_id);
