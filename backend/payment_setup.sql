-- ==============================================================================
-- Migration: Add Payment Gateway Integration
-- Description: Creates payment_transactions table and updates related enums
-- ==============================================================================

-- 1. Create payment_transactions table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id INTEGER REFERENCES public.shops(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100),
    provider VARCHAR(50) NOT NULL, -- e.g., 'OMISE', '2C2P', 'MANUAL'
    provider_transaction_id VARCHAR(255) UNIQUE,
    provider_reference VARCHAR(255),
    payment_method VARCHAR(100) NOT NULL, -- e.g., 'PROMPTPAY', 'CREDIT_CARD', 'BANK_TRANSFER'
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'THB',
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PROCESSING, PAID, FAILED, EXPIRED, CANCELLED, REFUNDED
    qr_data TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_tx_shop_id ON public.payment_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_provider_tx_id ON public.payment_transactions(provider_transaction_id);

-- 3. Update orders status logic (Add PENDING_PAYMENT, PAYMENT_FAILED, PAYMENT_EXPIRED)
-- Note: If 'status' in orders is an ENUM, you may need to ALTER TYPE. 
-- Since it's usually just a text column in this project, we can just start inserting new strings.
-- To be safe, we don't alter enum here unless it strictly requires it.

-- 4. Enable RLS for payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for shop users" 
ON public.payment_transactions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.staff 
        WHERE staff.id = (current_setting('request.jwt.claims')::json->>'id')::integer 
        AND staff.shop_id = payment_transactions.shop_id
    )
);

CREATE POLICY "Allow insert for shop users" 
ON public.payment_transactions FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff 
        WHERE staff.id = (current_setting('request.jwt.claims')::json->>'id')::integer 
        AND staff.shop_id = payment_transactions.shop_id
    )
);

CREATE POLICY "Allow update for shop users" 
ON public.payment_transactions FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.staff 
        WHERE staff.id = (current_setting('request.jwt.claims')::json->>'id')::integer 
        AND staff.shop_id = payment_transactions.shop_id
    )
);
