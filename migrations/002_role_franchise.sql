-- The franchise role is exclusive: an account holding it reaches the
-- franchise calculator and nothing else. Enforced in the API layer;
-- the constraint here only keeps unknown role values out of the table.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD  CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'user', 'franchise'));
