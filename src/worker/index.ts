interface Env {
  DB: D1Database;
}

interface InventoryRow {
  flight_id: string;
  segment_index: number;
  capacity: number;
  reserved: number;
}

interface FlightRow {
  id: string;
  airline: "OA" | "OU" | "SA";
  flight_no: string;
  operating_days_json: string;
  segments_json: string;
  seat_capacity: number;
  active: number;
}

interface AirportRow {
  code: string;
  name: string;
  description: string;
  aliases_json: string;
}

interface StatusFlightRow {
  flight_no: string;
  airline: "OA" | "OU" | "SA";
  operating_days_json: string;
  segments_json: string;
}

interface ReviewRow {
  id: string;
  rating: number;
  title: string;
  body: string;
  route: string | null;
  verified_flyer: number;
  created_at: string;
  username: string;
}

const SESSION_COOKIE = "octee_session";
const SESSION_DAYS = 14;
const PASSWORD_ITERATIONS = 150_000;
const CONNECTION_MINUTES = 45;
const AIRPORT_CODES = new Set(["FIA", "SIA", "LIA", "SCH", "MWW", "LUJ"]);
const MILES_BY_STRETCH = new Map([
  ["FIA:SIA", 150], ["LIA:FIA", 200], ["FIA:SCH", 250],
  ["LIA:SIA", 120], ["SCH:SIA", 80],
]);
const BAG_MESSAGES = [
  "Your bag is on a better holiday than you.",
  "Last seen: Gate 7. Possibly Gate 8. Spiritually, everywhere.",
  "Your bag has been upgraded to a different flight.",
  "The tracker is 99% sure the bag exists. The remaining 1% is being investigated.",
];
const BOARD_STATUSES = ["DELAYED", "ENGINES BEING CHECKED", "BOARDING (SINCE TUESDAY)", "PILOT LOOKING FOR KEYS", "GATE CHANGED TO A DIFFERENT GATE"];

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function base64url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digest(value) {
  return base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: decodeBase64url(salt), iterations: PASSWORD_ITERATIONS }, key, 256);
  return base64url(bits);
}

function equalText(left, right) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) difference |= (a[i] || 0) ^ (b[i] || 0);
  return difference === 0;
}

function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function cookieHeader(value, maxAge, secure) {
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

async function readJson(request, maxBytes = 16_384) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.toLowerCase().includes("application/json")) throw new HttpError("Send JSON with Content-Type: application/json.", 415);
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError("Request is too large.", 413);
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object.");
    return value;
  } catch {
    throw new HttpError("Request body is not valid JSON.", 400);
  }
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function safeText(value, limit, field) {
  if (typeof value !== "string") throw new HttpError(`${field} is required.`);
  const clean = value.trim();
  if (!clean || clean.length > limit) throw new HttpError(`${field} must be between 1 and ${limit} characters.`);
  return clean;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function singaporeDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isWithinBookingWindow(value) {
  if (!validDate(value)) return false;
  const lastDate = new Date(`${singaporeDate()}T12:00:00Z`);
  lastDate.setUTCMonth(lastDate.getUTCMonth() + 11);
  return value >= singaporeDate() && value <= lastDate.toISOString().slice(0, 10);
}

function dateDay(value) {
  return new Date(`${value}T12:00:00Z`).getUTCDay();
}

function minuteOfDay(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatDateTime(date, time) {
  return `${date}T${time}:00+08:00`;
}

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function currentUser(request: Request, env: Env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await digest(token);
  const now = new Date().toISOString();
  return env.DB.prepare(`
    SELECT u.id, u.username, u.role, u.octmiles_balance, u.octmiles_lifetime, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(tokenHash, now).first();
}

async function createSession(userId: string, request: Request, env: Env) {
  const rawToken = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await digest(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").bind(tokenHash, userId, expiresAt).run();
  return cookieHeader(rawToken, SESSION_DAYS * 86_400, new URL(request.url).protocol === "https:");
}

function checkSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) throw new HttpError("Request origin is not allowed.", 403);
  } catch (cause) {
    if (cause instanceof HttpError) throw cause;
    throw new HttpError("Request origin is not allowed.", 403);
  }
}

function routePath(request) {
  return new URL(request.url).pathname.replace(/\/+$/u, "") || "/";
}

async function getAirports(db: D1Database) {
  const result = await db.prepare("SELECT code,name,description,aliases_json FROM airports ORDER BY code").all<AirportRow>();
  return result.results.map((row) => ({ ...row, aliases: JSON.parse(row.aliases_json) }));
}

async function availableJourneys(db: D1Database, { date, from, to, passengers = 1 }) {
  const scheduleResult = await db.prepare("SELECT * FROM flights WHERE active=1 ORDER BY airline,flight_no").all<FlightRow>();
  const weekday = dateDay(date);
  const active = scheduleResult.results
    .map((row) => ({ ...row, days: JSON.parse(row.operating_days_json), segments: JSON.parse(row.segments_json) }))
    .filter((flight) => flight.days.includes(weekday));
  if (!active.length) return [];

  const inventoryResult = await db.prepare("SELECT flight_id,segment_index,capacity,reserved FROM seat_inventory WHERE flight_date=?").bind(date).all<InventoryRow>();
  const inventory = new Map<string, InventoryRow>(inventoryResult.results.map((row) => [`${row.flight_id}:${row.segment_index}`, row]));
  const legs = [];

  for (const flight of active) {
    for (let first = 0; first < flight.segments.length; first += 1) {
      for (let last = first; last < flight.segments.length; last += 1) {
        const part = flight.segments.slice(first, last + 1);
        if (part.some((segment, index) => index > 0 && part[index - 1].to !== segment.from)) continue;
        const remaining = part.map((_, offset) => {
          const row = inventory.get(`${flight.id}:${first + offset}`);
          return (row?.capacity ?? flight.seat_capacity) - (row?.reserved ?? 0);
        });
        const seats = Math.min(...remaining);
        if (seats < passengers) continue;
        legs.push({
          flightId: flight.id,
          flightNo: flight.flight_no,
          airline: flight.airline,
          from: part[0].from,
          to: part.at(-1).to,
          departTime: part[0].depart,
          arriveTime: part.at(-1).arrive,
          departMinute: minuteOfDay(part[0].depart),
          arriveMinute: minuteOfDay(part.at(-1).arrive),
          firstSegment: first,
          lastSegment: last,
          segmentIndices: part.map((_, offset) => first + offset),
          stops: part.slice(0, -1).map((segment) => segment.to),
          availableSeats: seats,
        });
      }
    }
  }

  const outgoing = new Map();
  for (const leg of legs) {
    if (!outgoing.has(leg.from)) outgoing.set(leg.from, []);
    outgoing.get(leg.from).push(leg);
  }
  for (const options of outgoing.values()) options.sort((a, b) => a.departMinute - b.departMinute || a.arriveMinute - b.arriveMinute);

  const journeys = [];
  function walk(airport, previousArrival, usedFlights, visitedAirports, path, seats) {
    if (path.length >= 3) return;
    for (const leg of outgoing.get(airport) || []) {
      if (usedFlights.has(leg.flightId) || visitedAirports.has(leg.to)) continue;
      if (previousArrival !== null && leg.departMinute - previousArrival < CONNECTION_MINUTES) continue;
      const nextPath = [...path, leg];
      const nextSeats = Math.min(seats, leg.availableSeats);
      if (leg.to === to) {
        journeys.push({ date, from, to, legs: nextPath, availableSeats: nextSeats });
        continue;
      }
      if (nextPath.length < 3) {
        const nextFlights = new Set(usedFlights).add(leg.flightId);
        const nextAirports = new Set(visitedAirports).add(leg.to);
        walk(leg.to, leg.arriveMinute, nextFlights, nextAirports, nextPath, nextSeats);
      }
    }
  }
  walk(from, null, new Set(), new Set([from]), [], Number.MAX_SAFE_INTEGER);

  const unique = new Map();
  for (const journey of journeys) {
    const key = journey.legs.map((leg) => `${leg.flightId}:${leg.firstSegment}-${leg.lastSegment}`).join("|");
    if (!unique.has(key)) unique.set(key, journey);
  }
  return [...unique.values()]
    .sort((a, b) => a.legs[0].departMinute - b.legs[0].departMinute || a.legs.length - b.legs.length)
    .slice(0, 20)
    .map(({ date: journeyDate, from: origin, to: destination, legs: chosen, availableSeats }) => ({
      date: journeyDate,
      from: origin,
      to: destination,
      availableSeats,
      legs: chosen.map(({ departMinute, arriveMinute, ...leg }) => ({ ...leg, departAt: formatDateTime(journeyDate, leg.departTime), arriveAt: formatDateTime(journeyDate, leg.arriveTime) })),
    }));
}

function milesForJourney(journey, flightMap: Map<string, FlightRow>, cabinClass) {
  let miles = 0;
  for (const leg of journey.legs) {
    const flight = flightMap.get(leg.flightId);
    if (flight.airline === "SA") continue;
    const segments = JSON.parse(flight.segments_json).slice(leg.firstSegment, leg.lastSegment + 1);
    for (const segment of segments) {
      const key = [segment.from, segment.to].sort().join(":");
      const base = MILES_BY_STRETCH.get(key) || 0;
      miles += flight.airline === "OU" ? Math.floor(base / 2) : base;
    }
    if (flight.airline === "OA" && cabinClass === "Octee First") miles += 50;
  }
  return miles;
}

async function searchFlights(request: Request, env: Env) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  const from = (params.get("from") || "FIA").toUpperCase();
  const to = (params.get("to") || "SIA").toUpperCase();
  const passengers = Number(params.get("passengers") || 1);
  if (!validDate(date)) return error("Choose a valid travel date.");
  if (!AIRPORT_CODES.has(from) || !AIRPORT_CODES.has(to) || from === to) return error("Choose two different airports from the list.");
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 9) return error("Passengers must be between 1 and 9.");
  if (!isWithinBookingWindow(date)) return error("Choose a date within the next 11 months.");
  const journeys = await availableJourneys(env.DB, { date, from, to, passengers });
  return json({ journeys, date, from, to, passengers, timezone: "Asia/Singapore" });
}

async function statusBoard(env: Env, date) {
  const flights = await env.DB.prepare("SELECT flight_no,airline,segments_json,operating_days_json FROM flights WHERE active=1 ORDER BY flight_no").all<StatusFlightRow>();
  const weekday = dateDay(date);
  const departures = [];
  for (const row of flights.results) {
    if (!JSON.parse(row.operating_days_json).includes(weekday)) continue;
    const segments = JSON.parse(row.segments_json);
    const index = segments.findIndex((segment) => segment.from === "FIA");
    if (index < 0) continue;
    const destination = segments.at(-1).to;
    const hash = [...row.flight_no].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    departures.push({ flight: row.flight_no, airline: row.airline, destination, scheduled: segments[index].depart, status: BOARD_STATUSES[hash % BOARD_STATUSES.length] });
  }
  return departures;
}

async function authSignup(request: Request, env: Env) {
  const body = await readJson(request);
  const username = safeText(body.username, 20, "Username");
  if (!/^[a-zA-Z0-9_]{3,20}$/u.test(username)) throw new HttpError("Username must be 3–20 letters, numbers, or underscores.");
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) throw new HttpError("Password must be between 8 and 128 characters.");
  if (body.password !== body.confirmPassword) throw new HttpError("Those passwords don't match. Neither do our timetables.");
  const normalized = normalizeUsername(username);
  const id = crypto.randomUUID();
  const salt = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await hashPassword(body.password, salt);
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,username,username_normalized,password_salt,password_hash) VALUES (?,?,?,?,?)").bind(id, username, normalized, salt, passwordHash),
      env.DB.prepare("INSERT INTO miles_ledger (id,user_id,event_type,amount,description) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), id, "signup_bonus", 100, "Welcome aboard"),
    ]);
  } catch (cause) {
    if (String(cause).toLowerCase().includes("unique")) throw new HttpError("That username is taken. Someone boarded first.", 409);
    throw cause;
  }
  const setCookie = await createSession(id, request, env);
  const user = await env.DB.prepare("SELECT id,username,role,octmiles_balance,octmiles_lifetime,created_at FROM users WHERE id=?").bind(id).first();
  return json({ user }, 201, { "Set-Cookie": setCookie });
}

async function authLogin(request: Request, env: Env) {
  const body = await readJson(request);
  const username = safeText(body.username, 20, "Username");
  if (typeof body.password !== "string" || body.password.length > 128) throw new HttpError("Wrong password. Or wrong username. We lose track of things.", 401);
  const normalized = normalizeUsername(username);
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const attemptKey = await digest(`${normalized}\u0000${ip}`);
  const throttle = await env.DB.prepare("SELECT failed_count,window_started_at,locked_until FROM auth_attempts WHERE attempt_key=?").bind(attemptKey).first<{ failed_count: number; window_started_at: string; locked_until: string | null }>();
  const nowMs = Date.now();
  if (throttle?.locked_until && Date.parse(throttle.locked_until) > nowMs) throw new HttpError("Too many tries. Please wait a little before boarding again.", 429);
  const user = await env.DB.prepare("SELECT id,username,password_salt,password_hash FROM users WHERE username_normalized=?").bind(normalized).first<{ id: string; username: string; password_salt: string; password_hash: string }>();
  const salt = user?.password_salt || base64url(new Uint8Array(16));
  const candidate = await hashPassword(body.password, salt);
  if (!user || !equalText(candidate, user.password_hash)) {
    const withinWindow = throttle && nowMs - Date.parse(throttle.window_started_at) < 3_600_000;
    const failedCount = withinWindow ? throttle.failed_count + 1 : 1;
    const windowStarted = withinWindow ? throttle.window_started_at : new Date(nowMs).toISOString();
    const lockedUntil = failedCount >= 10 ? new Date(nowMs + 3_600_000).toISOString() : null;
    await env.DB.prepare(`INSERT INTO auth_attempts (attempt_key,username_normalized,failed_count,window_started_at,locked_until)
      VALUES (?,?,?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET username_normalized=excluded.username_normalized,failed_count=excluded.failed_count,window_started_at=excluded.window_started_at,locked_until=excluded.locked_until`)
      .bind(attemptKey, normalized, failedCount, windowStarted, lockedUntil).run();
    throw new HttpError("Wrong password. Or wrong username. We lose track of things.", lockedUntil ? 429 : 401);
  }
  await env.DB.prepare("DELETE FROM auth_attempts WHERE attempt_key=?").bind(attemptKey).run();
  const setCookie = await createSession(user.id, request, env);
  const profile = await env.DB.prepare("SELECT id,username,role,octmiles_balance,octmiles_lifetime,created_at FROM users WHERE id=?").bind(user.id).first();
  return json({ user: profile }, 200, { "Set-Cookie": setCookie });
}

async function authLogout(request: Request, env: Env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader("", 0, new URL(request.url).protocol === "https:") });
}

async function myBookings(user, env: Env) {
  const bookings = await env.DB.prepare(`SELECT id,reference,trip_date,origin_code,destination_code,passenger_name,passenger_count,aircraft,cabin_class,seat_preference,snack_preference,bags,reason,octmiles_earned,status,created_at
    FROM bookings WHERE user_id=? ORDER BY created_at DESC LIMIT 50`).bind(user.id).all();
  const result = [];
  for (const booking of bookings.results) {
    const legs = await env.DB.prepare(`SELECT bl.flight_date,bl.from_code,bl.to_code,bl.depart_time,bl.arrive_time,bl.leg_order,f.flight_no,f.airline
      FROM booking_legs bl JOIN flights f ON f.id=bl.flight_id WHERE bl.booking_id=? ORDER BY bl.leg_order`).bind(booking.id).all();
    result.push({ ...booking, legs: legs.results });
  }
  return result;
}

async function createBooking(request: Request, env: Env, user) {
  const body = await readJson(request);
  const date = body.date;
  const from = typeof body.from === "string" ? body.from.toUpperCase() : "";
  const to = typeof body.to === "string" ? body.to.toUpperCase() : "";
  const passengerCount = Number(body.passengers);
  if (!isWithinBookingWindow(date) || !AIRPORT_CODES.has(from) || !AIRPORT_CODES.has(to) || from === to) throw new HttpError("Choose a valid date within the next 11 months and a valid route.");
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 9) throw new HttpError("Passengers must be between 1 and 9.");
  const requestKey = safeText(body.requestKey, 80, "Booking request key");
  if (!/^[a-zA-Z0-9_-]{20,80}$/u.test(requestKey)) throw new HttpError("Refresh the booking form and try again.");
  const previous = await env.DB.prepare("SELECT id FROM bookings WHERE user_id=? AND request_key=?").bind(user.id, requestKey).first();
  if (previous) {
    const existing = (await myBookings(user, env)).find((item) => item.id === previous.id);
    return json({ booking: existing, message: "This booking was already confirmed.", milesEarned: existing.octmiles_earned });
  }
  const passengerName = safeText(body.passengerName, 80, "Passenger name");
  if (passengerName.length < 2) throw new HttpError("Passenger name must have at least two characters.");
  const aircraft = safeText(body.aircraft, 40, "Aircraft");
  const cabinClass = safeText(body.cabinClass, 32, "Cabin");
  const seatPreference = safeText(body.seatPreference, 20, "Seat preference");
  const snackPreference = safeText(body.snackPreference, 40, "Snack preference");
  const bags = Number(body.bags);
  const reason = safeText(body.reason, 120, "Reason for travelling");
  if (!Number.isInteger(bags) || bags < 0 || bags > 3) throw new HttpError("Choose between zero and three bags.");
  if (!["Airbus 777", "Boeing 330", "Airbus 747", "Boeing 380", "Surprise me"].includes(aircraft)) throw new HttpError("Choose an aircraft from the list.");
  if (!["Octee Economy", "Octee Business", "Octee First"].includes(cabinClass)) throw new HttpError("Choose an Octee cabin.");
  if (!["Window", "Aisle", "Somewhere"].includes(seatPreference)) throw new HttpError("Choose a seat preference.");
  if (!Array.isArray(body.terms) || !["ceo", "engines", "luggage"].every((term) => body.terms.includes(term))) throw new HttpError("Please tick all three. We need it in writing.");
  if (!Array.isArray(body.flightIds) || body.flightIds.length < 1 || body.flightIds.length > 3 || body.flightIds.some((id) => typeof id !== "string")) throw new HttpError("Choose a flight itinerary first.");

  const todayFlights = await env.DB.prepare("SELECT COUNT(*) AS count FROM bookings WHERE user_id=? AND substr(created_at,1,10)=?").bind(user.id, singaporeDate()).first<{ count: number }>();
  if (todayFlights.count >= 5) throw new HttpError("Sorry, you have flown too much today.", 429);
  const offered = await availableJourneys(env.DB, { date, from, to, passengers: passengerCount });
  const journey = offered.find((candidate) => candidate.legs.map((leg) => leg.flightId).join("|") === body.flightIds.join("|"));
  if (!journey) throw new HttpError("That itinerary changed or sold out. Search again before confirming.", 409);

  const flightRows = await env.DB.prepare("SELECT * FROM flights WHERE active=1").all<FlightRow>();
  const flightMap = new Map<string, FlightRow>(flightRows.results.map((row) => [row.id, row]));
  let miles = milesForJourney(journey, flightMap, cabinClass);
  let joelmobileEarned = false;
  if (body.joelmobile === true) {
    const rideCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM miles_ledger WHERE user_id=? AND event_type='joelmobile_ride' AND substr(created_at,1,10)=?").bind(user.id, new Date().toISOString().slice(0, 10)).first<{ count: number }>();
    if (rideCount.count < 3) {
      miles += 20;
      joelmobileEarned = true;
    }
  }

  const bookingId = crypto.randomUUID();
  const reference = `OCT-${base64url(crypto.getRandomValues(new Uint8Array(4))).slice(0, 6).toUpperCase()}`;
  const statements = [];
  for (const leg of journey.legs) {
    const flight = flightMap.get(leg.flightId);
    for (const segmentIndex of leg.segmentIndices) {
      statements.push(env.DB.prepare(`INSERT INTO seat_inventory (flight_date,flight_id,segment_index,capacity,reserved)
        VALUES (?,?,?,?,?) ON CONFLICT(flight_date,flight_id,segment_index) DO UPDATE SET reserved=seat_inventory.reserved+excluded.reserved
        WHERE seat_inventory.reserved+excluded.reserved<=seat_inventory.capacity`)
        .bind(date, leg.flightId, segmentIndex, flight.seat_capacity, passengerCount));
      statements.push(env.DB.prepare("INSERT INTO booking_guards (required_value) SELECT NULL WHERE changes()=0"));
    }
  }
  statements.push(env.DB.prepare(`INSERT INTO bookings (id,reference,request_key,user_id,trip_date,origin_code,destination_code,passenger_name,passenger_count,aircraft,cabin_class,seat_preference,snack_preference,bags,reason,joelmobile,accepted_terms,octmiles_earned)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(bookingId, reference, requestKey, user.id, date, from, to, passengerName, passengerCount, aircraft, cabinClass, seatPreference, snackPreference, bags, reason, body.joelmobile === true ? 1 : 0, 1, miles));
  for (let index = 0; index < journey.legs.length; index += 1) {
    const leg = journey.legs[index];
    statements.push(env.DB.prepare(`INSERT INTO booking_legs (id,booking_id,flight_id,flight_date,from_code,to_code,first_segment,last_segment,depart_time,arrive_time,leg_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), bookingId, leg.flightId, date, leg.from, leg.to, leg.firstSegment, leg.lastSegment, leg.departTime, leg.arriveTime, index + 1));
  }
  if (miles > 0) {
    statements.push(env.DB.prepare("INSERT INTO miles_ledger (id,user_id,booking_id,event_type,amount,description) VALUES (?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), user.id, bookingId, "flight_earn", miles, `Octee itinerary ${reference}`));
  }
  if (joelmobileEarned) {
    statements.push(env.DB.prepare("INSERT INTO miles_ledger (id,user_id,booking_id,event_type,amount,description) VALUES (?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), user.id, bookingId, "joelmobile_ride", 0, "JOELMOBILE ride limit marker"));
  }
  if (miles > 0) statements.push(env.DB.prepare("UPDATE users SET octmiles_balance=octmiles_balance+?,octmiles_lifetime=octmiles_lifetime+? WHERE id=?").bind(miles, miles, user.id));

  try {
    await env.DB.batch(statements);
  } catch (cause) {
    if (String(cause).toLowerCase().includes("booking_guards") || String(cause).toLowerCase().includes("not null")) throw new HttpError("Those seats were just taken. Search again and choose another flight.", 409);
    if (String(cause).toLowerCase().includes("unique")) {
      const existing = await env.DB.prepare("SELECT id FROM bookings WHERE user_id=? AND request_key=?").bind(user.id, requestKey).first();
      if (existing) {
        const booking = (await myBookings(user, env)).find((item) => item.id === existing.id);
        return json({ booking, message: "This booking was already confirmed.", milesEarned: booking.octmiles_earned });
      }
      throw new HttpError("Please try confirming once more.", 409);
    }
    throw cause;
  }
  const bookings = await myBookings(user, env);
  const created = bookings.find((item) => item.id === bookingId);
  return json({ booking: created, message: "Confirmed. The boarding pass is fictional; the peanuts are not.", milesEarned: miles }, 201);
}

async function listReviews(env: Env) {
  const result = await env.DB.prepare(`SELECT r.id,r.rating,r.title,r.body,r.route,r.verified_flyer,r.created_at,u.username
    FROM reviews r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC LIMIT 30`).all<ReviewRow>();
  return result.results;
}

async function saveReview(request: Request, env: Env, user) {
  const body = await readJson(request);
  const rating = Number(body.rating);
  const title = safeText(body.title, 60, "Title");
  const text = safeText(body.body, 500, "Review");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError("Rating must be between one and five stars.");
  if (text.length < 20) throw new HttpError("Your review needs at least 20 characters.");
  if (body.acknowledge !== true) throw new HttpError("Please tick that the review is about Octee, not your bag.");
  const hasBooking = await env.DB.prepare("SELECT 1 AS found FROM bookings WHERE user_id=? LIMIT 1").bind(user.id).first();
  const route = typeof body.route === "string" && body.route.length <= 24 ? body.route : null;
  const id = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO reviews (id,user_id,rating,title,body,route,verified_flyer) VALUES (?,?,?,?,?,?,?)").bind(id, user.id, rating, title, text, route, hasBooking ? 1 : 0),
      env.DB.prepare("INSERT INTO miles_ledger (id,user_id,event_type,amount,description) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM miles_ledger WHERE user_id=? AND event_type='first_review')").bind(crypto.randomUUID(), user.id, "first_review", 30, "First passenger review", user.id),
      env.DB.prepare("UPDATE users SET octmiles_balance=octmiles_balance+30,octmiles_lifetime=octmiles_lifetime+30 WHERE id=? AND changes()=1").bind(user.id),
    ]);
  } catch (cause) {
    if (String(cause).toLowerCase().includes("unique")) throw new HttpError("You have already reviewed Octee. You can edit your review instead.", 409);
    throw cause;
  }
  return json({ review: (await listReviews(env)).find((review) => review.id === id), message: "Thank you! Your review has been placed in the queue. The queue is also delayed." }, 201);
}

async function updateReview(request: Request, env: Env, user, reviewId: string, remove = false) {
  const existing = await env.DB.prepare("SELECT id FROM reviews WHERE id=? AND user_id=?").bind(reviewId, user.id).first();
  if (!existing) throw new HttpError("That review is not on your itinerary.", 404);
  if (remove) {
    await env.DB.prepare("DELETE FROM reviews WHERE id=? AND user_id=?").bind(reviewId, user.id).run();
    return json({ ok: true });
  }
  const body = await readJson(request);
  const rating = Number(body.rating);
  const title = safeText(body.title, 60, "Title");
  const text = safeText(body.body, 500, "Review");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 20 || body.acknowledge !== true) throw new HttpError("Check the rating, review length, and acknowledgement.");
  await env.DB.prepare("UPDATE reviews SET rating=?,title=?,body=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?").bind(rating, title, text, reviewId, user.id).run();
  return json({ review: (await listReviews(env)).find((review) => review.id === reviewId) });
}

async function trackBaggage(request: Request) {
  const body = await readJson(request);
  const tag = safeText(body.tag, 32, "Baggage tag");
  if (tag.length < 3) throw new HttpError("Baggage tags need at least three characters.");
  // This is a fictional tracker. Validate the request, then discard the supplied tag.
  const statusText = BAG_MESSAGES[crypto.getRandomValues(new Uint8Array(1))[0] % BAG_MESSAGES.length];
  return json({ status: statusText, progress: 99 });
}

async function appFetch(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = routePath(request);
  const method = request.method.toUpperCase();
  if (path.startsWith("/api/") && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") checkSameOrigin(request);
  if (method === "OPTIONS" && path.startsWith("/api/")) return new Response(null, { status: 204, headers: { "Allow": "GET,HEAD,POST,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Origin": url.origin, "Access-Control-Allow-Methods": "GET,HEAD,POST,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });

  if (path === "/health" || path === "/api/health") {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      return json({ status: "ok", service: "octee-airlines", database: "connected" });
    } catch {
      return json({ status: "degraded", service: "octee-airlines", database: "unavailable" }, 503);
    }
  }
  if (!path.startsWith("/api/")) return error("That Octee route is still looking for its gate.", 404);

  try {
    if (path === "/api/airports" && method === "GET") return json({ airports: await getAirports(env.DB) });
    if (path === "/api/flights" && method === "GET") return await searchFlights(request, env);
    if (path === "/api/status" && method === "GET") {
      const date = url.searchParams.get("date") || singaporeDate();
      if (!validDate(date)) throw new HttpError("Choose a valid date.");
      return json({ date, departures: await statusBoard(env, date) });
    }
    if (path === "/api/auth/signup" && method === "POST") return await authSignup(request, env);
    if (path === "/api/auth/login" && method === "POST") return await authLogin(request, env);
    if (path === "/api/auth/logout" && method === "POST") return await authLogout(request, env);
    if (path === "/api/me" && method === "GET") {
      const user = await currentUser(request, env);
      if (!user) return json({ user: null });
      return json({ user, bookings: await myBookings(user, env) });
    }
    if (path === "/api/bookings" && method === "GET") {
      const user = await currentUser(request, env);
      if (!user) throw new HttpError("Log in to see your trips.", 401);
      return json({ bookings: await myBookings(user, env) });
    }
    if (path === "/api/bookings" && method === "POST") {
      const user = await currentUser(request, env);
      if (!user) throw new HttpError("Log in or sign up before confirming your flight.", 401);
      return await createBooking(request, env, user);
    }
    if (path === "/api/reviews" && method === "GET") {
      const result = await listReviews(env);
      const average = result.length ? Math.round(result.reduce((sum, review) => sum + review.rating, 0) / result.length * 10) / 10 : null;
      return json({ reviews: result, average, total: result.length });
    }
    if (path === "/api/reviews" && method === "POST") {
      const user = await currentUser(request, env);
      if (!user) throw new HttpError("Log in to write a review.", 401);
      return await saveReview(request, env, user);
    }
    if (path.startsWith("/api/reviews/") && ["PATCH", "DELETE"].includes(method)) {
      const user = await currentUser(request, env);
      if (!user) throw new HttpError("Log in to edit your review.", 401);
      const id = path.slice("/api/reviews/".length);
      return await updateReview(request, env, user, id, method === "DELETE");
    }
    if (path === "/api/baggage" && method === "POST") return await trackBaggage(request);
    return error("That Octee route is still looking for its gate.", 404);
  } catch (cause) {
    if (cause instanceof HttpError) return error(cause.message, cause.status);
    console.error("Octee request failed", { path, message: String(cause?.message || cause) });
    return error("Something went wrong while our engines were being checked.", 500);
  }
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    return appFetch(request, env);
  },
};

export default worker;
