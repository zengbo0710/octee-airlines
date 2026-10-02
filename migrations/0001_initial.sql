-- Octee Airlines shared application data. Never edit an applied migration.
PRAGMA foreign_keys = ON;

CREATE TABLE airports (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  aliases_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE flights (
  id TEXT PRIMARY KEY,
  airline TEXT NOT NULL CHECK (airline IN ('OA','OU','SA')),
  flight_no TEXT NOT NULL UNIQUE,
  operating_days_json TEXT NOT NULL,
  segments_json TEXT NOT NULL,
  seat_capacity INTEGER NOT NULL DEFAULT 180 CHECK (seat_capacity > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_normalized TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'passenger' CHECK (role IN ('passenger','admin','owner')),
  octmiles_balance INTEGER NOT NULL DEFAULT 100 CHECK (octmiles_balance >= 0),
  octmiles_lifetime INTEGER NOT NULL DEFAULT 100 CHECK (octmiles_lifetime >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_date TEXT NOT NULL,
  origin_code TEXT NOT NULL REFERENCES airports(code),
  destination_code TEXT NOT NULL REFERENCES airports(code),
  passenger_name TEXT NOT NULL,
  passenger_count INTEGER NOT NULL CHECK (passenger_count BETWEEN 1 AND 9),
  aircraft TEXT NOT NULL,
  cabin_class TEXT NOT NULL,
  seat_preference TEXT NOT NULL,
  snack_preference TEXT NOT NULL,
  bags INTEGER NOT NULL CHECK (bags BETWEEN 0 AND 3),
  reason TEXT NOT NULL,
  joelmobile INTEGER NOT NULL DEFAULT 0 CHECK (joelmobile IN (0,1)),
  accepted_terms INTEGER NOT NULL CHECK (accepted_terms = 1),
  octmiles_earned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX bookings_user_date_idx ON bookings(user_id, trip_date);

CREATE TABLE booking_legs (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  flight_id TEXT NOT NULL REFERENCES flights(id),
  flight_date TEXT NOT NULL,
  from_code TEXT NOT NULL REFERENCES airports(code),
  to_code TEXT NOT NULL REFERENCES airports(code),
  first_segment INTEGER NOT NULL,
  last_segment INTEGER NOT NULL,
  depart_time TEXT NOT NULL,
  arrive_time TEXT NOT NULL,
  leg_order INTEGER NOT NULL
);
CREATE INDEX booking_legs_inventory_idx ON booking_legs(flight_date, flight_id);

CREATE TABLE seat_inventory (
  flight_date TEXT NOT NULL,
  flight_id TEXT NOT NULL REFERENCES flights(id),
  segment_index INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= capacity),
  PRIMARY KEY (flight_date, flight_id, segment_index)
);

-- Intentionally empty. A failed guarded seat reservation inserts NULL here and aborts
-- the surrounding D1 batch, rolling the inventory change back atomically.
CREATE TABLE booking_guards (required_value INTEGER NOT NULL);

CREATE TABLE miles_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX miles_ledger_user_idx ON miles_ledger(user_id, created_at);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 20 AND 500),
  route TEXT,
  verified_flyer INTEGER NOT NULL DEFAULT 0 CHECK (verified_flyer IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX reviews_created_idx ON reviews(created_at DESC);

CREATE TABLE redemption_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  octmiles INTEGER NOT NULL CHECK (octmiles BETWEEN 1 AND 5000),
  expires_on TEXT,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE redemptions (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL REFERENCES redemption_codes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  octmiles INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(code_id, user_id)
);

CREATE TABLE baggage_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  tag TEXT NOT NULL CHECK (length(tag) BETWEEN 3 AND 32),
  status_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX baggage_requests_user_idx ON baggage_requests(user_id, created_at DESC);

CREATE TABLE admin_audit (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO airports (code,name,description,aliases_json) VALUES ('FIA','Fuji International Airport','Octee’s home base and hub','["Fuji","home","hub"]');
INSERT INTO airports (code,name,description,aliases_json) VALUES ('SIA','Scraggy International Airport','A destination and transfer point','["Scraggy","Scraggy International"]');
INSERT INTO airports (code,name,description,aliases_json) VALUES ('LIA','Lu Pin International Airport','A destination','["Lu Pin","Lu Pin International"]');
INSERT INTO airports (code,name,description,aliases_json) VALUES ('SCH','Scraggy House','Not really an airport: we land in the garden','["Scraggy House","garden"]');
INSERT INTO airports (code,name,description,aliases_json) VALUES ('MWW','Mdm Wrong-Wrong''s','A Scraggy Airlines partner destination','["Mdm Wrong Wrong","Wrong-Wrong","Wrong-Wrong House"]');
INSERT INTO airports (code,name,description,aliases_json) VALUES ('LUJ','Lujin''s','A Scraggy Airlines partner destination','["Lujin"]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-58','OA','OA 58','[0,1,2,3,4,5,6]','[{"from":"FIA","to":"SIA","depart":"07:30","arrive":"09:20"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-100','OA','OA 100','[1,4]','[{"from":"FIA","to":"SIA","depart":"07:40","arrive":"09:30"},{"from":"SIA","to":"LIA","depart":"10:10","arrive":"11:25"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-101','OA','OA 101','[2,5]','[{"from":"LIA","to":"SIA","depart":"07:45","arrive":"09:34"},{"from":"SIA","to":"FIA","depart":"10:15","arrive":"12:05"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-102','OA','OA 102','[3,6]','[{"from":"FIA","to":"SIA","depart":"14:30","arrive":"16:20"},{"from":"SIA","to":"LIA","depart":"17:00","arrive":"18:15"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-103','OA','OA 103','[4,0]','[{"from":"LIA","to":"SIA","depart":"13:20","arrive":"14:35"},{"from":"SIA","to":"FIA","depart":"15:10","arrive":"17:00"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-104','OA','OA 104','[1]','[{"from":"SIA","to":"FIA","depart":"13:30","arrive":"15:20"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-105','OA','OA 105','[3]','[{"from":"SIA","to":"FIA","depart":"16:45","arrive":"18:35"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-106','OA','OA 106','[6]','[{"from":"SIA","to":"FIA","depart":"13:30","arrive":"15:20"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-107','OA','OA 107','[2]','[{"from":"FIA","to":"LIA","depart":"09:00","arrive":"11:30"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-108','OA','OA 108','[5]','[{"from":"FIA","to":"LIA","depart":"15:40","arrive":"18:10"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-109','OA','OA 109','[3]','[{"from":"LIA","to":"FIA","depart":"07:10","arrive":"09:40"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-110','OA','OA 110','[0]','[{"from":"LIA","to":"FIA","depart":"18:00","arrive":"20:30"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-111','OA','OA 111','[2]','[{"from":"FIA","to":"SCH","depart":"11:15","arrive":"13:05"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-112','OA','OA 112','[6]','[{"from":"FIA","to":"SCH","depart":"08:00","arrive":"09:50"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-113','OA','OA 113','[3]','[{"from":"SCH","to":"FIA","depart":"14:00","arrive":"15:50"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-114','OA','OA 114','[0]','[{"from":"SCH","to":"FIA","depart":"17:00","arrive":"18:50"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-115','OA','OA 115','[6]','[{"from":"LIA","to":"FIA","depart":"06:30","arrive":"09:00"},{"from":"FIA","to":"SCH","depart":"09:45","arrive":"11:35"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-116','OA','OA 116','[0]','[{"from":"SCH","to":"FIA","depart":"08:20","arrive":"10:10"},{"from":"FIA","to":"LIA","depart":"10:50","arrive":"13:20"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-117','OA','OA 117','[4]','[{"from":"FIA","to":"SCH","depart":"10:00","arrive":"11:50"},{"from":"SCH","to":"SIA","depart":"12:30","arrive":"13:10"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OA-118','OA','OA 118','[4]','[{"from":"SIA","to":"SCH","depart":"15:00","arrive":"15:40"},{"from":"SCH","to":"FIA","depart":"16:20","arrive":"18:10"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OU-1','OU','OU 1','[0,1,2,3,4,5,6]','[{"from":"FIA","to":"SIA","depart":"06:45","arrive":"08:35"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OU-2','OU','OU 2','[0,1,2,3,4,5,6]','[{"from":"SIA","to":"FIA","depart":"13:20","arrive":"15:10"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OU-3','OU','OU 3','[1,3,5]','[{"from":"FIA","to":"SCH","depart":"06:30","arrive":"08:20"},{"from":"SCH","to":"SIA","depart":"08:45","arrive":"09:20"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OU-4','OU','OU 4','[1,3,5]','[{"from":"SIA","to":"SCH","depart":"13:45","arrive":"14:20"},{"from":"SCH","to":"FIA","depart":"14:50","arrive":"16:40"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OU-5','OU','OU 5','[4,0]','[{"from":"FIA","to":"SCH","depart":"17:50","arrive":"19:40"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OU-6','OU','OU 6','[4,0]','[{"from":"SCH","to":"FIA","depart":"20:20","arrive":"22:10"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OU-7','OU','OU 7','[0,1,2,3,4,5,6]','[{"from":"FIA","to":"SIA","depart":"16:30","arrive":"18:20"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('OU-8','OU','OU 8','[0,1,2,3,4,5,6]','[{"from":"SIA","to":"FIA","depart":"19:10","arrive":"21:00"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('SA-101','SA','SA 101','[0,1,2,3,4,5,6]','[{"from":"SIA","to":"SCH","depart":"10:20","arrive":"10:50"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('SA-102','SA','SA 102','[0,1,2,3,4,5,6]','[{"from":"SCH","to":"SIA","depart":"11:50","arrive":"12:20"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('SA-103','SA','SA 103','[0,1,2,3,4,5,6]','[{"from":"SIA","to":"MWW","depart":"10:30","arrive":"11:20"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('SA-104','SA','SA 104','[0,1,2,3,4,5,6]','[{"from":"MWW","to":"SIA","depart":"11:40","arrive":"12:30"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('SA-105','SA','SA 105','[0,1,2,3,4,5,6]','[{"from":"SIA","to":"LUJ","depart":"10:45","arrive":"11:40"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('SA-106','SA','SA 106','[0,1,2,3,4,5,6]','[{"from":"LUJ","to":"SIA","depart":"11:35","arrive":"12:30"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('SA-107','SA','SA 107','[0,1,2,3,4,5,6]','[{"from":"SIA","to":"FIA","depart":"11:00","arrive":"12:50"}]');
INSERT INTO flights (id,airline,flight_no,operating_days_json,segments_json) VALUES ('SA-108','SA','SA 108','[0,1,2,3,4,5,6]','[{"from":"FIA","to":"SIA","depart":"14:00","arrive":"15:50"}]');
