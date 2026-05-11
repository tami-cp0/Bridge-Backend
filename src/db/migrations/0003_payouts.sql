-- Create payouts table for outbound bank transfers

CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  user_type user_type NOT NULL,
  amount bigint NOT NULL,
  bank_code varchar(10) NOT NULL,
  account_number varchar(10) NOT NULL,
  account_name varchar(255) NOT NULL,
  transaction_reference varchar(120) NOT NULL UNIQUE,
  remark text NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'pending',
  squad_status varchar(50),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  completed_at timestamp
);

CREATE INDEX payouts_user_id_idx ON payouts(user_id);
