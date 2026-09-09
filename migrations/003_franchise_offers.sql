-- Offer history for franchise partners. Each partner sees only their own
-- rows; filtering happens by the user id carried in the JWT, never by an
-- id supplied in the request.
--
-- Result amounts are stored, not recomputed on load: when head office
-- updates the price list, an offer already issued must keep the figures
-- it was issued with.

CREATE TABLE IF NOT EXISTS franchise_offers (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Client identification, typed in by the franchise partner.
  client_first_name TEXT NOT NULL,
  client_last_name  TEXT NOT NULL,
  offer_date        DATE NOT NULL,

  -- Calculation input.
  paket             TEXT NOT NULL,
  provision_monat   NUMERIC(10,2) NOT NULL DEFAULT 0,
  persons           SMALLINT      NOT NULL DEFAULT 1,
  addons            JSONB         NOT NULL DEFAULT '[]'::jsonb,
  deductions_shown  BOOLEAN       NOT NULL DEFAULT FALSE,
  pflegegrad_1      SMALLINT,
  pflegegrad_2      SMALLINT,

  -- Calculation result as shown to the client.
  base_monat        NUMERIC(10,2) NOT NULL,
  total_monat       NUMERIC(10,2) NOT NULL,
  total_tag         NUMERIC(10,2) NOT NULL,
  gesamt_monat      NUMERIC(10,2) NOT NULL,
  gesamt_tag        NUMERIC(10,2) NOT NULL,
  gesamt_einmalig   NUMERIC(10,2) NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT franchise_offers_paket_check
    CHECK (paket IN ('bronze', 'silber', 'gold', 'platin')),
  CONSTRAINT franchise_offers_persons_check
    CHECK (persons IN (1, 2)),
  CONSTRAINT franchise_offers_provision_check
    CHECK (provision_monat >= 0)
);

CREATE INDEX IF NOT EXISTS idx_franchise_offers_user
  ON franchise_offers (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_franchise_offers_client
  ON franchise_offers (user_id, client_last_name, client_first_name);
