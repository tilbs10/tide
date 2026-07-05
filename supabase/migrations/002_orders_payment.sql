-- Adds payment + fulfilment columns to orders for the create-payment edge function.
-- Run after 001_initial_schema.sql.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS session_id        text,
  ADD COLUMN IF NOT EXISTS shipping_address  jsonb,
  ADD COLUMN IF NOT EXISTS square_payment_id text,
  ADD COLUMN IF NOT EXISTS currency          text DEFAULT 'AUD';

-- One order per Square payment — guards against double-inserts on retry
CREATE UNIQUE INDEX IF NOT EXISTS orders_square_payment_idx
  ON orders (square_payment_id) WHERE square_payment_id IS NOT NULL;
