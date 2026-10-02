const byId = (id) => document.getElementById(id);
const formJson = (form) => Object.fromEntries(new FormData(form).entries());
const state = { user: null, journey: null, authMode: "login" };

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function singDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const piece = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${piece.year}-${piece.month}-${piece.day}`;
}

function updateClock() {
  const local = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const singapore = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  byId("local-time").textContent = local.format(new Date());
  byId("fia-time").textContent = singapore.format(new Date());
  byId("sia-time").textContent = singapore.format(new Date());
}

function setMessage(id, message, error = false) {
  const element = byId(id);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", error);
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll(".auth-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  const confirm = byId("confirm-password-label");
  confirm.classList.toggle("hidden", mode !== "signup");
  const confirmInput = confirm.querySelector("input");
  confirmInput.required = mode === "signup";
  byId("auth-form").querySelector("button[type=submit]").textContent = mode === "signup" ? "Create account · +100 Octmiles" : "Log in";
  setMessage("auth-message", "");
}

function showAccountPanel() {
  byId("account-panel").classList.remove("hidden");
  byId("account-panel").querySelector("input")?.focus();
}

function updateAccountUI(user, bookings = []) {
  state.user = user;
  const summary = byId("account-summary");
  const loginButton = byId("open-account");
  const logoutButton = byId("logout");
  const account = byId("account");
  const reviewForm = byId("review-form");
  if (!user) {
    summary.textContent = "Guest passenger";
    loginButton.textContent = "Log in";
    logoutButton.classList.add("hidden");
    account.classList.add("hidden");
    reviewForm.classList.add("hidden");
    return;
  }
  const tier = user.octmiles_lifetime >= 10000 ? "Platinum Wing" : user.octmiles_lifetime >= 2000 ? "Gold Wing" : user.octmiles_lifetime >= 500 ? "Silver Wing" : "Economy Peanut";
  summary.textContent = `${user.username} · ${user.octmiles_balance.toLocaleString()} Octmiles`;
  loginButton.textContent = "My account";
  logoutButton.classList.remove("hidden");
  account.classList.remove("hidden");
  reviewForm.classList.remove("hidden");
  byId("miles-summary").textContent = `${user.octmiles_balance.toLocaleString()} Octmiles · ${tier} · account opened ${new Date(user.created_at).toLocaleDateString()}`;
  renderBookings(bookings);
}

function renderBookings(bookings) {
  const list = byId("my-trips");
  list.replaceChildren();
  if (!bookings.length) {
    list.append(node("p", "fine-print", "No trips yet. The gate is open."));
    return;
  }
  for (const booking of bookings) {
    const card = node("article", "trip-card");
    const header = node("header");
    const title = node("h4", "", `${booking.origin_code} → ${booking.destination_code} · ${booking.trip_date}`);
    const ref = node("strong", "", booking.reference);
    header.append(title, ref);
    card.append(header, node("p", "fine-print", `${booking.passenger_name} · ${booking.passenger_count} passenger(s) · ${booking.aircraft} · ${booking.cabin_class}`));
    for (const leg of booking.legs) {
      const line = node("p", "", `${leg.flight_no} (${leg.airline}) · ${leg.from_code} ${leg.depart_time} → ${leg.to_code} ${leg.arrive_time}`);
      card.append(line);
    }
    card.append(node("small", "fine-print", `${booking.octmiles_earned} Octmiles earned · Fictional boarding pass`));
    list.append(card);
  }
}

function renderFlights(journeys, passengers) {
  const target = byId("flight-results");
  target.replaceChildren();
  if (!journeys.length) {
    target.append(node("p", "empty-state", "No flights that day. Not even eventually."));
    return;
  }
  journeys.forEach((journey, index) => {
    const card = node("article", "flight-card");
    const header = node("header");
    const title = node("h3", "", journey.legs.length === 1 ? journey.legs[0].flightNo : `${journey.legs.length} flights · connection`);
    header.append(title);
    journey.legs.forEach((leg) => header.append(node("span", `airline-tag ${leg.airline}`, leg.airline === "SA" ? "SA · PARTNER SIMULATION" : leg.airline)));
    card.append(header);
    for (const leg of journey.legs) {
      const route = node("div", "flight-route");
      const from = node("strong", "", leg.from);
      const middle = node("span", "", `${leg.flightNo} · ${leg.departTime} → ${leg.arriveTime}${leg.stops.length ? ` · via ${leg.stops.join(", ")}` : ""}`);
      const to = node("strong", "", leg.to);
      route.append(from, middle, to);
      card.append(route);
    }
    const footer = node("div", "flight-meta");
    footer.append(node("span", "", `${journey.availableSeats} seats remaining · ${journey.date} · Singapore time`));
    const choose = node("button", "button", "Choose flight");
    choose.type = "button";
    choose.addEventListener("click", () => selectJourney(journey, passengers));
    footer.append(choose);
    card.append(footer);
    target.append(card);
  });
}

function selectJourney(journey, passengers) {
  state.journey = { ...journey, requestKey: crypto.randomUUID() };
  byId("booking-empty").classList.add("hidden");
  byId("booking-confirmation").classList.add("hidden");
  byId("booking-form").classList.remove("hidden");
  const summary = byId("selected-itinerary");
  summary.replaceChildren(node("h3", "", `${journey.from} → ${journey.to} · ${journey.date}`));
  for (const leg of journey.legs) summary.append(node("p", "", `${leg.flightNo} · ${leg.from} ${leg.departTime} → ${leg.to} ${leg.arriveTime}${leg.airline === "SA" ? " · Partner flight simulation" : ""}`));
  summary.append(node("small", "fine-print", `${passengers} passenger(s). The seats are shared by all visitors.`));
  byId("booking-form").elements.passengerName.value = state.user?.username || "";
  byId("booking-form").elements.passengers && (byId("booking-form").elements.passengers.value = passengers);
  location.hash = "book";
  byId("booking-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReviews(reviews, average, total) {
  const list = byId("review-list");
  list.replaceChildren();
  const avg = byId("actual-average");
  if (avg) avg.textContent = total ? `Actual average: ${average} ★ from ${total} review${total === 1 ? "" : "s"}.` : "No reviews yet. Everyone is still waiting to land.";
  if (!reviews.length) {
    list.append(node("p", "empty-state", "No reviews yet. Everyone is still waiting to land."));
    return;
  }
  for (const review of reviews) {
    const card = node("article", "review-card");
    card.append(node("div", "stars", `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`));
    card.append(node("h3", "", review.title));
    card.append(node("p", "", review.body));
    const author = `${review.username}${review.verified_flyer ? " · Verified Octee flyer ✈" : ""}`;
    card.append(node("small", "", `${author} · ${new Date(review.created_at).toLocaleDateString()}`));
    list.append(card);
  }
}

async function loadAirports() {
  const data = await api("/api/airports");
  const fromSelect = byId("from-code");
  const toSelect = byId("to-code");
  for (const airport of data.airports) {
    const fromOption = document.createElement("option");
    fromOption.value = airport.code;
    fromOption.textContent = `${airport.code} — ${airport.name}`;
    fromSelect.append(fromOption);
    const toOption = fromOption.cloneNode(true);
    toSelect.append(toOption);
  }
  fromSelect.value = "FIA";
  toSelect.value = "SIA";
}

async function loadStatus() {
  const body = byId("status-rows");
  try {
    const { departures } = await api(`/api/status?date=${encodeURIComponent(singDate())}`);
    body.replaceChildren();
    if (!departures.length) {
      const row = node("tr");
      const cell = node("td", "", "No departures from FIA today. The board is taking a personal day.");
      cell.colSpan = 4;
      row.append(cell);
      body.append(row);
    }
    departures.forEach((flight) => {
      const row = node("tr");
      [flight.flight, flight.destination, flight.scheduled, flight.status].forEach((value) => row.append(node("td", "", value)));
      body.append(row);
    });
  } catch {
    body.replaceChildren();
    const row = node("tr");
    const cell = node("td", "", "The board is delayed. We are checking the database.");
    cell.colSpan = 4;
    row.append(cell);
    body.append(row);
  }
}

async function loadReviews() {
  try {
    const data = await api("/api/reviews");
    renderReviews(data.reviews, data.average, data.total);
  } catch {
    renderReviews([], null, 0);
  }
}

async function loadUser() {
  const data = await api("/api/me");
  updateAccountUI(data.user, data.bookings || []);
}

function rotateTaglines() {
  const taglines = [
    ["FLY SOMEWHERE.", "EVENTUALLY"],
    ["LOST?", "we will make you more lost"],
    ["YOUR BAGS", "our mystery"],
    ["are we taking off yet", "Are the engines working?"],
    ["THINK before you", "say"],
    ["becoming sophisticated is impossible", "at least on this flight"],
    ["Peanut? Peanut?", "ONE PEANUT"],
  ];
  let current = 0;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;
  setInterval(() => {
    current = (current + 1) % taglines.length;
    const heading = byId("tagline");
    heading.replaceChildren(node("span", "", taglines[current][0]), node("em", "", taglines[current][1]));
  }, 6500);
}

byId("menu-toggle").addEventListener("click", () => {
  const expanded = byId("menu-toggle").getAttribute("aria-expanded") === "true";
  byId("menu-toggle").setAttribute("aria-expanded", String(!expanded));
  byId("main-nav").classList.toggle("open", !expanded);
});
document.querySelectorAll("#main-nav a").forEach((link) => link.addEventListener("click", () => {
  byId("menu-toggle").setAttribute("aria-expanded", "false");
  byId("main-nav").classList.remove("open");
}));
byId("travel-date").min = singDate();
byId("travel-date").value = singDate();
byId("open-account").addEventListener("click", () => state.user ? byId("account").scrollIntoView({ behavior: "smooth" }) : showAccountPanel());
byId("close-account").addEventListener("click", () => byId("account-panel").classList.add("hidden"));
document.querySelectorAll(".auth-tabs button").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.mode)));

byId("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("auth-message", "Checking your boarding details…");
  const form = formJson(event.currentTarget);
  const endpoint = state.authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
  try {
    const data = await api(endpoint, { method: "POST", body: JSON.stringify(form) });
    updateAccountUI(data.user, []);
    byId("account-panel").classList.add("hidden");
    setMessage("auth-message", "");
    if (state.journey) byId("booking-form").elements.passengerName.value = data.user.username;
    await loadUser();
  } catch (error) {
    setMessage("auth-message", error.message, true);
  }
});

byId("logout").addEventListener("click", async () => {
  try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } catch { /* The cookie is still cleared locally by the response when available. */ }
  updateAccountUI(null);
});

byId("search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const from = byId("from-code").value;
  const to = byId("to-code").value;
  const date = byId("travel-date").value;
  const passengers = Number(byId("passengers").value);
  setMessage("search-message", "Checking shared seat inventory…");
  byId("flight-results").replaceChildren();
  try {
    const data = await api(`/api/flights?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}&passengers=${passengers}`);
    setMessage("search-message", `${data.journeys.length} itinerary option${data.journeys.length === 1 ? "" : "s"}. Departure: scheduled. Arrival: hopefully.`);
    renderFlights(data.journeys, passengers);
  } catch (error) {
    setMessage("search-message", error.message, true);
  }
});

byId("booking-form").elements.passengers && (byId("booking-form").elements.passengers.value = "1");
byId("booking-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) {
    setMessage("booking-message", "Log in or sign up to confirm and save this trip.");
    setAuthMode("login");
    showAccountPanel();
    return;
  }
  if (!state.journey) return;
  const form = event.currentTarget;
  const payload = {
    ...formJson(form),
    date: state.journey.date,
    requestKey: state.journey.requestKey,
    from: state.journey.from,
    to: state.journey.to,
    passengers: Number(byId("passengers").value),
    bags: Number(form.elements.bags.value),
    joelmobile: form.elements.joelmobile.checked,
    terms: [...form.querySelectorAll('input[name="terms"]:checked')].map((input) => input.value),
    flightIds: state.journey.legs.map((leg) => leg.flightId),
  };
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage("booking-message", "Reserving shared seats…");
  try {
    const result = await api("/api/bookings", { method: "POST", body: JSON.stringify(payload) });
    form.classList.add("hidden");
    byId("booking-confirmation").classList.remove("hidden");
    const confirmation = byId("booking-confirmation");
    confirmation.replaceChildren(node("h3", "", "Confirmed. Please proceed to the gate, eventually."), node("p", "", `${result.booking.reference} · ${result.booking.origin_code} → ${result.booking.destination_code} · ${result.booking.trip_date}`));
    result.booking.legs.forEach((leg) => confirmation.append(node("p", "", `${leg.flight_no} · ${leg.from_code} ${leg.depart_time} → ${leg.to_code} ${leg.arrive_time}`)));
    confirmation.append(node("strong", "", `${result.milesEarned} Octmiles earned · No money was taken · Fictional boarding pass`));
    state.journey = null;
    await loadUser();
  } catch (error) {
    setMessage("booking-message", error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});
byId("cancel-booking").addEventListener("click", () => {
  state.journey = null;
  byId("booking-form").reset();
  byId("booking-form").classList.add("hidden");
  byId("booking-empty").classList.remove("hidden");
});

byId("baggage-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const tag = new FormData(event.currentTarget).get("tag");
  byId("bag-result").textContent = "Locating your bag…";
  try {
    const result = await api("/api/baggage", { method: "POST", body: JSON.stringify({ tag }) });
    byId("bag-result").textContent = `${result.status} Progress: ${result.progress}%.`;
  } catch (error) {
    byId("bag-result").textContent = error.message;
  }
});

byId("review-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = { ...formJson(form), rating: Number(form.elements.rating.value), acknowledge: form.elements.acknowledge.checked };
  setMessage("review-message", "Sending your review to the database…");
  try {
    const result = await api("/api/reviews", { method: "POST", body: JSON.stringify(payload) });
    setMessage("review-message", result.message);
    form.reset();
    await loadReviews();
    await loadUser();
  } catch (error) {
    setMessage("review-message", error.message, true);
    if (!state.user) showAccountPanel();
  }
});

updateClock();
setInterval(updateClock, 1000);
rotateTaglines();
setAuthMode("login");
Promise.all([loadAirports(), loadStatus(), loadReviews(), loadUser()]).catch((error) => {
  setMessage("search-message", `The app needs its D1 setup before this gate opens: ${error.message}`, true);
});
