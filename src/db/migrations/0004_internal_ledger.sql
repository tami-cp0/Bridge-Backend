-- Internal accounting ledger. Squad's merchant wallet holds all money in one
-- pool, so per-user ownership is tracked here.

CREATE TYPE ledger_entry_type AS ENUM ('credit', 'debit');

CREATE TABLE internal_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  entry_type ledger_entry_type NOT NULL,
  amount bigint NOT NULL,
  purpose varchar(40) NOT NULL,
  reference_id uuid,
  reference_type varchar(40),
  squad_transaction_reference varchar(120),
  created_at timestamp DEFAULT now()
);

CREATE INDEX internal_ledger_user_idx ON internal_ledger_entries(user_id);
CREATE INDEX internal_ledger_squad_ref_idx
  ON internal_ledger_entries(squad_transaction_reference);
