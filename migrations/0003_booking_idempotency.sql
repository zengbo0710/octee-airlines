ALTER TABLE bookings ADD COLUMN request_key TEXT;
CREATE UNIQUE INDEX bookings_request_key_idx ON bookings(request_key);
