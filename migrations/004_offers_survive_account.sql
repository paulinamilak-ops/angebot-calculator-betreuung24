-- Offers must not disappear. Decision of the product owner, 12.09.2026:
-- an offer is a business record that outlives the account that made it, and
-- accounts are deactivated rather than deleted.
--
-- Migration 003 attached the offers to their owner with ON DELETE CASCADE,
-- so deleting a franchise account also wiped every offer it had ever made,
-- silently. The constraint becomes RESTRICT: the database itself now refuses
-- to remove an account that still has offers. The application refuses first,
-- with a readable message; this is the second line of defence, and it also
-- covers someone working directly on the database.

ALTER TABLE franchise_offers
  DROP CONSTRAINT IF EXISTS franchise_offers_user_id_fkey;

ALTER TABLE franchise_offers
  ADD CONSTRAINT franchise_offers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
