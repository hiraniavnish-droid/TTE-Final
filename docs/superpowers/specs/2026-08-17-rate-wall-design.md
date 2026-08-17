# Rate Wall — fast interactive rate finder

Date: 2026-08-17
Status: approved, not yet implemented
Applies to: `pages/RajarshiBuilder.tsx` (build first), then `pages/InlandBuilder.tsx`

## Problem

The team quotes hotels while the customer is on the phone. Today that means
opening a supplier page, picking a city, picking a hotel, picking a room,
picking a rate column, reading a number, then repeating the whole sequence for
every alternative the customer asks about. Comparing five hotels means five
passes through a form.

What the agent actually needs is: type the dates and pax once, see every option
priced instantly, tick the ones worth sending, and share. Package building is
secondary and already exists.

## Goals

- Enter dates, nights, pax, rooms, meal plan once — every hotel in the city
  reprices instantly, with no search button.
- Hotels grouped into price bands derived from the actual results, not from
  star ratings.
- Each hotel is a compact card: name, star, and one row per room type.
- Multi-select rows across hotels and bands, then export.
- On screen the agent sees everything (net, markup, margin, selling). Every
  export is client-facing only.

## Non-goals

- Merging the two suppliers into one view. Each supplier keeps its own page
  with its own logic; only the visual structure and interaction model are
  shared.
- Replacing `Build Package`. That mode stays.
- Any change to the underlying rate data or to `quoteStay` / `quoteInlandStay`.
  This is a presentation and selection layer over resolvers that are already
  exhaustively verified.

## Approaches considered

**A. New standalone page ("Quick Rates") alongside the existing builders.**
Rejected. It would mean a third place rates live, and the same city/hotel data
loaded by three different pages. The team would have to know which page to open.

**B. Extend `Compare Options` with more filters.** Rejected. Compare Options is
built around explicitly choosing a rate column per room, which is exactly the
friction being removed. Bolting auto-resolution onto it leaves two contradictory
mental models in one mode.

**C. Replace `Compare Options` with the Rate Wall. Chosen.** The wall does
everything Compare Options did and removes the manual column step. Each supplier
page drops to two modes: `Rates` (default, the wall) and `Build Package`. One
place to look, nothing to relearn, no dead code path left behind.

## Architecture

Shared, supplier-agnostic:

- `services/rateWall.ts` — pure functions with no supplier knowledge:
  - `bandHotels(entries)` → assigns price bands (algorithm below).
  - `formatClientExport(selection, context)` → the client-facing text.
  - Shared types: `WallEntry`, `WallRoomRow`, `PriceBand`.
- `components/ratewall/RateWallControls.tsx` — the input bar.
- `components/ratewall/RateWallCard.tsx` — one hotel card.
- `components/ratewall/RateWallTray.tsx` — selection summary + export buttons.

Supplier-specific (one adapter each, this is where the two sheets differ):

- `services/rajarshiWall.ts` — `buildRajarshiWall(input): WallEntry[]`
- `services/inlandWall.ts` — `buildInlandWall(input): WallEntry[]`

Each adapter's only job is to turn the shared control inputs into a list of
priced rows by calling its existing, already-verified resolver. Neither adapter
reimplements rate maths. `RajarshiBuilder.tsx` and `InlandBuilder.tsx` each
render the shared components against their own adapter.

This keeps each file small and single-purpose: controls know nothing about
hotels, cards know nothing about suppliers, adapters know nothing about layout.

## Resolution rules

The controls collect: city, check-in date, nights, adults, children, rooms,
meal plan, markup mode, markup value. How those map to a rate differs per sheet.

### Rajarshi (Kutch PDF)

Already fully date-driven; the adapter is thin.

- Date → tier, per night, via existing `resolveNightRate`. Peak/festive windows
  override base automatically.
- Meal plan → `RajPlan` (`EPAI` / `CPAI` / `MAPAI`) directly.
- Pax → room fit and extra beds. Room occupancy is printed per room as free
  text (`Single/Double` ×49, `Quad Sharing` ×3, `04 Person` ×2). Mapping:
  - pax ≤ 2 → `Single/Double` rooms fit natively.
  - pax 3 → `Single/Double` + 1 extra person at the hotel's own extra-person
    rate; quad rooms fit natively.
  - pax 4 → quad rooms fit natively; `Single/Double` + 2 extra persons
    otherwise.
  - Rooms that cannot reach the requested pax even with extra beds are still
    listed, marked `Too small for N pax`, and are not tickable.
- Everything else (`quoteStay`) is unchanged: markup, extra-person totals,
  on-request handling.

### Inland (Gujarat Excel)

The sheet's two rate columns mean different things per hotel. The controls now
supply enough information to pick the right one. Distribution across 508 rooms:

| Axis | Rooms | Resolved by |
|---|---|---|
| `occupancy` (single vs double) | 170 | pax and rooms |
| `weekday_weekend` | 159 | check-in date, per night |
| `meal_plan` (CPAI/MAPAI/APAI) | 109 | meal plan control |
| `season` (Apr–Sep vs Oct–Mar) | 65 | check-in date |
| `unknown` | 5 | never auto-resolved |

- **Weekday/weekend resolves per night, not per stay.** A Thursday check-in for
  3 nights bills 1 weekday + 2 weekend nights. Each hotel's own printed weekend
  definition is parsed from its column label — the sheet contains `FRI-SUN`,
  `FRI-SAT`, and one `Sun-Thu` weekday definition. Where the label cannot be
  parsed to a definite day set, the room is treated as unresolvable (below).
- **Occupancy** picks the single column for 1 pax per room, the double column
  for 2, and the triple column where the hotel prints one. Above that, double
  plus the hotel's extra-person charge.
- **Season** compares the check-in date against the printed half-year, and also
  drives the existing `H1`/`H2` room tagging for the 9 season-split hotels.
A room row is one of two shapes, not one shape with unused fields: a quotable
row carries its money figures, and a blocked row carries only a reason. This is
enforced in the type system so that printing a price for an unquotable room is
not merely discouraged but impossible to express.

- **Unresolvable rooms** (the 5 `unknown`-axis rooms, unparseable weekend
  labels, and any room whose chosen column has no clean number) are listed,
  greyed, tagged `On request`, and are not tickable. They are never priced at 0
  and never silently defaulted to the other column.

Every card shows a resolution chip stating which column was used and why —
`Weekend rate · Fri+Sat`, `Double occupancy`, `Apr–Sep season rate`. This is the
trust mechanism: the agent can see the basis for the number without opening the
sheet. Unresolvable rows show an amber chip instead.

## Price banding

Bands are computed from the results actually on screen, so they adapt per city.

1. For each hotel, take its cheapest quotable room total for the current inputs.
   Hotels with no quotable room are excluded from banding and listed last under
   `On request`.
2. Sort ascending.
3. If fewer than 3 bandable hotels, render one unlabelled list.
4. If the most expensive is within 15% of the cheapest, render one band labelled
   `Similar pricing` — forcing three bands over a narrow spread is misleading.
5. Otherwise aim for three equal-count groups by rank, remainder to the cheaper
   groups — but cut only where the price actually changes. A band boundary must
   never fall inside a group of hotels sharing one price, because two hotels at
   the same rate under different labels cannot be explained on a call. Each
   ideal cut snaps to the **nearest** legal boundary in either direction.
6. Label by how many groups actually survive: three → `Value` / `Mid` /
   `Premium`; two → `Value` / `Premium`; one → a single unlabelled band. Labels
   are never assigned by position with empty bands dropped — that names the
   priciest group `Mid`, or titles a 50× spread `Value`, which is worse than
   having no labels at all.

Any hotel whose cheapest total is not a finite, positive number is treated as
unquotable and listed under `On request`. A malformed or zero figure must
degrade to "call the supplier", never render as `₹NaN` or `₹0` on a card. A
zero also breaks the proportional spread test outright (`0 × 1.15 = 0`), which
would silently disable the `Similar pricing` collapse for the entire wall.

Within a hotel, one unusable room must not poison the rest: the cheapest figure
is taken over that hotel's *usable* rooms only, so a hotel with one corrupt
rate and one good ₹4,000 room still quotes ₹4,000.

Star rating is displayed on every card but never affects banding. A 5-star
hotel can and will appear under `Mid` when its rate says so.

A band ranks hotels by their **cheapest bookable rate, whatever meal plan that
is** — not by a like-for-like plan. Suppliers publish different plans per
hotel: in Mandvi, Vijay Vilas prints only MAPAI (₹7,000, full board) and bands
below Serena's CPAI (₹8,500, breakfast only). Normalising them would mean
inventing a value for two meals that the sheet never prints, so the plan label
is shown against every price instead and the basis is never hidden. Where a
city's hotels all publish the same plan — Dholavira and Hodka are MAPAI
throughout — the question does not arise.

## Card contents

Per hotel: name, star rating, resolution chip, and an inclusions line
(`CP · GST included` — Rajarshi rates are GST-inclusive per the sheet's global
T&C; Inland likewise per its `GST Included` row).

Per room row:
- Room name.
- Selling total for the whole stay, prominent.
- Per-night rate alongside it, so the agent can quote either way without
  dividing.
- `net ₹X · margin ₹Y` in muted text beside it.
- A tick box.

A festive/blackout flag appears on the card when the stay overlaps a
supplier-declared special window. For Rajarshi this is exact — the matched
tier's own printed label is shown (`Diwali Date`, `Black-Out Date Rate`,
`Nov 2026 – Full Moon`). For Inland, hotels that print festive or blackout text
in their remark show that text verbatim as an amber flag, without attempting to
parse dates out of free prose.

## Selection and export

The tray shows the number of ticked rows and the combined client-facing total.
Three exports — Copy, PDF, WhatsApp — all produce identical, client-facing
content:

- Guest name, city, check-in and check-out dates, nights, pax, rooms, meal plan.
- Then every ticked hotel + room in a single list ordered cheapest to priciest,
  each with its selling total and per-night rate. The export carries no band
  headings — the on-screen `Value` / `Mid` / `Premium` grouping is an internal
  scanning aid, and labelling a hotel `Value` to a customer reads as a judgement
  on a property the agent may be actively recommending. Price order alone
  conveys the same ranking without editorialising.
- The inclusions line.
- Nothing else. No net cost, no markup percentage, no margin, no supplier name,
  no band labels.

There is deliberately no internal-detail export. The full breakdown exists only
on screen, which the client never sees.

Every value interpolated into an export is sanitised first, because the text is
transcribed from supplier PDFs and spreadsheets and is not trusted:

- **Newlines and control characters are collapsed to spaces.** Supplier meal and
  supplement fields genuinely contain embedded newlines carrying rupee figures,
  and an unsanitised one would inject its own line into the message.
- **WhatsApp markup characters (`*`, `_`) are stripped**, so an unbalanced one in
  a name cannot break the formatting of everything after it. Real data contains
  `RE:GEN:TA INN -3*`.
- **A festive note carrying a currency figure is replaced** with the neutral
  phrase `Peak / festive dates`. Two Rajarshi tiers are printed as
  `Black-Out Date Rate (Additional Rs 1,000 on room rate)` — that ₹1,000 is the
  supplier's *net* surcharge, already inside the quoted total. Passing it
  through would disclose a cost component, let the customer back out the
  pre-surcharge rate, and imply a charge on top of a total that already includes
  it. The note is not surgically edited; supplier prose is replaced wholesale,
  because editing it risks producing a sentence that reads as a different offer.
- **Rows without a finite, positive selling total are dropped** before sorting.
  A `NaN` total otherwise makes the comparator return `NaN`, which leaves the
  order untouched — putting the dearest hotel first in a quote that claims to be
  cheapest-first — and prints `₹NaN` to the customer.

The per-night figure is labelled **`avg/night`** on multi-night stays and
omitted entirely on single-night stays, where it merely repeats the total. A
stay spanning one base night and one Diwali night has two different nightly
rates, and no night costs the average: presenting it as "per night" is a rate
claim the customer will reasonably rely on when asking to add or drop a night.

## Failure and edge handling

- Zero hotels for a city → empty state naming the city, not a blank page.
- All rooms on request → the wall still lists them, banding is skipped.
- Nights = 0 or negative, pax = 0 → controls clamp to a minimum of 1 and the
  wall repaints; no invalid quote is ever produced.
- Check-in beyond a hotel's printed validity window (Rajarshi seasonal camps
  carry `validity`) → hotel listed with a `Closed for these dates` flag, not
  priced.
- Date arithmetic uses local numeric arithmetic only. `toISOString()` is banned
  in this code path — it round-trips through UTC and silently shifts dates back
  a day in IST, which previously caused peak-window boundary nights to resolve
  as base rate.

## Verification

Matching the standard already set for both suppliers.

- `scripts/verify-rate-wall.ts`, run with `npx tsx`, exhaustive over every
  hotel, room, meal plan, and a date set that includes every tier-window
  boundary (first and last day of each window, plus the day either side):
  - the wall's net and selling figures equal `quoteStay` / `quoteInlandStay`
    called directly — the real resolver, not a reimplementation;
  - the festive flag is set exactly when at least one night resolves to a
    non-base tier;
  - band assignment is a strict partition: every bandable hotel appears in
    exactly one band, no band is empty, and no hotel appears twice;
  - per-night rate × nights × rooms reconciles to the stay total;
  - no export string ever contains the net or margin figures, nor any band
    label. This is asserted directly against generated export text for a
    sampled selection.
  - the export lists selections in strictly ascending price order.
- Live browser verification of both pages after implementation: default state,
  a weekday-to-weekend stay, a festive-window stay, an on-request-only city,
  and each of the three export paths.

## Rollout

1. Build shared `rateWall.ts` + components.
2. Build `rajarshiWall.ts`, wire into `RajarshiBuilder.tsx`, replacing
   `Compare Options`.
3. Verify, typecheck, live-test, deploy. Team can use it on real calls.
4. Build `inlandWall.ts`, wire into `InlandBuilder.tsx` the same way.
5. Verify, typecheck, live-test, deploy.

Rajarshi goes first: 20 hotels and an already date-driven resolver make it the
smaller surface to get the interaction model right on, before applying it to the
186-hotel sheet with the messier column semantics.
