-- Add flag to distinguish business-initiated full repayments from normal sweep events.
-- Excluded from revenue reporting since the payment originates from the business, not a customer.

ALTER TABLE sweep_events
  ADD COLUMN is_manual_repayment boolean NOT NULL DEFAULT false;
