-- Migrate bridge_standing enum from 5 values to 3.
-- Rising → Seed, Trusted → Established (data migration before type change).

-- Step 1: temporarily cast the column to text so we can migrate values
ALTER TABLE bridge_ratings ALTER COLUMN standing TYPE text;

-- Step 2: migrate existing standing values
UPDATE bridge_ratings SET standing = 'Seed'        WHERE standing = 'Rising';
UPDATE bridge_ratings SET standing = 'Established' WHERE standing = 'Trusted';

-- Step 3: drop the old enum and recreate with 3 values
DROP TYPE bridge_standing;
CREATE TYPE bridge_standing AS ENUM ('Seed', 'Established', 'Elite');

-- Step 4: cast the column back to the new enum
ALTER TABLE bridge_ratings ALTER COLUMN standing TYPE bridge_standing USING standing::bridge_standing;
ALTER TABLE bridge_ratings ALTER COLUMN standing SET DEFAULT 'Seed';
