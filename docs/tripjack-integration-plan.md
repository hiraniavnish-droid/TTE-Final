# TripJack Hotel API — Integration Plan for The Tourism Experts

Reference doc + build plan for wiring TripJack's live hotel inventory into the TTE CRM,
the WhatsApp bot, and (later) a public booking website. Read alongside the source docs:
- Hotels API v3: https://tripjack.com/page/api-doc (tab: "Hotels API")
- Flights API v2.0: same page, tab: "Flights API"

---

## 1. What TripJack actually is

TripJack is a **B2B travel API** (a "supplier aggregator") — it gives travel agencies
programmatic access to live hotel (and flight) inventory, rates, and booking, the same
category as the Interakt/Razorpay integrations already built into this CRM, just for
**inventory instead of messaging/payments**.

- **Not self-serve.** The `apikey` is issued by TripJack directly during partner
  onboarding — there's no signup form that instantly gives you a key. **This is the
  actual first step and nothing below can start without it.** Contact TripJack to get:
  1. A **UAT (sandbox/test) apikey** — free, for building and testing
  2. A **Production apikey** — issued after your integration is reviewed/approved
- Separate keys for UAT and Production; separate base URLs too (see below).
- Pricing model: TripJack returns **NET rates** for most options (`commercial.type: "NET"`)
  — meaning the price they quote is what *you* pay TripJack. **You decide your own
  sell price on top** (a markup, mirroring the discount engine already built for
  Rann Utsav, just inverted — add margin instead of subtracting a discount).

---

## 2. Hotels API v3 — the one that matters for this business

### Base URLs
| Purpose | UAT (test) | Production |
|---|---|---|
| Search / Pricing / Review | `apitest-hms.tripjack.com` | (prod equivalent — confirm with TripJack at go-live) |
| Book / Confirm / Cancel / Booking Details | `apitest-hotel-booker.tripjack.com` | (prod equivalent) |
| Nationalities / Static hotel data | `apitest.tripjack.com` | `tripjack.com` |

### Authentication
Every request needs one header:
```
apikey: <your_api_key>
Content-Type: application/json
```
That's it — no OAuth, no token refresh. **Never call TripJack from the browser** — the
key must live server-side only (same principle as the Razorpay/Interakt keys already in
this project), proxied through a Vercel API route.

### The booking funnel — 4 steps, always in this order
```
1. Listing   POST /hms/v3/hotel/listing   → search results + cheapest rate per hotel
2. Pricing   POST /hms/v3/hotel/pricing   → ALL rate options for one selected hotel
3. Review    POST /hms/v3/hotel/review    → re-validates price/availability right before booking
4. Book      POST /oms/v3/hotel/book      → commits the booking (instant or hold)
```
- `searchId`/session from step 1 is valid **~15 minutes** — prompt the user to re-search if expired.
- Step 3's result must be used to call step 4 **immediately** — prices/availability can shift between steps.
- **Instant booking**: include `paymentInfos` in the Book call → confirmed right away.
- **Hold booking**: omit `paymentInfos` → reserves the room until a deadline (`ddt`), then
  call `POST /oms/v3/hotel/confirm-book` with payment before it expires, or it auto-cancels.
  **This is the safer mode for a booking website** — you're not committed to paying
  TripJack until the customer has actually paid you.

### Sample: Listing request
```json
POST https://apitest-hms.tripjack.com/hms/v3/hotel/listing
{
  "checkIn": "2026-05-25",
  "checkOut": "2026-05-26",
  "rooms": [{ "adults": 2, "children": 2, "childAge": [3, 5] }],
  "currency": "INR",
  "correlationId": "<unique-id-per-request>",
  "nationality": "106",
  "hids": [100000224831, 100000363323]
}
```
- `hids` = specific TripJack hotel IDs. No general "city search" in v3 — you either
  pass known hotel IDs or use the Static Content / Hotel Mapping APIs to resolve a
  city/destination into a list of hotel IDs first.
- `nationality` is a TripJack country ID — fetch the list once from
  `GET /hms/v3/nationality-info` and cache it (India = `"106"`).
- Every price object follows: **`totalPrice = basePrice + taxes + mf + mft`**
  (management fee + its tax) — always show these as separate line items to the customer,
  matching how GST is broken out in the Rann Utsav quote builder already.

### Sample: pricing breakdown fields (same shape at Listing / Pricing / Review)
```
pricing.basePrice, pricing.taxes, pricing.mf, pricing.mft, pricing.totalPrice
pricing.strikethrough   → present only for commissionable rates, a "was" price for display
compliance.gstType, compliance.panRequired, compliance.passportRequired
cancellation.isRefundable, cancellation.penalties[] (dated penalty slabs, ⚠ times are IST)
```

### Booking status values (poll `POST /oms/v3/hotel/booking-details` every 5s, up to 180s)
| Status | Meaning |
|---|---|
| `IN_PROGRESS` / `PAYMENT_SUCCESS` / `PAYMENT_PENDING` / `PENDING` | still processing |
| `SUCCESS` | ✅ confirmed |
| `ON_HOLD` | ✅ hold confirmed — must `confirm-book` before `ddt` |
| `ABORTED` / `FAILED` | ✗ no charge, booking did not happen |
| `CANCELLATION_PENDING` | cancellation submitted, TripJack Ops processing offline — poll once/day |
| `CANCELLED` | done |

### Cancellation
```
POST https://apitest-hotel-booker.tripjack.com/oms/v3/hotel/cancel-booking/{bookingId}
```
No body needed — `bookingId` is in the URL. Cancellation charges apply per the policy
already shown to the customer at booking time.

### Error handling
All errors come back in one shape:
```json
{ "status": { "success": false }, "error": { "code": "...", "message": "...", "requestId": "..." } }
```
Key codes to handle explicitly: `SEARCH_SESSION_EXPIRED` (re-search), `OPTION_SOLD_OUT`
(send customer back to pick another option, never call Book after this),
`SUPPLIER_UNAVAILABLE` (retry with backoff: 1s → 2s → 4s, max 3), `RATE_LIMITED`
(respect `Retry-After` header).

### Static/catalogue data (cache these — they don't change with pricing)
- `POST /hms/v3/hotel/static-detail` — full hotel metadata: address, coordinates,
  images, amenities, room descriptions, policies. Cache **24 hours**.
- Hotel Mapping / Hotel Content / Countries / City-Region IDs — newer v3 catalogue-sync
  APIs (replace the deprecated `fetch-static-hotels`) — use these to build your own
  local "which hotel IDs exist in city X" lookup table, refreshed periodically (~weekly).

---

## 3. Flights API v2.0 — noted for later, not the priority

Same `apikey` auth pattern. UAT base `apitest.tripjack.com`, Prod base `tripjack.com`
(different subdomain convention than Hotels — don't mix them up). Flow: Search → Fare
Rule (optional) → Review → Book (instant/hold) → Confirm-Book (if hold) → Booking
Details. Post-booking ops: Cancellation, Void (same-day), Reissue, Ancillaries (seat/meal/baggage).
**Not building this now** — flagged here so it's not forgotten if a "full package"
(flight + hotel) booking flow is ever wanted.

---

## 4. The build plan — three phases, each independently useful

### Phase 1 — Staff rate lookup inside the CRM (build this first)
A new internal tool page, same pattern as the Rann Utsav Quotation Builder already in
this app: staff pick a destination/hotel, dates, and pax → CRM calls TripJack
server-side → shows live rates with cancellation terms → staff can copy/share the
quote to a lead over WhatsApp using the chat widget already built.

**What this needs:**
- `api/tripjack-hotel-search.ts` — proxies Listing, holds the apikey server-side
- `api/tripjack-hotel-detail.ts` — proxies Pricing (Detail) for a selected hotel
- A markup layer — apply your margin on top of TripJack's NET price before displaying
- A new CRM page (`pages/HotelRateFinder.tsx` or similar) — search form + results list
- A small "which hotel IDs exist in city X" lookup (built once from the Hotel Mapping /
  Static Content APIs, refreshed weekly) — since v3 Listing needs specific hotel IDs,
  not a free-text city search

**Value delivered:** staff stop manually checking rates elsewhere — instant, real,
bookable rates inside the CRM they already use. No payment/booking risk yet.

### Phase 2 — Customers get rates directly on WhatsApp
Extends the same Interakt workflow pattern already built for the Rann Utsav bot: a new
intent ("check hotel rates") that collects destination + dates + pax via chat, calls a
new `api/tripjack-quote.ts` (mirrors `api/rann-quote.ts`), and replies with the top
3–5 options and prices.

**Constraint to design around:** WhatsApp can't show thousands of hotels — needs either
a curated shortlist per destination, or asking the customer to name a specific hotel.

**Dependency:** this reuses the same account-level webhook we already built and is
currently blocked on your Interakt plan being a live (non-trial) Growth subscription —
see the WhatsApp integration notes elsewhere in this project. Outbound (bot replying
with rates) works regardless; only *unprompted* inbound sync is blocked.

### Phase 3 — Public booking website / landing page (the big one)
Real self-service booking: search → results → hotel detail page → guest details →
payment → confirmed booking. This is a genuinely large build, not an afternoon add-on —
budget it as its own project phase. It needs, on top of everything above:
- A public-facing search/results/detail UI (new pages, not gated behind CRM login)
- Guest checkout form (names, PAN/passport if flagged required by `compliance`)
- Payment collection **before** committing to TripJack — recommend using **Hold
  Booking**: reserve with TripJack first (no money owed yet), collect payment via the
  Razorpay integration already built, then call `confirm-book`. This avoids ever being
  on the hook to TripJack before the customer has actually paid.
- Booking-status polling + confirmation email/WhatsApp
- Post-booking self-service (view booking, cancel) using Booking Details + Cancellation

---

## 5. Suggested order of operations
1. **Contact TripJack now** to start the partner onboarding process — this is the
   critical-path blocker; everything else can be designed while it's in progress.
2. Once a **UAT apikey** arrives, build and fully test Phase 1 against the sandbox.
3. Get the **Nationalities** + a starter **Hotel Mapping** list for your key
   destinations (Kutch/Dhordo, Gujarat, wherever else you sell) so Listing calls have
   real hotel IDs to search.
4. Ship Phase 1 to staff, live on production keys once TripJack approves them.
5. Only then move to Phase 2 (WhatsApp) and Phase 3 (public site) — each is a clean,
   separable next step once the server-side proxy + markup logic from Phase 1 already exists.
