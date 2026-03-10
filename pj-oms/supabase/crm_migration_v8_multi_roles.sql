-- Migration v8: Multi-role support
-- Adds roles text[] column to profiles, migrates data from role column,
-- recreates role as a generated column for backward compatibility.

-- Step 1: Add roles array column with default
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY['sales'];

-- Step 2: Populate from existing role column
UPDATE profiles SET roles = ARRAY[role] WHERE role IS NOT NULL AND roles IS NULL OR roles = ARRAY['sales'];

-- Step 3: Drop old role column and recreate as generated column
ALTER TABLE profiles DROP COLUMN IF EXISTS role;
ALTER TABLE profiles ADD COLUMN role text GENERATED ALWAYS AS (roles[1]) STORED;

-- Step 4: Add CHECK constraints
ALTER TABLE profiles ADD CONSTRAINT chk_roles_valid CHECK (
  roles <@ ARRAY['admin', 'sales', 'accountant', 'lia', 'copywriter']::text[]
);
ALTER TABLE profiles ADD CONSTRAINT chk_roles_length CHECK (
  array_length(roles, 1) >= 1 AND array_length(roles, 1) <= 3
);

-- Step 5: Add GIN index for array queries (.overlaps, .contains)
CREATE INDEX IF NOT EXISTS idx_profiles_roles ON profiles USING GIN (roles);
