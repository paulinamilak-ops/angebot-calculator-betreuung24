-- Price lists kept in the database instead of in the source code.
-- Two kinds: 'standard' for the Angebot tab (end customer) and 'franchise'
-- for the franchise module. Each row is a list valid from a given date;
-- the one in force is the newest row whose valid_from is not in the future.
--
-- Amounts only. Package and add-on names stay in the code: they are not a
-- pricing decision, and a typo in a name would reach the customer offer.
--
-- Offers already saved keep their own amounts (003_franchise_offers.sql),
-- so changing a list here never rewrites an offer issued earlier.

CREATE TABLE IF NOT EXISTS price_lists (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('standard', 'franchise')),
  name        TEXT NOT NULL,
  valid_from  DATE NOT NULL,

  -- { bronze: { monat, tag }, silber: …, gold: …, platin: … }
  products    JSONB NOT NULL,
  -- { express: { amount }, fuehrerschein: { amount }, … }
  addons      JSONB NOT NULL,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Two lists of the same kind starting the same day would make "which one
  -- applies" a matter of chance.
  UNIQUE (kind, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_price_lists_kind
  ON price_lists (kind, valid_from DESC);

-- The list in force on 28.10.2026, in both kinds. PO decision of 29.10.2026:
-- both start from today's amounts; they can be told apart later by editing
-- the franchise list in the admin panel.
INSERT INTO price_lists (kind, name, valid_from, products, addons)
VALUES
  ('standard', 'Cennik od 28.10.2026', DATE '2026-10-28',
   '{"bronze":{"monat":2600,"tag":87},"silber":{"monat":2900,"tag":97},
     "gold":{"monat":3300,"tag":110},"platin":{"monat":3600,"tag":120}}'::jsonb,
   '{"express":{"amount":300},"fuehrerschein":{"amount":8},
     "zweitepersonhh":{"amount":4},"zweitepersonzb":{"amount":15},
     "sonderbetreuung":{"amount":10}}'::jsonb),
  ('franchise', 'Cennik franczyzowy od 28.10.2026', DATE '2026-10-28',
   '{"bronze":{"monat":2600,"tag":87},"silber":{"monat":2900,"tag":97},
     "gold":{"monat":3300,"tag":110},"platin":{"monat":3600,"tag":120}}'::jsonb,
   '{"express":{"amount":300},"fuehrerschein":{"amount":8},
     "zweitepersonhh":{"amount":4},"zweitepersonzb":{"amount":15},
     "sonderbetreuung":{"amount":10}}'::jsonb)
ON CONFLICT (kind, valid_from) DO NOTHING;
