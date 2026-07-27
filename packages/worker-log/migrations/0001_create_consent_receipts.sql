CREATE TABLE consent_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consent_id TEXT NOT NULL,
  host TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  categories TEXT NOT NULL CHECK (json_valid(categories)),
  ts TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('consent', 'change', 'withdraw')),
  received_at TEXT NOT NULL
);

CREATE INDEX consent_receipts_audit_idx
  ON consent_receipts (consent_id, received_at, id);

CREATE INDEX consent_receipts_purge_idx
  ON consent_receipts (received_at);
