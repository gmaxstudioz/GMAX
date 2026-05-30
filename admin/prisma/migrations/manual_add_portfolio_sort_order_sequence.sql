-- Migration: add-portfolio-sort-order-sequence
-- Run this in the Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'S' AND relname = 'portfolio_item_sort_order_seq'
  ) THEN
    CREATE SEQUENCE "portfolio_item_sort_order_seq"
      AS INTEGER
      START WITH 1
      MINVALUE 1
      NO CYCLE;
  END IF;

  PERFORM setval(
    'portfolio_item_sort_order_seq',
    GREATEST(
      (SELECT COALESCE(MAX("sortOrder"), 0) FROM "portfolio_item") + 1,
      (SELECT last_value FROM "portfolio_item_sort_order_seq")
    ),
    false
  );
END
$$;
