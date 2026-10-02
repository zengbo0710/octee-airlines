# Octee Airlines — Development and deployment

## Project settings

- **Source repository:** [`zengbo0710/octee-airlines`](https://github.com/zengbo0710/octee-airlines), default branch `main`.
- **Application runtime and deployment:** Cloudflare Worker `octee-airlines`, deployed by GitHub Actions with Wrangler.
- **Persistent database:** Cloudflare D1 database `octee-airlines-db`, bound as `DB`; ID `72f3d11b-1efc-4108-a713-3f0dff849cf6`.
- **Free app URL:** [`https://octee-airlines.octee.workers.dev`](https://octee-airlines.octee.workers.dev), using the Cloudflare account's `octee` `workers.dev` subdomain.
- **Application stack:** React + TypeScript + React Router + Tailwind CSS, built with Vite and Cloudflare's Vite plugin; Cloudflare Workers API; Cloudflare D1 (SQLite) database.
- **GitHub Actions secrets:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The account token needs D1 Edit for remote migrations and Workers Editor for deployment; keep values out of source control. The account ID must own the bound D1 database.
- **Data model:** the Worker provides the application UI and JSON API; D1 is the shared source of truth for accounts, sessions, bookings, seat inventory, Octmiles, reviews, redemption codes, and audit records. The fictional baggage tracker discards the submitted tag and does not store baggage queries. Browser storage is only for temporary form drafts and preferences.
- **Hosting rule:** use Cloudflare Workers + D1. Do not deploy this application to GitHub Pages or make it a client-only/localStorage app. GitHub stores source; Cloudflare runs the app and stores its data.

## 1. Concept

> A parody application for **Octee Airlines**, a completely fictional airline that is a total mess but desperately pretends everything is fine.

Octee Airlines presents itself like a premium, award-winning carrier. Glossy hero images, confident corporate copy, smiling crew. But the cracks show everywhere: delayed buttons, missing baggage, one peanut per passenger, and taglines that accidentally tell the truth.

**The core joke:** *the website is trying very hard to trick passengers into thinking Octee is doing well, and failing.*

### Design principle: "The Two Faces"

Every page has two layers:

| Layer | What it looks like | Example |
|---|---|---|
| **The Facade** | Polished, corporate, luxury-airline styling | "Award-winning service across 3 continents" |
| **The Mess** | Small truths that leak through | Tiny footnote: "*award was a participation certificate" |

Rule of thumb: the facade is **big and loud**, the mess is **small, quick, or hidden**, and the user discovers it. The humour should land on second glance.

---

## 2. Organisation (in-universe lore)

```
FAG — Fuji Airport Group            (parent company)
 └── FIA — Fuji International Airport   (home base / hub)
      └── Octee Airlines                (the airline)
```

- **FAG (Fuji Airport Group):** the parent group. Appears only in the footer and the "About" page, always with overly formal legal wording.
- **FIA (Fuji International Airport):** Octee's hub. All flights depart from FIA (eventually). FIA has its own slogans, shown on the airport pages and around the site.
- **Octee Airlines:** the main brand of the site.

### Airports Octee serves

| Code | Airport | Role |
|---|---|---|
| **FIA** | Fuji International Airport | Home base / hub (part of FAG) |
| **SIA** | Scraggy International Airport | Destination |
| **LIA** | Lu Pin International Airport | Destination |
| **SCH** | Scraggy House | Destination (new). Not really an airport: "we land in the garden" |

Octee Airlines' flight code is **OA**. FIA is Octee's home base, but flights **don't all have to start or end at FIA**:

- Some OA flights make **stops**, like real airlines. For example OA 101 flies **LIA → SIA → FIA**: passengers can board or get off at SIA on the way. One flight number covers the whole trip.
- Passengers can **change planes at any airport** where flights meet (FIA, SIA, LIA or Scraggy House), including changing from an Octee flight to a **Scraggy Airlines (SA)** flight at SIA.
- Every OA flight still touches FIA somewhere on its route (start, stop or end).

#### Weekly timetable

Flight numbers: **OA 58** is the flight to Scraggy International (SIA). **OA 100–OA 118** are all the other flights, each flying on set days of the week. Times are local; FIA, SIA, LIA and Scraggy House all use Singapore time ("we checked once"). Days and times are stored in D1 `flights` rows and seeded/changed through versioned SQL migrations.

| Flight | Route (stops) | Days | Times |
|---|---|---|---|
| **OA 58** | FIA → SIA | Every day | FIA 07:30 → SIA 09:20 |
| OA 100 | FIA → **SIA** → LIA | Mon, Thu | FIA 07:40 → SIA 09:30 / 10:10 → LIA 11:25 |
| OA 101 | LIA → **SIA** → FIA | Tue, Fri | LIA 07:45 → SIA **09:34** / 10:15 → FIA 12:05 |
| OA 102 | FIA → **SIA** → LIA | Wed, Sat | FIA 14:30 → SIA 16:20 / 17:00 → LIA 18:15 |
| OA 103 | LIA → **SIA** → FIA | Thu, Sun | LIA 13:20 → SIA 14:35 / 15:10 → FIA 17:00 |
| OA 104 | SIA → FIA | Mon | SIA 13:30 → FIA 15:20 |
| OA 105 | SIA → FIA | Wed | SIA 16:45 → FIA 18:35 |
| OA 106 | SIA → FIA | Sat | SIA 13:30 → FIA 15:20 |
| OA 107 | FIA → LIA | Tue | FIA 09:00 → LIA 11:30 |
| OA 108 | FIA → LIA | Fri | FIA 15:40 → LIA 18:10 |
| OA 109 | LIA → FIA | Wed | LIA 07:10 → FIA 09:40 |
| OA 110 | LIA → FIA | Sun | LIA 18:00 → FIA 20:30 |
| OA 111 | FIA → Scraggy House | Tue | FIA 11:15 → SCH 13:05 |
| OA 112 | FIA → Scraggy House | Sat | FIA 08:00 → SCH 09:50 |
| OA 113 | Scraggy House → FIA | Wed | SCH 14:00 → FIA 15:50 |
| OA 114 | Scraggy House → FIA | Sun | SCH 17:00 → FIA 18:50 |
| OA 115 | LIA → **FIA** → Scraggy House | Sat | LIA 06:30 → FIA 09:00 / 09:45 → SCH 11:35 |
| OA 116 | Scraggy House → **FIA** → LIA | Sun | SCH 08:20 → FIA 10:10 / 10:50 → LIA 13:20 |
| OA 117 | FIA → **Scraggy House** → SIA | Thu | FIA 10:00 → SCH 11:50 / 12:30 → SIA 13:10 |
| OA 118 | SIA → **Scraggy House** → FIA | Thu | SIA 15:00 → SCH 15:40 / 16:20 → FIA 18:10 |

Bold airports are stops in the middle of a flight.

| Octmiles per stretch flown | Octmiles |
|---|---|
| FIA ↔ SIA | 150 |
| FIA ↔ LIA | 200 |
| FIA ↔ Scraggy House | 250 |
| SIA ↔ LIA | 120 |
| SIA ↔ Scraggy House | 80 |

A trip earns the Octmiles of every stretch flown on OA (e.g. FIA → SIA → LIA on OA 100 = 150 + 120).

#### Connections: different passengers, same flight

Passengers from different places can end up on **the same flight**, either by changing planes or by boarding a flight that stops:

**Example 1 — changing at SIA onto a Scraggy flight (Tuesday or Friday):**

```
FIA ── OA 58  ──► SIA  lands 09:20 ─┐
                                    ├──► SA103  SIA 10:30 → Mdm Wrong-Wrong's   (same flight, both passengers)
LIA ── OA 101 ──► SIA  lands 09:34 ─┘    (OA 101 then carries on to FIA without them)
```

**Example 2 — boarding a flight that stops (Saturday):** OA 115 picks up passengers at LIA (06:30), lands at FIA (09:00), picks up more passengers at FIA (09:45) and takes **everyone** on to Scraggy House. LIA passengers stay on board.

**Example 3 — changing at FIA (Wednesday):** OA 109 from LIA lands at FIA 09:40; the passenger changes to OA 102 (FIA 14:30 → SIA → LIA) or waits for anything else leaving FIA later that day.

Rules:

- **Minimum connection time: 45 minutes** at any airport (OA → OA, OA → SA, SA → OA). *"Plenty of time. Unless you take the JOELMOBILE."*
- **Staying on a flight that stops** is not a connection (no minimum time, same seat).
- At most **2 changes** (3 flights) in one direction, all on the **same day**.
- Each OA flight has **180 seats**, counted **per stretch**: a passenger from LIA to Scraggy House on OA 115 uses a seat on LIA → FIA and FIA → SCH; one from FIA uses a seat only on FIA → SCH. Seat inventory is shared in D1 by flight date and route segment. The search and booking API reads the same inventory for every visitor, and a reservation updates all affected segments atomically. When a stretch is full, the calendar greys the day out.

### ONE UNITED (OU)

> **ONE UNITED**
> *unitation is a dream, it's chaos.*

One United is **another airline at FIA** (flight code **OU**). It serves mainly **Scraggy House and SIA** from FIA, and its flights are timed so they can be **one part of a longer trip with Octee (OA) or Scraggy Airlines (SA)**.

| Flight | Route (stops) | Days | Times |
|---|---|---|---|
| OU 1 | FIA → SIA | Every day | FIA 06:45 → SIA 08:35 |
| OU 2 | SIA → FIA | Every day | SIA 13:20 → FIA 15:10 |
| OU 3 | FIA → **Scraggy House** → SIA | Mon, Wed, Fri | FIA 06:30 → SCH 08:20 / 08:45 → SIA 09:20 |
| OU 4 | SIA → **Scraggy House** → FIA | Mon, Wed, Fri | SIA 13:45 → SCH 14:20 / 14:50 → FIA 16:40 |
| OU 5 | FIA → Scraggy House | Thu, Sun | FIA 17:50 → SCH 19:40 |
| OU 6 | Scraggy House → FIA | Thu, Sun | SCH 20:20 → FIA 22:10 |
| OU 7 | FIA → SIA | Every day | FIA 16:30 → SIA 18:20 |
| OU 8 | SIA → FIA | Every day | SIA 19:10 → FIA 21:00 |

- **More connections with SA:** OU 1 (daily) and OU 3 land at SIA in time for every morning Scraggy flight (SA101 10:20, SA103 10:30, SA105 10:45, SA107 11:00). Coming back, the Scraggy flights land at SIA by 12:30 and OU 2 (daily, 13:20), OU 4 (13:45) and OU 8 (19:10) fly home to FIA. So there is now a way to and from Mdm Wrong-Wrong's and Lujin's **every day**. OA 100 was also moved 30 minutes earlier (lands SIA 09:30) so it connects with all four SA flights.
- **Connections with OA:** e.g. OA 103 from LIA lands at FIA 17:00 → OU 5 to Scraggy House 17:50 (Thu, Sun); OA 104 / OA 106 land at FIA 15:20 → OU 7 to SIA 16:30.
- **Booking:** OU flights are booked on the normal **Octee form** (no extra form) and appear in the same flight options, marked "One United". They follow the same rules (45 minutes to change, max 2 changes, 180 seats per stretch).
- **Octmiles:** OU flights earn **half** the Octmiles of the same stretch on Octee. *"One United shares the miles. Unevenly."*
- **Where it shows:** its own page `oneunited.html` (headline + timetable + live examples of connections), a banner on Home, the search results, the Destinations cards, the status board (marked "[One United]") and boarding passes (light blue).
- Data: `OU_FLIGHTS` in `js/destinations.js`.

### Partner airline: Scraggy Airlines (SA)

**SA is Scraggy Airlines, based at Scraggy International Airport (SIA)**: the airline from the Scraggy project. Octee does **not** fly to Mdm Wrong-Wrong's or Lujin's; Scraggy Airlines does, from SIA. Everything about SA flights must **match the real Scraggy flights** in `Scraggy-airlines/js/data.js`: flight numbers, gates, aircraft, classes, snacks, reasons, tick boxes and rules. Octee never makes up its own version.

| Scraggy route (from Scraggy's `ROUTES`) | Outbound | Times (daily) | Return | Times (daily) | Gate at SIA |
|---|---|---|---|---|---|
| SIA ↔ Scraggy House | SA101 | 10:20 → 10:50 | SA102 | 11:50 → 12:20 | SCG001 |
| SIA ↔ Mdm Wrong-Wrong's | SA103 | 10:30 → 11:20 | SA104 | 11:40 → 12:30 | SCG002 |
| SIA ↔ Lujin's | SA105 | 10:45 → 11:40 | SA106 | 11:35 → 12:30 | SCG003 |
| **SIA ↔ FIA** (new) | **SA107** | SIA 11:00 → FIA 12:50 | **SA108** | FIA 14:00 → SIA 15:50 | SCG012 |

- **Times and the FIA route are now in the Scraggy project** (`Scraggy-airlines/js/data.js`, `routes` table in its `schema.sql`, its Destinations page and boarding passes). Octee reads them from there; don't copy them into Octee by hand.
- **Scraggy flies to FIA too.** SA107 / SA108 compete with Octee on SIA ↔ FIA. Octee's search and flight options show them as "Operated by Scraggy Airlines" next to OA flights (e.g. SIA → FIA: OA 101 at 10:15 or SA107 at 11:00). An SA-only trip is booked with the SIA form only.
- **More connections at FIA:** SA107 lands at FIA 12:50, so passengers from SIA can change at FIA onto later OA flights (e.g. OA 102 at 14:30 on Wed/Sat, OA 108 at 15:40 on Fri), and OA flights landing at FIA before 13:15 connect onto SA108 at 14:00.
- Scraggy books **one passenger per booking** (its form has a single passenger name), so transfer bookings are for **1 passenger**.

So to reach Mdm Wrong-Wrong's, passengers fly Octee to **SIA** (e.g. OA 58 from FIA, or OA 101 from LIA), then change at **Scraggy International Airport (SIA)** to SA103 → Mdm Wrong-Wrong's. Booking a transfer means filling in **two forms** (§5.10): one for the Octee flight(s) and one for the SIA flight (Scraggy). The destination search (§5.12) shows the route.

> All names, companies and places are fictional. Any resemblance to real airlines or airports is coincidental.

---

## 3. Official FIA Taglines

These are the signature quotes. **Line breaks are part of the joke and must be preserved exactly.** Each one is one "slide" in the hero rotator and can also appear as a standalone banner.

**1. FLY SOMEWHERE.**
```
FLY SOMEWHERE.
EVENTUALLY
```

**2. LOST?**
```
LOST? we will make you more lost
```

**3. YOUR BAGS**
```
YOUR BAGS
our mystery
```

**4. Are we taking off yet**
```
"are we taking off yet"
Are the engines working?
```

**5. THINK**
```
THINK
before you
say
```

**6. Becoming sophisticated**
```
becoming sophisticated
is impossible
at least on this flight        ← rendered in SMALL text
```

**7. Peanut? Peanut?**
```
Peanut? Peanut?
ONE PEANUT
```

### Typography rules for taglines

- First line = the **facade**: large, bold, confident.
- Final line = the **punchline**: noticeably different (smaller, lighter, italic, or delayed fade-in).
- Tagline 6: last line must be *small* (about 40% of the heading size).
- Tagline 7: "ONE PEANUT" in bold caps, ideally with a single 🥜 icon, never more than one.
- Store taglines as data (see §8) so line breaks are explicit, never hard-coded `<br>` soup.

---

## 4. Site Map

| Page | File | Purpose |
|---|---|---|
| Home | `index.html` | Hero tagline rotator, flight search widget (leads to the booking form), highlights |
| Destinations | `destinations.html` | Destination search box (§5.12) + places Octee *claims* to fly to |
| Flight Status | `status.html` | Live departures board from FIA (everything is delayed) |
| Baggage | `baggage.html` | "Track your bag" tool (results are always a mystery) |
| In-Flight Experience | `experience.html` | Meals (one peanut), entertainment, comfort |
| About Octee | `about.html` | Corporate history, FAG/FIA structure, "awards" |
| FIA Airport | `fia.html` | Fuji International Airport info and taglines |
| Contact | `contact.html` | Customer service form that goes nowhere |
| Log in / Sign up | `login.html` | Octee account login (see §7) |
| My Account | `account.html` | Profile and My Trips (logged-in only) |
| Octmiles | `octmiles.html` | Octmiles balance, tier, history, rewards shop and the **"Have a code?"** box (see §7) |
| JOELMOBILE | `joelmobile.html` | The airport "help" buggy at FIA (see §5.9) |
| One United | `oneunited.html` | **ONE UNITED / unitation is a dream, it's chaos.** The OU airline: timetable and connections (see §2) |
| Book a Flight | `book.html` | The booking form. **The only way to book a flight** (see §5.10) |
| Reviews | `reviews.html` | Passenger reviews and a write-a-review form (see §5.11) |

Start with **Home** only, then add pages in the order in §10.

---

## 5. Page Specs

### 5.0 Every page: live clock at the side

A live clock panel on the side of every page, the same as the Scraggy Airlines project (reuse its `js/clock.js`).

| Row | Shows | Time zone |
|---|---|---|
| **Your time** | The visitor's computer time | Browser default (no time zone set) |
| **FIA time** | Fuji International Airport | `Asia/Singapore` |
| **SIA time** | Scraggy International Airport (same as Scraggy's clock) | `Asia/Singapore` (Scraggy's `SIA_TIMEZONE`) |

- Under the times: today's date, e.g. "Thu, 1 Oct 2026".
- Small joke caption at the bottom: *"FIA and SIA share a time zone. Our flights still can't agree on the time."*
- 24-hour `HH:MM:SS`, updates every second, pauses while the tab is hidden (saves battery).
- **Desktop (900px and wider):** fixed card on the right side, just under the nav, about 172px wide. Give the page `padding-right` so content never hides behind it.
- **Phones:** a slim strip under the nav with the three times in one row.
- **Accessibility:** `<aside aria-label="Current time">` with `<time>` elements. No `aria-live` on the ticking times (screen readers would read it every second).

```js
// js/clock.js (from Scraggy, with FIA added and Mdm Wrong-Wrong's row removed)
const fmt = (timeZone) => new Intl.DateTimeFormat("en-GB", {
  timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
const yourFmt = fmt(undefined);            // computer's own time
const fiaFmt  = fmt(CONFIG.FIA_TIMEZONE);  // "Asia/Singapore"
const siaFmt  = fmt(CONFIG.SIA_TIMEZONE);  // "Asia/Singapore"
```

### 5.1 Home (`index.html`)

- **Nav bar:** Octee logo (`assets/img/octee-logo.svg`) + links + account area on the right ("Log in", or "Hi, username · 1,250 Octmiles · Gold Wing · Log out"). One link is slightly misaligned on purpose. Clicking the logo 8 times quickly opens the secret Control Tower (§7.5).
- **Hero:** full-width sky image, tagline rotator cycling the 7 taglines (about 5s each). Punchline line fades in about 1s after the main line.
- **Destination search box** in the hero: *"Where do you want to go? (We may take you there.)"* Same search as §5.12; pressing Enter opens `destinations.html?q=…` with the results.
- **Booking widget:** From / To (one end is always FIA, the other is SIA, LIA or Scraggy House) / Dates (the flight calendar from §5.10) / Passengers → "Search Flights".
  - On submit: loading spinner that takes far too long, then a result like *"1 flight found. Departure: TBA. Arrival: Hopefully."*
  - The result has a **"Book this flight"** button that opens the booking form (`book.html`) with From / To / Date / Passengers already filled in. The widget itself never books anything: every booking goes through the form.
- **Stats strip (facade):** "99% On-Time*", "1,000,000 Happy Passengers*", "0 Problems*".
  - Footnote in tiny text: "*on-time for something", "*passengers who did not leave a review", "*that we know of".
- **Highlights cards:** Destinations, Baggage, In-Flight, Reviews, each linking to its page.
- **Review strip:** the three newest 4–5★ reviews, with "Read all reviews" → `reviews.html`.
- **Footer:** "Octee Airlines, a member of FAG (Fuji Airport Group). Operating from FIA (Fuji International Airport)."

### 5.2 Flight Status (`status.html`)

Airport-style departures board (flip-board look).

Rows come from the weekly timetable (§2) for **today's** day of the week, so the board changes every day. Flights that stop show it, e.g. "LIA via SIA". Example for a Tuesday:

| Flight | Destination | Scheduled | Status |
|---|---|---|---|
| OA 58 | SIA — Scraggy International | 07:30 | DELAYED |
| OA 107 | LIA — Lu Pin International | 09:00 | BOARDING (since Tuesday) |
| OA 111 | Scraggy House | 11:15 | ENGINES BEING CHECKED |
| OA 101 | Arriving from LIA via SIA | 12:05 | PILOT LOOKING FOR KEYS |
| OA 404 | Not Found | — | LOST |

- Statuses update randomly every few seconds via JS, but never to "ON TIME".
- Banner: *"are we taking off yet" / Are the engines working?*

### 5.3 Baggage (`baggage.html`)

- Banner: *YOUR BAGS / our mystery*
- "Track your bag" input (any tag number).
- Result is random from a list, e.g.:
  - "Your bag is on a better holiday than you."
  - "Last seen: Gate 7. Possibly Gate 8. Spiritually, everywhere."
  - "Your bag has been upgraded to a different flight."
- A fake progress bar that reaches 99% and stops.

### 5.4 In-Flight Experience (`experience.html`)

- **Dining:** luxury-menu styling for a single peanut. "Chef's Selection: One Peanut. Served at room temperature."
  - Interactive gag: a "Request another peanut" button → *"Peanut? Peanut? / ONE PEANUT"*.
- **Comfort:** banner *"becoming sophisticated / is impossible / at least on this flight"*.
- **Entertainment:** "Window (subject to availability)".

### 5.5 About (`about.html`)

- Proud corporate timeline with suspicious entries ("2019: Bought a second plane. 2020: Found the first plane.").
- Org chart: FAG → FIA → Octee.
- "Awards" section with participation certificates.
- Banner: *THINK / before you / say*.

### 5.6 FIA Airport (`fia.html`)

- Terminal map that is deliberately confusing, with tagline *LOST? we will make you more lost*.
- All 7 FIA taglines shown as a poster gallery.
- A "Need help? Call the JOELMOBILE" banner linking to `joelmobile.html`.

### 5.7 Destinations (`destinations.html`)

- **Destination search box** at the top of the page (§5.12).
- Three main destination cards: **SIA (Scraggy International Airport)**, **LIA (Lu Pin International Airport)** and **Scraggy House** (new, badge "NEW: we land in the garden"), each with a glossy photo, flight number, flight time ("about 2 hours, give or take a day") and a "Book now" button that opens `book.html?to=SIA` / `?to=LIA` / `?to=SCH`.
- A smaller "Partner destinations (transfer via SIA, operated by Scraggy Airlines)" row: Mdm Wrong-Wrong's and Lujin's, each with "Book transfer (2 forms)" → `book.html?to=mdm-wrong-wrong` / `?to=lujin`.
- Below them, smaller joke cards: "Somewhere", "Eventually", "Back to FIA".
- A route map: FIA in the middle, solid OA lines to SIA, LIA and Scraggy House. Dashed Scraggy Airlines (SA) lines from SIA to Mdm Wrong-Wrong's and Lujin's. A dotted line between SIA and LIA labelled "coming soon (not soon)".
- Banner: *FLY SOMEWHERE. / EVENTUALLY*.

### 5.8 Contact (`contact.html`)

- Normal-looking form. On submit: *"Thank you. Your message has been placed with your baggage."*
- Client-side only. **No data is sent or stored.**

### 5.9 JOELMOBILE (`joelmobile.html`)

The JOELMOBILE is FIA's airport buggy that "helps" passengers get around the terminal. It is managed by **Joel Teh Yit Siang**, JOELMOBILE Operations Manager.

- **Page title:** **JOELMOBILE** in big letters, with this sentence directly below it:
  > *"I'm a joel!"*
- **Hero banner (under the title):** **NEED HELP? / the JOELMOBILE is coming / (eventually)**
- **Facade copy:** "Fast, friendly, free* door-to-gate service across FIA." Footnote: "*free to board. Getting off is a separate conversation."
- **Manager card:** photo placeholder (or an illustration), name **Joel Teh Yit Siang**, title "JOELMOBILE Operations Manager", and a quote from Joel (ask Joel to write his own).
- **Request a ride form:** Pick-up (Check-in Hall, Food Court, Toilets, Baggage Belt 7, Any Gate) → Drop-off (Gate FIA01–FIA12) → "Call the JOELMOBILE". After a short "Locating the JOELMOBILE…" spinner, show a random result:
  - "The JOELMOBILE is on its way. It is currently going the other way."
  - "You have arrived! At a gate. Not your gate, but a gate."
  - "The JOELMOBILE has stopped for snacks. Please hold."
  - "Joel says you are already at your gate. Joel is very confident."
  - "Ride complete. Your bags have taken a separate JOELMOBILE."
- **Live tracker:** a small buggy icon driving loops around the FIA terminal map, always just missing the gate it is heading to. Status text: "JOELMOBILE location: nearby (spiritually)".
- **Octmiles:** logged-in users earn **20 Octmiles per ride**, up to 3 rides a day (§7.2). Guests see "Log in to earn Octmiles for being helped."
- Respect `prefers-reduced-motion`: show the buggy parked instead of driving.

### 5.10 Book a Flight (`book.html`)

**You can only book a flight by filling in this form.** The Home search widget and the Destinations "Book now" buttons just open it with some fields filled in.

The form **follows Scraggy Airlines' booking form** (`Scraggy-airlines/book.html` + `js/book.js`, Scraggy DEVELOPMENT.md §7.2): the same six steps in the same order, fake, nothing charged, and **no card or payment fields at all**. The changes for Octee are listed in the table below.

- **Headline:** **BOOK A FLIGHT / we will try**
- A step indicator at the top ("Step 2 of 6"), with **Back** and **Next** buttons.

| Step (same as Scraggy) | Octee version |
|---|---|
| **1. Trip** | The form **asks three things, in this order**, in a highlighted box: **① Destination** ("Where are you going?"), **② Departure date** (the day you leave) and **③ Arrival date** (the day you fly back). Both dates are picked on the flight calendar (below). Underneath: **Departing from** (FIA by default; any of FIA, SIA, LIA, Scraggy House), **Passengers** (1–9) and a tick box **"One-way only (I'm not flying back)"**, which removes the arrival date. After a date is picked, the form lists that day's flights, like a real airline: direct, flights with a stop (stay on board) and connections (change planes); the passenger picks one for the departure and one for the flight back. Destinations marked "transfer via SIA (2 forms)" (Mdm Wrong-Wrong's, Lujin's) switch to the transfer booking below with 1 passenger. Missing answers: *"Pick your departure date on the calendar."* / *"Pick your arrival date (the day you fly back) on the calendar, or tick One-way."* If there's nothing that day: *"No flights that day. Not even eventually."* |
| **2. Aircraft** | Choose from the Octee fleet (Airbus 777, Boeing 330, Airbus 747, Boeing 380, same joke mix-up as Scraggy) or "Surprise me (we will pick the wrong one)". |
| **3. Class** | Octee Economy, Octee Business, or **Octee First** ("Economy with a curtain"). Octee First earns +50 Octmiles per leg. |
| **4. Passenger** | Name for each passenger (first one defaults to the username; a nickname is fine), seat preference (window, aisle, "somewhere"), snack preference (One Peanut · One Peanut (vegetarian) · One Peanut (served warm)), number of bags (0–3, *"We will lose them in a random order."*). |
| **5. Fun extras** | "Reason for travelling" (dropdown of joke options), ☐ JOELMOBILE pickup to my gate (optional), and **three tick boxes that must all be ticked** (below). |
| **6. Review and confirm** | Shows the whole trip, the Octmiles that will be earned, and **"Confirm (no money will be taken)"**. Payment is just *"Paid in peanuts."* |

#### Flight calendar (departure and arrival dates)

Dates are picked on **one calendar for both dates, like an airline app**. Passengers can't type a date.

- Clicking **Departure date** or **Arrival date** opens the calendar. At the top are two tabs, **Departure Date** and **Arrival Date**, each showing the month, weekday and a big day number once picked.
- Months are stacked and scroll (weeks start on Sunday). Tap the **departure day**, then the **arrival day** (the day you fly back). The two days are filled orange with a little arrow shape, and the **days in between are shaded** light orange.
- A big orange **Done** button at the bottom saves both dates. × closes without saving.
- Each day shows, in small text, the first flight that day (e.g. `OA 107`). Days with **no flight** on that route (or no seats) are greyed out and can't be picked; so are past days. Bookings open up to 11 months ahead.
- **Stops and connections:** a day can be picked if **at least one** way to get there works that day (direct, a flight with a stop, or changes of plane with 45+ minutes each), on Octee, One United or Scraggy flights.
- **Arrival date:** only days on or after the departure day that have a flight back; same-day only if the flight back leaves at least 90 minutes after landing (*"time to look for your bags"*). One-way trips only pick a departure date.
- After **Done**, the form lists that day's flights for the departure and for the flight back, and a summary:
  > **Departure:** Tue 6 Oct 2026 · **OA 107** FIA 09:00 → LIA 11:30
  > **Arrival (flight back):** Wed 7 Oct 2026 · **OA 109** LIA 07:10 → FIA 09:40
- **Keyboard:** arrow keys move between days (skipping days with no flight), Enter picks, Esc closes. Each day has a full label like "Tuesday 6 October 2026, departure date".
- Built as `js/calendar.js` (`openRangeCalendar`).
- **Keyboard:** arrow keys move between days, Page Up / Page Down change month, Enter picks, Esc closes. Follow the WAI-ARIA "date picker dialog" pattern (`role="dialog"`, grid of days, `aria-selected`, each day has a full label like "Tuesday 6 October 2026, OA 107 at 09:00").
- Built once as `js/calendar.js` and reused by the Home widget and the booking form. The flight days come from `js/destinations.js`.

**Required tick boxes (step 5)** — all three must be ticked:

- ☐ **I accept Octee to be CEO**
- ☐ **I accept that the engines MAY be working**
- ☐ **FIA and SIA are not responsible for loss of luggage**

If one is missing: *"Please tick all three. We need it in writing."*

#### Every page must be filled in before Confirm

This is the main change from Scraggy:

- The **Confirm** button stays **disabled** until **all six steps are complete and valid**, including all three tick boxes.
- The step indicator shows ✓ on each finished step and ✗ on any step that still has a problem. Users can't skip ahead to a step until the steps before it are done.
- If a user goes **Back** and changes something so a step is no longer valid, its ✓ turns back into ✗ and Confirm is disabled again.
- Step 6 lists anything still missing, with links back to that step, e.g. *"Step 4: number of bags is missing."*
- When Confirm is pressed, every step is checked again (including all three tick boxes); if anything is missing, nothing is booked.

#### Transfer bookings: two forms (Octee form + SIA form)

When the destination is a Scraggy Airlines place (Mdm Wrong-Wrong's, Lujin's, or Scraggy House "via SIA"), the user fills in **two forms, one after the other**:

| | Form 1: **Octee form** | Form 2: **SIA form** |
|---|---|---|
| Airline | Octee Airlines (OA) | Scraggy Airlines (SA), based at SIA |
| Flight | The OA flight(s) that get the passenger to SIA (e.g. OA 58 from FIA, OA 101 from LIA), and back from SIA if return | SIA → destination (SA103 / SA105 / SA101), and back to SIA (SA104 / SA106 / SA102) if return |
| Form | Octee's 6-step form above, with the OA part of the trip and 1 passenger | **Scraggy's own 6-step form**: same steps, fields, wording, options and rules as `Scraggy-airlines/book.html` |
| Look | Octee style | Scraggy style, with "Operated by Scraggy Airlines" and the Scraggy logo |
| Tick boxes | Octee's three (I accept Octee to be CEO, engines MAY be working, FIA and SIA not responsible for loss of luggage) | Scraggy's two: "I accept that Scraggy is the CEO." and "I accept that we may go somewhere else eventually." |
| Rewards | Octmiles | Scraggy Points (on Scraggy's side; see below) |

A banner across the top shows the progress: **① Octee form → ② SIA form (Scraggy) → ③ Confirm both**.

**The SIA form must match the real Scraggy flights.** Don't copy Scraggy's options by hand. Load them from Scraggy's own data file, so if Scraggy changes something, Octee changes too:

```js
// js/scraggy.js — loads Scraggy's real js/data.js from CONFIG.SCRAGGY_SITE_URL
// (both sites are on zengyixin0205.github.io, so it's the same website origin).
// If it can't load, or the live version has no flight times yet, it uses js/scraggy-data-snapshot.js
// (a copy of Scraggy's js/data.js). The Destinations page says which one is in use.
```

So the SIA form offers exactly Scraggy's: Airbus 777 / Boeing 330 / Airbus 747 / Boeing 380 / "Surprise me"; Scraggy Economy / Business / First / Scraggy Class; Scraggy's snacks (Scraggyton food only in Scraggy Class); seat Window / Aisle / Somewhere; bags 0–5 ("Bags will be lost in 1 to 5 places."); Scraggy's reasons for travelling; and Scraggy's gates SCG001–SCG003 and `SCRAG-####` booking references.

**Rules that join the two forms:**

- **Same passenger:** the passenger name from the Octee form is copied into the SIA form and locked.
- **Times must connect:** the SA flight must leave SIA **at least 45 minutes after** the Octee flight lands there (e.g. OA 101 lands 09:34 → SA103 at 10:30 ✓). On the way back, the SA flight must land at SIA at least 45 minutes before the Octee flight home leaves. Times come from the timetable (§2) and Scraggy's `data.js`.
- **Route must be real:** the SIA form's route is fixed to SIA → the chosen destination and checked with Scraggy's `planLegs()`.
- **Confirm both at once:** the **Confirm** button only appears after **both** forms are fully filled in (every step, every required tick box). It books all the legs together; if anything in either form is wrong, nothing is booked.
- Going back to the Octee form and changing the date re-checks the SIA form, and Confirm locks again if the dates no longer connect.

**After confirming a transfer**, show one itinerary with every boarding pass in order: OA 58 (Octee style, gate FIA01–FIA12, `OCT-####`) → change at SIA → SA103 (Scraggy style, gate SCG002, `SCRAG-####`), then the return legs. Octmiles are earned on the OA legs only; the SA legs show *"Scraggy Points are collected with Scraggy Airlines."*

**Saving the SA legs:** everything is saved together as one booking in the passenger's Octee account in D1 (Octee ref `OCT-####` + Scraggy ref `SCRAG-####`). It does not appear in the Scraggy site's own account unless that service later exposes a secure integration API.

**After confirming** (same as Scraggy), show a fake **boarding pass** for each leg (two for a return trip):

- Flight number and times from the timetable in §2 for the chosen day (e.g. `OA 58` to SIA, `OA 103` back on a Thursday)
- Depart and arrive date and time for each leg
- Passenger name(s), date, aircraft, class, seat preference, gate (`FIA01`–`FIA12`) and a booking reference like `OCT-4821`
- Octmiles earned, and a link "Call the JOELMOBILE to this gate"
- The trip also appears in **My Trips** on `account.html`.

**Guests** can fill in the whole form, but at step 6 they're asked to log in or sign up to confirm. Their answers are saved in `sessionStorage` and restored after login (`login.html?next=book.html`), so nothing is lost.

Use plain HTML form elements with real `<label>`s, `<fieldset>`/`<legend>` for each step, and error messages linked with `aria-describedby`. A disabled Confirm button gets a visible note saying why ("Finish steps 2 and 5 first").

### 5.11 Reviews (`reviews.html`)

> Reviews are stored in D1 and are visible to every visitor after submission. They are not published by editing a JSON file or by committing user content.


Passengers can read reviews and write their own.

- **Headline:** **PASSENGER REVIEWS / we read them (eventually)**
- **Facade rating:** a huge **"4.9 ★\*"** at the top. Footnote: *"\*rounded up, a lot."* Right under it, in small print, the **real** average worked out from the actual reviews (e.g. "Actual average: 2.3 ★ from 41 reviews").
- **Featured reviews:** 4–5★ reviews in big glossy cards at the top.
- **"Reviews currently lost with your baggage":** 1–3★ reviews sit in a collapsed section with that title. Clicking it opens them. Nothing is hidden for real; they're just "misplaced".
- **Filters:** All · 5★ · 4★ · 3★ · 2★ · 1★, and sort by Newest / Highest / Lowest.
- Each review shows: username, stars, title, text, date, the route flown (if picked), and a **"Verified Octee flyer ✈"** badge if the user has at least one booked trip.

**Write a review** (logged-in users only; guests see "Log in to write a review"):

| Field | Rules |
|---|---|
| Star rating (1–5) | Required. 5 stars are pre-selected "for your convenience" (the user can change it). |
| Which flight? | Optional dropdown of the user's own trips |
| Title | Required, up to 60 characters |
| Review | Required, 20–500 characters, with a live character counter |
| ☐ "This review is about Octee, not my bag" | Required tick box |

- **One review per user.** They can edit or delete their own review.
- Writing your **first** review earns **30 Octmiles** (once only).
- **Safety:** reviews are shown as plain text only (set with `textContent`, never `innerHTML`), so nobody can inject code. Length limits are checked before saving.
- After posting: *"Thank you! Your review has been placed in the queue. The queue is also delayed."* (then it appears straight away).
- **Empty state** (no reviews yet): *"No reviews yet. Everyone is still waiting to land."*

### 5.12 Destination search

A search box where visitors type where they want to go. It's at the top of `destinations.html` and in the Home hero.

- **Placeholder:** *"Where do you want to go? (We may take you there.)"*
- **Suggestions while typing:** a dropdown under the box that updates on every key press. Arrow keys move, Enter picks, Esc closes.
- **Forgiving matching:** ignore capitals, spaces, dashes and apostrophes, and match on names, codes and nicknames. For example `mdm wrong wrong`, `wrong-wrong`, `mdm wrong wrong house`, `lujin`, `scraggy house`, `SIA`, `scraggy international`, `lu pin`, `LIA` all work. (Scraggy's `data.js` has a similar `normalize` helper.)
- A small **"Flying from"** dropdown next to the box (FIA by default; also SIA, LIA, Scraggy House). Searching from SIA to LIA shows every way to get there, e.g. *"OA 100 / OA 102 · SIA → LIA direct (these flights started at FIA) · Mon, Thu / Wed, Sat"*.
- The page URL updates to `destinations.html?q=…&from=…` so a search can be shared or bookmarked.

#### Four kinds of result

**1. Direct flight** (Octee flies there: SIA, LIA, Scraggy House)

> ✈ **Direct flight** to Scraggy House · flies **Tue, Thu, Sat**
> Next flights: **OA 111** Tue 6 Oct 11:15 → 13:05 · **OA 117** Thu 8 Oct 10:00 → 11:50 · **OA 112** Sat 10 Oct 08:00 → 09:50
> Back to FIA: OA 113 (Wed), OA 118 (Thu), OA 114 (Sun)
> Earn 250 Octmiles per leg · **[Book this flight]** → `book.html?to=SCH`

**2. Transfer flight** (Octee doesn't fly there, but Scraggy Airlines does from SIA: Mdm Wrong-Wrong's, Lujin's)

> 🔁 **Transfer flight** — Octee Airlines does not fly to Mdm Wrong-Wrong's.
> **OA 58** FIA → SIA · every day · 07:30 → 09:20 (Octee Airlines)
> ⏱ Change planes at **Scraggy International Airport (SIA)** · 70 minutes *(or 3 days)*
> **SA103** SIA 10:30 → Mdm Wrong-Wrong's 11:20 · gate SCG002 (operated by Scraggy Airlines, based at SIA)
> *Also from LIA (Tue, Fri): OA 101 lands at SIA 09:34 → same SA103.*
> Return: SA104 → SIA 12:30, then an OA flight home that day (e.g. OA 104 Mon 13:30, OA 103 Thu/Sun 15:10)
> **[Book transfer (2 forms)]** → `book.html?to=mdm-wrong-wrong` · *Octmiles are only earned on the OA flight.*

Show the two legs as a little timeline (plane icon → transfer dot at SIA → plane icon), with the SA leg in a different colour and marked "Partner: Scraggy Airlines". Both legs are booked from the Octee site using the two forms (FIA form, then SIA form), see §5.10.

For **Scraggy House**, show the direct OA flights first, then underneath: *"Also possible any day: OA 58 to SIA, then SA101 to Scraggy House (if you enjoy airports)."*

Dates in "Next flights" are worked out from today and the timetable, and clicking one opens the booking form with that date already picked.

**3. FIA itself:** *"You are already at FIA. Probably. Try asking the JOELMOBILE."* (links to `joelmobile.html`)

**4. Not found:** *"No flights to "xyz". Not even eventually."* followed by "Places we (sort of) fly to:" with all destinations as buttons.

#### Data (`js/destinations.js`)

D1 is the source of truth for the search, Destinations cards, booking form, status board and calendar. The Worker loads the airports and scheduled flights from D1, expands each multi-stop flight into bookable stretches, reads shared date/segment inventory, and finds direct, through-stop and up-to-two-connection journeys with at least 45 minutes between flights. New or changed schedules are reviewed SQL migrations, not browser data.
- `matchPlace(query)` — the forgiving search ("mdm wrong wrong", "lu pin", "SIA" …).

Search order: OA direct match first, then partner (transfer) match, then FIA, then not found. The search runs fully in the browser; no account needed.

**Accessibility:** a real `<label>` (can be visually hidden), `role="combobox"` with `aria-expanded` and `aria-activedescendant` on the input, suggestions in a `role="listbox"`, and the results area as `aria-live="polite"` so screen readers hear "1 transfer flight found".

---

## 6. Visual Design

### Logo

- File: `assets/img/octee-logo.svg` (PNG version: `assets/img/octee-logo.png`).
- Based on the original hand drawing, in the same thin pen line (no font):
  - **Kept as drawn:** the creature and the "s" of Airlines.
  - **Straightened:** the "o" is a perfect circle, and the other letters (c, t, first e, A, i, r, l, i, n, e) are redrawn with straight, even strokes. The first "e" of "ee" is a regular "e" with no line coming out.
  - **Baselines:** every letter in "octee" sits on one straight line, and every letter in "Airlines" sits on another.
  - **Same height:** "Airlines" uses the same letter heights as "octee" (same x-height for small letters; A and l the same height as o and t). The hand-drawn "s" is scaled down evenly to match.
  - **"s" line:** a perfectly straight, flat (180°) line runs from the bottom of the "s" back to the "l", sitting just below the baseline.
  - **Last "e" of octee:** drawn the same as the "e" before it (same size and shape). Its bottom stroke carries on into a straight line along the baseline, the same thickness from start to end, and **ending right above the "s"** of Airlines.
  - **Even spacing:** "Airlines" has the same gap between every pair of letters. "octee" is spaced to **look the same as "Airlines"**: the average white space between each pair of its letters matches Airlines' average, and no two letters get closer than a set minimum (so the "c" never touches the "t").
- Don't swap the letters for a font or redraw the kept parts.
- Use the SVG everywhere (it stays sharp at any size). Minimum width: 140px. Always on a light background, or swap the fill to white on dark.
- Favicon: crop the creature only.
- Transparent PNG, so it works on any light background.

### Brand: everything revolves around orange

| Token | Value | Use |
|---|---|---|
| `--octee-orange` | `#FF7A00` | Buttons, accents, selected things, the calendar's Done button |
| `--octee-orange-dark` | `#B34700` | Banners, the nav's current page, links |
| `--octee-orange-deep` | `#C25500` | Hover states, gradients |
| `--octee-ink` | `#2B1A0E` | Text, headings, dark panels (clock, footer) |
| `--octee-cream` | `#FFF3E6` | Page background |
| `--octee-white` | `#FFFFFF` | Cards |
| `--mess-red` | `#C03A3A` | DELAYED, errors, cracks in the facade |
| `--mess-gray` | `#6B7280` | Tiny footnotes |

- Hero banners: a dark-brown to orange gradient with white text. Buttons: orange with dark brown text (readable contrast).
- **Airline liveries** (tags, flight lists, boarding passes, banners): **Octee Airlines (OA) = orange** `#FF7A00`, **One United (OU) = light blue** `#A8DCF7`, **Scraggy Airlines (SA) = light yellow** `#FFF1A8`, each with dark text for contrast. Tokens `--oa`, `--ou`, `--sa` in `src/client/styles.css`.
- **Headings:** elegant serif (*Playfair Display*). **Body:** *Inter*. **Departures board:** *JetBrains Mono*, yellow on black.

### Comedy details (use sparingly)

- One nav item 2px lower than the others.
- Logo plane icon slightly tilted.
- "Loading…" states that are a little too long.
- Footnotes (`*`) that undercut every bold claim.
- Hover on "Book Now" button: it shifts slightly away the first time only.

Keep the site usable. The mess is the joke, not actual broken UX.

---

## 7. Accounts, Octmiles, Codes & the Control Tower (Cloudflare D1)

The Worker is the trusted application server and D1 is the shared source of truth. Never trust a balance, seat count, role, or booking supplied by the browser. Browser storage may hold only non-sensitive preferences and an unconfirmed booking draft.

| What | Where it lives | Who sees it |
|---|---|---|
| User accounts and password hashes | D1 `users` | Server only; passwords are never stored |
| Login sessions | D1 `sessions` (hashed random token) + HttpOnly cookie | The signed-in browser; session tokens are not readable by page scripts |
| Bookings and boarding-pass references | D1 `bookings` and `booking_legs` | The owner and authorized staff |
| Seat availability | D1 `seat_inventory`, per date and flight segment | Shared by all visitors |
| Octmiles balances and history | D1 `miles_ledger` | The account owner; balance changes are server-side |
| Reviews | D1 `reviews` | Everyone can read; account owner can edit/delete their own |
| Octmiles codes and redemption limits | D1 `redemption_codes` and `redemptions` | Codes are checked server-side and never returned in public responses |
| Control Tower admins | D1 `users.role`; optional server-side setup secret | Admin routes only; never exposed as a public JSON file |
| Airports, routes and weekly schedules | D1 `airports` and `flights` | Public read API |
| Baggage requests | D1 `baggage_requests` | Requester and staff; the tracking gag stays fictional |

Use parameterized D1 queries, validate every input on the server, enforce ownership checks, and use database transactions/batches for multi-segment reservations and ledger changes. Store only salted PBKDF2-SHA256 password hashes (150,000 rounds) and hashed random session tokens. The fake baggage-tracker discards the supplied tag and does not write baggage queries to D1. Set session cookies `HttpOnly`, `Secure` in production, `SameSite=Lax`, and expire/revoke them server-side. Never put secrets or password hashes in public API responses.

**Honest limits (by design, it's a joke application):**

- Accounts, bookings, seat inventory, reviews, and Octmiles are shared across devices because they live in D1.
- The airline, flights, points, prizes, and payment-free booking are fictional. Do not collect payment details or claim a booking is a real ticket.
- The contact form can remain a client-side gag and must say that it does not send a message.
- Do not add analytics or sell passenger data. Store only the information required for the features the visitor chooses to use.

### 7.1 Accounts (`login.html`, `account.html`, Worker auth API)

1. **Log in / Sign up** tabs. Headline: **WHO ARE YOU? / we also forgot**.
2. **Sign up:** username (3–20 letters, numbers, underscores; unique, not case-sensitive), password (8+ characters), confirm password. Welcome bonus: **100 Octmiles**.
3. **Passwords are never stored:** only a salted **PBKDF2-SHA256** hash (150,000 rounds, Web Crypto), same idea as Scraggy's demo mode.
4. After login the visitor returns to the page they came from (`login.html?next=book.html`, only Octee page names allowed).
5. The header shows **"Hi, username · 1,250 Octmiles · Gold Wing · Have a code? · Log out"**.
6. **My Account** (`account.html`): username, member since, Octmiles, tier, **My Trips** (each trip opens to show its boarding passes) and "Delete my account and associated data" (press twice).
7. The login page says plainly: *"Your account is stored by Octee so it works across your devices. This is a fictional airline; do not reuse an important password."*

| Situation | Message |
|---|---|
| Wrong username or password | "Wrong password. Or wrong username. We lose track of things." |
| Username taken | "That username is taken. Someone boarded first." |
| Password too short | "Password too short. Like our legroom." |
| Passwords don't match | "Those passwords don't match. Neither do our timetables." |

### 7.2 Earning Octmiles and tiers (D1 `miles_ledger`)

| How | Octmiles |
|---|---|
| Sign up | 100 |
| Octee flights, per stretch flown | FIA ↔ SIA 150 · FIA ↔ LIA 200 · FIA ↔ Scraggy House 250 · SIA ↔ LIA 120 · SIA ↔ Scraggy House 80 |
| One United (OU) flights | Half the Octee rate for the same stretch |
| Octee First | +50 per flight |
| JOELMOBILE ride | 20 (max 3 a day) |
| First review | 30 (once) |
| Octmiles code | whatever the code is worth (once per code per account) |

- Scraggy Airlines flights earn no Octmiles ("Scraggy Points are collected with Scraggy Airlines").
- At most **5 flights booked per day** per account: *"Sorry, you have flown too much today."*
- **Tiers use lifetime Octmiles** (only go up), so spending never drops a tier: Economy Peanut (0+), Silver Wing (500+), Gold Wing (2,000+), Platinum Wing (10,000+).

### 7.3 Rewards shop (`octmiles.html`, D1-backed)

A second peanut (250, always out of stock) · Priority JOELMOBILE pickup (300) · Bag tracking upgrade (500) · Window seat (800, window not included) · Engine check (1,500, once) · Name a gate at FIA (5,000, once; stored in D1 and shown on the FIA map) · Cockpit tour (10,000, once). Spending takes from the balance only. Unaffordable rewards are greyed out with *"You need 120 more Octmiles."* The page says: "Octmiles and rewards have no real-world value."

### 7.4 Octmiles codes ("Have a code?" box, D1-backed)

- On `octmiles.html` and as a pop-up from **Have a code?** in the header. Logged-in only.
- Codes ignore capitals and spaces (`octee 500` = `OCTEE500`).
- **How code redemption works:** the browser submits the code over HTTPS; the Worker normalizes it, checks a server-side hash in D1, enforces expiry and one-use-per-account rules, then writes the redemption and Octmiles ledger entry atomically. The raw code and hashes are never included in public responses.
- Each code: `octmiles` (1–5,000), optional `expires` date, `active` on/off, optional `note`.
- Once per code **per account**, enforced by D1. Admins may also set an optional global maximum-use count in D1.
- At most **10 wrong codes per hour** per account.
- Messages: *"+500 Octmiles! Please don't spend them all on one peanut."* · *"That code is not real. Like our on-time record."* · *"You already used this code. Nice try."* · *"This code has expired. Like your boarding pass."* · *"This code has been grounded."* · *"Too many wrong codes. Please wait an hour and think about what you've done."*
- Seed one welcome code only if desired: **`OCTEE500`** (500 Octmiles). Store its hash in D1 and allow admins to disable it in the Control Tower.

### 7.5 The Control Tower (server-authorized administration)

- **Opening it:** click the Octee logo **8 times within 4 seconds** on any page. (A single click still goes Home.)
- **Who gets in:** authenticated users whose D1 `users.role` is `owner` or `admin`. Check the role on every admin API request; hiding the page is not authorization. Wrong password: *"The cockpit door is locked. The pilot is also locked out."* Add server-side login throttling.
- **First owner:** bootstrap with a one-time secret stored as a Cloudflare Worker secret (`ADMIN_SETUP_TOKEN`). Never accept an unauthenticated public owner claim and never check this secret into GitHub. Remove/rotate it after the first owner is created.
- **Codes tab:** authorized admins can create a code (type one or press **Random**, e.g. `OCT-7K2P`), set Octmiles (1–5,000), expiry and note, disable or delete it. Show the plain code once only; store only a keyed hash in D1.
- **Admins tab (owner only):** the owner can grant/revoke admin roles through the protected API. Do not download or commit credential files.
- The Control Tower changes D1 immediately. Audit role and code changes without logging secrets or raw codes.
- Unsaved form drafts can remain in that browser; confirmed changes are server-side and visible after a fresh sign-in.

### 7.6 Reusing Scraggy's code

| Scraggy file | Used in Octee as |
|---|---|
| Scraggy Airlines public schedule/API | Import only the partner-flight fields required for transfer search into D1 through a controlled sync; keep the source attribution and last-sync time. Do not trust browser-supplied partner flight data at booking time. |
| Scraggy Airlines booking/auth backend | Not shared. Octee stores its own transfer itinerary and clearly marks SA legs as partner-operated; do not copy Scraggy credentials or claim cross-airline booking confirmation unless a real partner API is authorized. |
| Scraggy booking flow | Reuse the six-step user experience and accessibility requirements (§5.10), but confirm Octee bookings through Octee's Worker API and D1. |
| `js/clock.js` | Side clock, with FIA added (§5.0); clocks are presentation only and never drive seat or booking logic. |

### 7.7 Accessibility

- Real `<label>`s everywhere; `autocomplete="username"`, `"current-password"`, `"new-password"`; "Show password" toggles.
- Messages use `role="status"` / `aria-live="polite"`; booking errors use `role="alert"`.
- The flight calendar follows the WAI-ARIA date picker dialog pattern (arrow keys, Enter, Esc; full labels like "Tuesday 6 October 2026, departure date").
- The destination search is a combobox (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, `role="listbox"`).
- `prefers-reduced-motion`: no tagline rotation animation, no button dodge, the JOELMOBILE stays parked.
- All user text (names, reviews) is set with `textContent`, never `innerHTML`.

---

## 8. Tech Stack & Structure

- **Frontend:** React + TypeScript SPA with React Router for client-side navigation. Use semantic components and call the same-origin `/api/*` endpoints for all shared or account-specific data.
- **Styling:** Tailwind CSS v4 with shared brand tokens in the Tailwind theme. Keep component markup accessible and mobile-first; use custom CSS only for branded details that utilities do not express cleanly.
- **Build and local development:** Node.js 24 for local tooling and CI, Vite for builds and hot reload, and `@cloudflare/vite-plugin` so local Worker/API development runs in Cloudflare's Workers runtime. Node.js is not the production server runtime.
- **Runtime and API:** Cloudflare Workers. The Worker owns authentication, authorization, validation, business rules and the JSON API. Enable Node.js compatibility only if a chosen dependency requires a supported Node API.
- **Database:** Cloudflare D1 (SQLite) through the `DB` binding. Database schema changes are numbered SQL migrations under `migrations/`; use parameterized SQL and D1 bindings.
- **Asset hosting:** Vite-built browser assets are deployed with the Worker. This is a dynamic Worker-backed application; the assets are only the UI delivery format. Do not deploy the product to GitHub Pages or make browser storage the source of truth.
- **Deploy:** GitHub Actions deploys Worker code with Wrangler after applying D1 migrations. The account token needs D1 Edit for migrations and Workers Editor for the Worker, and must belong to the account that owns the database.
- **Fonts:** system font stack by default; optional Google Fonts must degrade gracefully and may be omitted for privacy/offline use.
- **Run locally:** `npm ci`, apply migrations to the local D1 database, then `npm run dev` for Vite and the local Worker runtime.

### Current implementation

The application is implemented in React and TypeScript, with the API running in a TypeScript Worker. Keep the same-origin API and D1 contracts stable as the product grows. Do not describe the app as a static website: React assets are deployed alongside a Worker that serves dynamic, database-backed routes.

```text
octee-airlines/
├── src/
│   ├── client/
│   │   ├── main.tsx        React entry point
│   │   ├── App.tsx          Shared application shell and routes
│   │   ├── components/     Reusable accessible UI
│   │   └── styles.css      Tailwind entry point and brand theme
│   ├── worker/
│   │   └── index.ts        Worker routes, validation, auth and D1 services
│   │   ├── types.ts         Typed API and domain contracts
│   │   └── lib/api.ts       Same-origin API client
├── migrations/
│   ├── 0001_initial.sql   D1 schema and airport/flight seed data
│   ├── 0002_auth_attempts.sql
│   └── 0003_booking_idempotency.sql
├── index.html              Vite browser entry document
├── .github/workflows/deploy.yml
├── vite.config.ts          Vite + Cloudflare Workers integration
├── wrangler.jsonc          Worker and D1 binding configuration
├── package.json
└── DEVELOPMENT.md         Single development plan (this file)
```

### D1 tables and Worker API

The current migrations create `airports`, `flights`, `users`, `sessions`, `auth_attempts`, `bookings`, `booking_legs`, `seat_inventory`, `miles_ledger`, `reviews`, `redemption_codes`, `redemptions`, `baggage_requests`, and `admin_audit`. Keep account IDs and tokens out of responses. Use prepared statements for every value and enforce ownership checks in the Worker.

Implemented same-origin endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Worker + D1 readiness |
| `GET /api/airports` | Airport list and search aliases |
| `GET /api/flights?from=FIA&to=SIA&date=YYYY-MM-DD&passengers=1` | Schedule search, connections and shared remaining seats |
| `GET /api/status?date=YYYY-MM-DD` | FIA departure board |
| `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me` | Account and session lifecycle |
| `GET /api/bookings`, `POST /api/bookings` | Authenticated trips and atomic seat reservations |
| `GET /api/reviews`, `POST /api/reviews`, `PATCH/DELETE /api/reviews/:id` | Public reviews and owner edits |
| `POST /api/baggage` | Fictional tracking result; submitted bag tag is discarded |

Rewards redemption, admin/Control Tower, round-trip/transfer booking, account deletion, and remaining content pages are planned follow-up endpoints. Do not show a UI control for a backend operation until its server-side authorization and validation are implemented.

### Tagline data (typed model example)

```ts
// Each line is a separate entry. `punch: true` = punchline styling; `size: "small"` = tiny text.
type Tagline = { id: string; lines: { text: string; punch?: boolean; size?: "small" }[] };

export const FIA_TAGLINES: Tagline[] = [
  { id: "fly",     lines: [{ text: "FLY SOMEWHERE." }, { text: "EVENTUALLY", punch: true }] },
  { id: "lost",    lines: [{ text: "LOST? we will make you more lost", punch: true }] },
  { id: "bags",    lines: [{ text: "YOUR BAGS" }, { text: "our mystery", punch: true }] },
  { id: "takeoff", lines: [{ text: "\"are we taking off yet\"" }, { text: "Are the engines working?", punch: true }] },
  { id: "think",   lines: [{ text: "THINK" }, { text: "before you" }, { text: "say", punch: true }] },
  { id: "sophisticated", lines: [
      { text: "becoming sophisticated" }, { text: "is impossible" },
      { text: "at least on this flight", punch: true, size: "small" } ] },
  { id: "peanut",  lines: [{ text: "Peanut? Peanut?" }, { text: "ONE PEANUT", punch: true }] },
];
```

### Deploying to Cloudflare Workers

1. Push source changes to `main` in [`zengbo0710/octee-airlines`](https://github.com/zengbo0710/octee-airlines).
2. GitHub Actions installs locked dependencies, type-checks and builds the React app with Vite, applies pending D1 migrations to `octee-airlines-db`, then deploys the Worker and frontend assets with Wrangler.
3. Repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` provide deployment credentials. The account token needs D1 Edit to apply migrations and Workers Editor for the Worker; scope it to the Octee resources where Cloudflare permits, and use the account ID that owns the D1 database.
4. The production app is `https://octee-airlines.octee.workers.dev`. GitHub Pages is not used.
5. A push does not change Cloudflare data except through an explicit reviewed migration. Never delete or recreate the production D1 database to fix a schema problem.
6. Confirm the Actions deployment is green and verify `/health` and the live app after deploy. Roll back application code through Worker version history; handle database rollback with a new forward migration or a verified D1 restore.

---

## 9. Coding Conventions

- Semantic HTML (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`); every page shares the header/footer and app shell components.
- Type React components, API payloads, and domain models in TypeScript; keep API/domain contracts in `src/client/types.ts` and Worker-specific environment types with the Worker.
- Define brand colours and typography in the Tailwind theme in `src/client/styles.css`.
- Mobile-first, works down to 360px wide with no sideways scrolling.
- Never render user text as raw HTML; render user-provided content through React's escaped text rendering.
- Keep API requests same-origin and typed; server validation and authorization remain authoritative.
- Use D1 for shared application state. Restrict browser storage to non-sensitive preferences and short-lived unconfirmed form drafts; never trust it for authorization, bookings, seat counts, or Octmiles.
- No secrets in the repo: only hashes. No tracking, no external data collection.
- Commit messages: `feat:`, `fix:`, `style:`, `docs:`.

---

## 10. Milestones

| # | Milestone | Status |
|---|---|---|
| M1 | Cloudflare Worker shell, D1 schema, timetable and CI migration/deploy pipeline | Implemented locally; production migration/deploy pending |
| M2 | React + TypeScript + React Router UI, Tailwind/Vite integration, accessible shared shell, clocks, tagline rotator and airline brand themes | Implemented; continue refining page layouts and accessibility |
| M3 | Home flight search and destination selector | Core search implemented |
| M4 | D1 timetable, multi-stop search, connection planner and shared seat inventory | Search and inventory implemented; full destination UX planned |
| M5 | Six-step booking flow, atomic D1 reservation and boarding passes | Basic one-way booking implemented; return trips and six-step progression planned |
| M6 | Account signup/login, secure sessions, account and My Trips | Signup, login, sessions and trip list implemented; account management planned |
| M7 | Octmiles ledger, tiers, rewards and server-side code redemption | Signup/flight/review earn implemented; shop and code administration planned |
| M8 | Flight status, baggage tracker, experience, about and FIA pages | Status and baggage implemented; remaining pages planned |
| M9 | One United and Scraggy partner-flight integration | Schedules searchable; booking integration planned |
| M10 | JOELMOBILE page and ride rewards | Ride reward marker implemented; full ride flow planned |
| M11 | D1-backed reviews and moderation | Public reviews and account-owned write/edit/delete APIs implemented; moderation planned |
| M12 | Server-authorized Control Tower | Planned |
| M13 | Accessibility, security, mobile and reduced-motion acceptance | Initial responsive/accessibility work implemented; full review planned |
| M14 | Push stack changes to GitHub `main`, successful Actions deployment and Cloudflare production verification | Pending |

---

## 11. Acceptance Checklist

These are target criteria for the complete application. The checked-in code implements the React UI, dynamic Worker/D1 core and first booking flow; unchecked items remain planned.

- [ ] All 7 FIA taglines appear with the exact line breaks in §3; "at least on this flight" is small
- [ ] FAG → FIA → Octee shown on About and in the footer
- [ ] Every "facade" claim on Home has an undercutting footnote
- [ ] Flight Status shows today's flights from the timetable and never says "ON TIME"
- [ ] Bag tracker never finds the bag (stops at 99%)
- [ ] Only ever one peanut
- [ ] Logo matches §6
- [ ] Side clock on every page: Your time, FIA time, SIA time
- [ ] Octee flies OA 58 + OA 100–118 exactly as the timetable in §2, including flights with stops
- [ ] Trips can change planes at any airport (45 min minimum, max 2 changes), including OA → SA at SIA
- [ ] OA 58 from FIA and OA 101 from LIA both connect to the same SA103 at SIA (Tue/Fri)
- [ ] Flights can only be booked through the 6-step form; dates only via the flight calendar (no-flight days greyed out)
- [ ] Confirm stays disabled until every step (and every tick box) is done; going back and breaking a step locks it again
- [ ] Trips with Scraggy flights need the SIA form too; its options come from Scraggy's real `data.js`
- [ ] No card or payment fields anywhere
- [ ] Guests can fill the form, log in, and come back to Confirm with their answers kept
- [ ] Sign up / log in / log out work; passwords stored only as PBKDF2 hashes
- [ ] Octmiles, tiers (lifetime), rewards, daily limit work
- [ ] Reviews: 4.9★* facade **and** the real average; 1–3★ are in "lost with your baggage", not removed
- [ ] "Have a code?" is checked by the Worker against D1, once per code per account, with a 10-wrong-tries-per-hour limit
- [ ] 8 quick clicks on the logo open the Control Tower; protected admin APIs write codes/admin roles to D1
- [ ] The whole site revolves around orange (buttons, banners, calendar)
- [ ] One calendar picks the departure and arrival dates; the days between are shaded; Done saves
- [ ] ONE UNITED section ("unitation is a dream, it's chaos.") with OU 1–OU 8; OU flights connect with OA and SA and can be booked on the Octee form
- [ ] There is a way to and from Mdm Wrong-Wrong's and Lujin's every day (via OU or OA + SA)
- [ ] Works on phones (no sideways scroll) and with reduced motion
- [ ] Deployed to Cloudflare Workers with D1 migrations applied

- [ ] All shared application state is stored in Cloudflare D1; public user data is not stored in files committed to GitHub.
- [ ] Worker API validates inputs, authorizes each account/admin operation, hashes passwords and sessions, and uses parameterized SQL.
- [ ] Booking inventory is shared across visitors and multi-segment reservations are atomic.
- [ ] GitHub Actions applies reviewed D1 migrations before deploying the Worker; GitHub Pages is not enabled.
