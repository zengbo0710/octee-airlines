import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { BookingForm } from "./components/BookingForm";
import { FlightCard } from "./components/FlightCard";
import { SiteHeader } from "./components/SiteHeader";
import { api, errorMessage, jsonPost, singaporeDate } from "./lib/api";
import type { Airport, Booking, Departure, Journey, Review, User } from "./types";

interface MeResponse { user: User | null; bookings: Booking[] }
interface ReviewsResponse { reviews: Review[]; average: number | null; total: number }
interface AuthResponse { user: User }
interface BaggageResponse { status: string; progress: number }

const taglines = [
  ["FLY SOMEWHERE.", "EVENTUALLY"],
  ["LOST?", "we will make you more lost"],
  ["YOUR BAGS", "our mystery"],
  ["are we taking off yet", "Are the engines working?"],
  ["THINK before you", "say"],
  ["becoming sophisticated is impossible", "at least on this flight"],
  ["Peanut? Peanut?", "ONE PEANUT"],
] as const;

const routeSections: Record<string, string> = {
  "/destinations": "destinations",
  "/book": "book",
  "/status": "status",
  "/reviews": "reviews",
  "/account": "account",
};

function todayStatusDate() {
  return singaporeDate();
}

function useClock() {
  const formatLocal = () => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
  const formatSingapore = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
  const [clock, setClock] = useState({ local: "--:--:--", singapore: "--:--:--" });
  useEffect(() => {
    const update = () => setClock({ local: formatLocal(), singapore: formatSingapore() });
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return clock;
}

function AccountPanel({
  mode,
  setMode,
  message,
  submitting,
  onClose,
  onSubmit,
}: {
  mode: "login" | "signup";
  setMode: (mode: "login" | "signup") => void;
  message: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="signup-panel" role="dialog" aria-modal="true" aria-labelledby="auth-heading">
        <button className="modal-close" type="button" aria-label="Close sign in" onClick={onClose}>×</button>
        <p className="eyebrow">Your account works across devices</p>
        <h2 id="auth-heading">WHO ARE YOU?<br /><span>we also forgot</span></h2>
        <div className="auth-tabs" role="tablist" aria-label="Account action">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Sign up · +100 Octmiles</button>
        </div>
        <form onSubmit={onSubmit}>
          <label>Username<input name="username" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" autoComplete="username" required autoFocus /></label>
          <label>Password<input name="password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>
          {mode === "signup" && <label>Confirm password<input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></label>}
          <p className="fine-print">This is a fictional airline. Don’t reuse an important password.</p>
          <button className="button" type="submit" disabled={submitting}>{submitting ? "Checking…" : mode === "signup" ? "Create account · +100 Octmiles" : "Log in"}</button>
          <p className="status-message" role="status">{message}</p>
        </form>
      </section>
    </div>
  );
}

function AccountTrips({ user, bookings }: { user: User; bookings: Booking[] }) {
  const tier = user.octmiles_lifetime >= 10000 ? "Platinum Wing" : user.octmiles_lifetime >= 2000 ? "Gold Wing" : user.octmiles_lifetime >= 500 ? "Silver Wing" : "Economy Peanut";
  return (
    <section id="account" className="section account-section">
      <div className="section-heading">
        <div><p className="eyebrow">My Octee</p><h2>Your account</h2></div>
        <p>{user.octmiles_balance.toLocaleString()} Octmiles · {tier} · account opened {new Date(user.created_at).toLocaleDateString()}</p>
      </div>
      <h3>My trips</h3>
      <div className="trip-list">
        {bookings.length ? bookings.map((booking) => (
          <article className="trip-card" key={booking.id}>
            <header><h4>{booking.origin_code} → {booking.destination_code} · {booking.trip_date}</h4><strong>{booking.reference}</strong></header>
            <p className="fine-print">{booking.passenger_name} · {booking.passenger_count} passenger(s) · {booking.aircraft} · {booking.cabin_class}</p>
            {booking.legs.map((leg) => <p key={`${booking.id}-${leg.flight_no}-${leg.leg_order || leg.from_code}`}>{leg.flight_no} ({leg.airline}) · {leg.from_code} {leg.depart_time} → {leg.to_code} {leg.arrive_time}</p>)}
            <small className="fine-print">{booking.octmiles_earned} Octmiles earned · Fictional boarding pass</small>
          </article>
        )) : <p className="fine-print">No trips yet. The gate is open.</p>}
      </div>
    </section>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const clock = useClock();
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewAverage, setReviewAverage] = useState<number | null>(null);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(singaporeDate);
  const [from, setFrom] = useState("FIA");
  const [to, setTo] = useState("SIA");
  const [passengers, setPassengers] = useState(1);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [searchMessage, setSearchMessage] = useState("");
  const [searchError, setSearchError] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState(false);
  const [baggageMessage, setBaggageMessage] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authMessage, setAuthMessage] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");

  async function refreshUser() {
    const response = await api<MeResponse>("/api/me");
    setUser(response.user);
    setBookings(response.bookings || []);
  }

  async function refreshReviews() {
    const response = await api<ReviewsResponse>("/api/reviews");
    setReviews(response.reviews);
    setReviewAverage(response.average);
    setReviewTotal(response.total);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      const [airportResult, statusResult, reviewsResult, meResult] = await Promise.allSettled([
        api<{ airports: Airport[] }>("/api/airports"),
        api<{ departures: Departure[] }>(`/api/status?date=${encodeURIComponent(todayStatusDate())}`),
        api<ReviewsResponse>("/api/reviews"),
        api<MeResponse>("/api/me"),
      ]);
      if (!active) return;
      if (airportResult.status === "fulfilled") setAirports(airportResult.value.airports);
      else setLoadError(`The app needs its D1 setup before this gate opens: ${errorMessage(airportResult.reason)}`);
      if (statusResult.status === "fulfilled") setDepartures(statusResult.value.departures);
      if (reviewsResult.status === "fulfilled") {
        setReviews(reviewsResult.value.reviews);
        setReviewAverage(reviewsResult.value.average);
        setReviewTotal(reviewsResult.value.total);
      }
      if (meResult.status === "fulfilled") {
        setUser(meResult.value.user);
        setBookings(meResult.value.bookings || []);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setTaglineIndex((index) => (index + 1) % taglines.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const section = routeSections[location.pathname];
    if (!section) {
      if (location.pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [location.pathname]);

  async function searchFlights(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchError(false);
    setSearchMessage("Checking shared seat inventory…");
    setJourneys([]);
    setSelectedJourney(null);
    setConfirmedBooking(null);
    try {
      const query = new URLSearchParams({ from, to, date, passengers: String(passengers) });
      const result = await api<{ journeys: Journey[] }>(`/api/flights?${query}`);
      setJourneys(result.journeys);
      setSearchMessage(`${result.journeys.length} itinerary option${result.journeys.length === 1 ? "" : "s"}. Departure: scheduled. Arrival: hopefully.`);
    } catch (error) {
      setSearchError(true);
      setSearchMessage(errorMessage(error));
    }
  }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setAuthSubmitting(true);
    setAuthMessage("Checking your boarding details…");
    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      await api<AuthResponse>(endpoint, jsonPost(values));
      await refreshUser();
      setAuthOpen(false);
      setAuthMessage("");
    } catch (error) {
      setAuthMessage(errorMessage(error));
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function logout() {
    try { await api("/api/auth/logout", jsonPost({})); } catch { /* The server response remains authoritative. */ }
    setUser(null);
    setBookings([]);
  }

  async function trackBaggage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tag = String(new FormData(event.currentTarget).get("tag") || "");
    setBaggageMessage("Locating your bag…");
    try {
      const result = await api<BaggageResponse>("/api/baggage", jsonPost({ tag }));
      setBaggageMessage(`${result.status} Progress: ${result.progress}%.`);
    } catch (error) {
      setBaggageMessage(errorMessage(error));
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const payload = {
      ...values,
      rating: Number(values.rating),
      acknowledge: values.acknowledge === "on",
    };
    setReviewError(false);
    setReviewMessage("Sending your review to the database…");
    try {
      const result = await api<{ message: string }>("/api/reviews", jsonPost(payload));
      setReviewMessage(result.message);
      form.reset();
      await Promise.all([refreshReviews(), refreshUser()]);
    } catch (error) {
      setReviewError(true);
      setReviewMessage(errorMessage(error));
      if (!user) {
        setAuthMode("login");
        setAuthOpen(true);
      }
    }
  }

  function chooseJourney(journey: Journey) {
    setSelectedJourney({ ...journey, requestKey: crypto.randomUUID() });
    setConfirmedBooking(null);
    navigate("/book");
  }

  function confirmBooking(booking: Booking) {
    setConfirmedBooking(booking);
    setSelectedJourney(null);
    void refreshUser();
  }

  const tagline = taglines[taglineIndex];

  return (
    <>
      <SiteHeader user={user} onOpenAccount={() => setAuthOpen(true)} onLogout={() => void logout()} />
      <aside className="clock-bar" aria-label="Current time">
        <span>Your time <time>{clock.local}</time></span><span>FIA <time>{clock.singapore}</time></span><span>SIA <time>{clock.singapore}</time></span>
      </aside>
      <main>
        {loadError && <p className="status-message error global-error" role="alert">{loadError}</p>}
        <section id="home" className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Fuji International Airport · A member of FAG</p>
            <h1 id="tagline"><span>{tagline[0]}</span><em>{tagline[1]}</em></h1>
            <p className="hero-intro">The premium airline experience you deserve. The timetable you might get.</p>
            <Link className="button" to="/book">Find your flight <span aria-hidden="true">→</span></Link>
            <p className="fine-print">*award-winning in a category we invented.</p>
          </div>
          <div className="hero-stamp" aria-label="Flight schedule from Fuji International Airport"><span>OA</span><strong>FI<span>A</span></strong><small>FLIGHT PLANS<br />ARE SUBJECT TO FLIGHT PLANS</small></div>
          <div className="hero-sky" aria-hidden="true"><span className="sun" /><span className="cloud cloud-one" /><span className="cloud cloud-two" /><span className="plane">✈</span></div>
        </section>

        <section id="destinations" className="section section-paper">
          <div className="section-heading"><div><p className="eyebrow">Route search</p><h2>Where to, eventually?</h2></div><p>Every visitor sees the same live schedule and remaining seats. The database is shared. The excuses are too.</p></div>
          <form className="search-panel" onSubmit={searchFlights}>
            <label>Flying from<select value={from} onChange={(event) => setFrom(event.target.value)} required>{airports.map((airport) => <option key={airport.code} value={airport.code}>{airport.code} — {airport.name}</option>)}</select></label>
            <label>Going to<select value={to} onChange={(event) => setTo(event.target.value)} required>{airports.map((airport) => <option key={airport.code} value={airport.code}>{airport.code} — {airport.name}</option>)}</select></label>
            <label>Travel date<input type="date" value={date} min={singaporeDate()} onChange={(event) => setDate(event.target.value)} required /></label>
            <label>Passengers<select value={passengers} onChange={(event) => setPassengers(Number(event.target.value))}>{Array.from({ length: 9 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number}</option>)}</select></label>
            <button className="button" type="submit">Search flights</button>
          </form>
          <p className={`status-message${searchError ? " error" : ""}`} role={searchError ? "alert" : "status"}>{searchMessage}</p>
          <div className="flight-results" aria-live="polite">
            {journeys.length ? journeys.map((journey, index) => <FlightCard key={`${journey.date}-${journey.legs.map((leg) => leg.flightId).join("-")}-${index}`} journey={journey} onChoose={chooseJourney} />) : searchMessage && !searchError ? <p className="empty-state">No flights that day. Not even eventually.</p> : null}
          </div>
          <div className="destination-grid">
            <article><span className="airport-code">SIA</span><h3>Scraggy International</h3><p>Transfer hub. Bring your patience and a map.</p></article>
            <article><span className="airport-code">LIA</span><h3>Lu Pin International</h3><p>About two hours, give or take a day.</p></article>
            <article><span className="airport-code">SCH</span><h3>Scraggy House</h3><p>New: we land in the garden. Shoes optional.</p></article>
          </div>
        </section>

        <section id="book" className="section booking-section">
          <div className="section-heading"><div><p className="eyebrow">No money will be taken</p><h2>Book a flight</h2></div><p>Choose a result above, complete the passenger details, and confirm. Your booking and seats are saved in Cloudflare D1.</p></div>
          {selectedJourney ? <BookingForm journey={selectedJourney} passengers={passengers} user={user} onCancel={() => setSelectedJourney(null)} onNeedLogin={() => { setAuthMode("login"); setAuthOpen(true); }} onConfirmed={confirmBooking} /> : confirmedBooking ? (
            <div className="confirmation" role="status">
              <h3>Confirmed. Please proceed to the gate, eventually.</h3>
              <p>{confirmedBooking.reference} · {confirmedBooking.origin_code} → {confirmedBooking.destination_code} · {confirmedBooking.trip_date}</p>
              {confirmedBooking.legs.map((leg) => <p key={`${leg.flight_no}-${leg.from_code}`}>{leg.flight_no} · {leg.from_code} {leg.depart_time} → {leg.to_code} {leg.arrive_time}</p>)}
              <strong>{confirmedBooking.octmiles_earned} Octmiles earned · No money was taken · Fictional boarding pass</strong>
            </div>
          ) : <div className="empty-state">Search the timetable above, then choose a flight to start your booking.</div>}
        </section>

        <section id="status" className="section status-section">
          <div className="section-heading"><div><p className="eyebrow">Today at FIA</p><h2>Flight status</h2></div><p>We have several statuses. “On time” is not one of them.</p></div>
          <div className="board-wrap"><table className="flight-board"><thead><tr><th scope="col">Flight</th><th scope="col">Destination</th><th scope="col">Scheduled</th><th scope="col">Status</th></tr></thead><tbody>
            {departures.length ? departures.map((flight) => <tr key={`${flight.flight}-${flight.scheduled}`}><td>{flight.flight}</td><td>{flight.destination}</td><td>{flight.scheduled}</td><td>{flight.status}</td></tr>) : <tr><td colSpan={4}>No departures from FIA today. The board is taking a personal day.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="section feature-band">
          <article><span className="eyebrow">In-flight dining</span><h2>Chef’s selection: one peanut.</h2><p>Served at room temperature. The room is also subject to availability.</p></article>
          <article><span className="eyebrow">Baggage support</span><h2>Your bags. Our mystery.</h2><form className="inline-form" onSubmit={trackBaggage}><label className="visually-hidden" htmlFor="bag-tag">Baggage tag number</label><input id="bag-tag" name="tag" placeholder="Enter baggage tag" minLength={3} maxLength={32} required /><button className="button button-light" type="submit">Track bag</button></form><p className="fine-print" role="status">{baggageMessage}</p></article>
        </section>

        <section id="reviews" className="section section-paper">
          <div className="section-heading"><div><p className="eyebrow">Passenger reviews</p><h2>We read them. Eventually.</h2></div><p><strong>4.9 ★*</strong><br /><small>{reviewTotal ? `Actual average: ${reviewAverage} ★ from ${reviewTotal} review${reviewTotal === 1 ? "" : "s"}.` : "No reviews yet. Everyone is still waiting to land."}</small></p></div>
          <div className="review-grid">
            {reviews.length ? reviews.map((review) => <article className="review-card" key={review.id}><div className="stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div><h3>{review.title}</h3><p>{review.body}</p><small>{review.username}{review.verified_flyer ? " · Verified Octee flyer ✈" : ""} · {new Date(review.created_at).toLocaleDateString()}</small></article>) : <p className="empty-state">No reviews yet. Everyone is still waiting to land.</p>}
          </div>
          {user && <form className="review-form" onSubmit={submitReview}>
            <h3>Leave a review</h3>
            <label>Rating<select name="rating">{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}</select></label>
            <label>Title<input name="title" maxLength={60} required /></label>
            <label>Your review<textarea name="body" minLength={20} maxLength={500} required /></label>
            <label className="check-row"><input name="acknowledge" type="checkbox" required /> This review is about Octee, not my bag</label>
            <button className="button" type="submit">Submit review</button><p className={`status-message${reviewError ? " error" : ""}`} role={reviewError ? "alert" : "status"}>{reviewMessage}</p>
          </form>}
        </section>

        {user && <AccountTrips user={user} bookings={bookings} />}
      </main>
      <footer className="site-footer"><div className="brand brand-footer"><span className="brand-mark">o</span><span>octee<small>Airlines</small></span></div><p>Octee Airlines, a member of Fuji Airport Group. Operating from Fuji International Airport. Opinions and peanuts are subject to availability.</p><a className="health-link" href="/health">System status</a></footer>
      {authOpen && <AccountPanel mode={authMode} setMode={(mode) => { setAuthMode(mode); setAuthMessage(""); }} message={authMessage} submitting={authSubmitting} onClose={() => setAuthOpen(false)} onSubmit={authenticate} />}
    </>
  );
}
