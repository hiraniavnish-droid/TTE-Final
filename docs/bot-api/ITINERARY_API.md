# Itinerary Hub and Rann quotation API

Base: `https://ttecrm.vercel.app/api/v1`. Every request needs `x-api-key`.
Normal URL paths now work. The old `?path=` workaround is unnecessary; existing callers with matching paths remain compatible.

## Available endpoints

| Method | Endpoint | Scope | Result |
|---|---|---|---|
| GET | `/itinerary/catalog` | itinerary:read | Products, seasons, categories, supported durations and supplier sources |
| GET | `/itinerary/hotels?supplier=rajarshi` | itinerary:read | Rajarshi hotel/room/meal-plan/season rate cards |
| GET | `/itinerary/hotels?supplier=inland` | itinerary:read | Inland hotel rate cards with original column labels |
| GET | `/itinerary/hotels?supplier=sou-hotels` | itinerary:read | Kevadiya hotel rate cards |
| GET | `/itinerary/packages` | itinerary:read | Five ready Rajarshi packages, tier prices, day plans, terms and WhatsApp text |
| POST | `/itinerary/quote` | quotes:generate | A computed hotel/resort/Tent City quote |
| POST | `/rann/quote` | quotes:generate | Rann Tent City pricing, alternative categories, dates, tax and discount |
| POST | `/rann/quote/pdf` | quotes:generate | Binary `application/pdf` using the CRM's existing Rann quotation design |

Hotel lists support `city`, `hotel_id`, `limit` (max 100), and opaque `cursor`; package lists support `package_id`, `limit`, `cursor`. Responses are `{data,next_cursor,rate_version}`. Rate cards are bundled supplier data, NOT Supabase hotel rows or live room availability. `rate_version` is a content hash. Static rate catalogs do not support `updated_since` and do not invent database record timestamps. Restart pagination if rate-version validation rejects a cursor.

## Rann Tent City calculation and PDF

```bash
curl -X POST https://ttecrm.vercel.app/api/v1/rann/quote \
  -H "x-api-key: $CRM_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"check_in":"2026-11-15","nights":2,"rooms":1,"category":"Premium Tent","occupancy":"double","extra_mattresses":0,"children_under_6":0,"discount_percent":5,"guest_name":"Guest","reference":"TTE-0586"}'
```

For the PDF use the same body and replace the endpoint with `/rann/quote/pdf`:

```bash
curl --fail-with-body -X POST https://ttecrm.vercel.app/api/v1/rann/quote/pdf \
  -H "x-api-key: $CRM_API_KEY" -H "Content-Type: application/json" \
  --data '{"check_in":"2026-11-15","nights":2,"rooms":1,"category":"Premium Tent","occupancy":"double","extra_mattresses":0,"discount_percent":5,"guest_name":"Guest"}' \
  --output rann-quotation.pdf
```

Required: `check_in` (strict YYYY-MM-DD), `nights` (1–3), `rooms` (1–100), exact `category` from catalog. Optional `occupancy` single/double (default double), extra mattresses and children under six (default 0), discount percent (0–100, default 0), guest name/reference. `option_categories` accepts up to six category names for comparison PDFs. Stay nights must be within the published season. All prices use the shared CRM rate engine, discount on room rent, extras and 18% GST. The API key's holder is responsible for choosing the approved discount; no automated discount approval policy has been configured.

The PDF is returned directly, NOT a public URL or CRM attachment. Your bot uploads it to its approved messaging/media system and sends it separately. API generation does not send WhatsApp, create a hold, save a booking, change a lead's status or record payment. `reference` is printable text, not automatic CRM linkage.

## Hotel quotes

```bash
curl -X POST https://ttecrm.vercel.app/api/v1/itinerary/quote \
  -H "x-api-key: $CRM_API_KEY" -H "Content-Type: application/json" \
  --data '{"product":"rajarshi","hotel_id":"time-square-club-resort-spa","room_index":0,"plan":"CPAI","check_in":"2026-11-18","nights":2,"rooms":1,"extra_persons":0,"markup_mode":"percent","markup_value":10}'
```

Select `hotel_id` and zero-based `room_index` from the hotel catalog. Rajarshi requires EPAI/CPAI/MAPAI. Inland/SOU hotels require explicit `rate_column` 1 or 2: read the original `axisLabels`; never infer weekday, occupancy or meal plan from the column number. Ambiguous hotels require supplier confirmation. Unknown rates return `quotable:false,total:null`; never send partial totals from `breakdown` as a final quote. The shared rate card engine determines supplements and markup. Hotel terms/remarks remain warnings and need review for manual restrictions.

For `/itinerary/quote`, other supported products:
- `rann-tentcity`: same fields as Rann calculation.
- `rann-resort`: check_in, nights (1–2), rooms, occupancy, extra_persons, discount_percent.
- `sou-tentcity`: check_in, nights, rooms, category, plan (CP/MAP/Experiential), occupancy, extra_persons, discount_percent. Villas require Experiential.
- `inland` and `sou-hotels`: hotel_id, room_index, rate_column, check_in, nights, rooms, extra_persons, markup_mode/value.

Only Rann Tent City has PDF generation in this release. Hotel custom itinerary PDFs, Resort/SOU PDFs and custom transport-based package calculations are not exposed.

## Retries, audit and permissions

These new POST endpoints calculate artifacts; they do not create business records. Safe to retry with the same input; each attempt is audit-logged and rate limited (30 POST requests/minute). They do not reserve `Idempotency-Key` records or retain PDF bytes in the database. Original CRM mutation endpoints still require `Idempotency-Key` and retain their existing duplicate protections.

Primary API_KEY already has all scopes. Restricted BOT_API_KEYS clients need `itinerary:read` and/or `quotes:generate`. Credentials remain server-side. Availability is always `not_checked`; call the separately configured inventory workflow before promising rooms. No supplier refresh or hold is triggered by these APIs.

## Maintainer build note

The deployed Node handler is `api/bot.js`, bundled from `lib/botApiProduction.ts` by `node scripts/build-bot-api.mjs`. `npm run build` rebuilds it automatically before the frontend. The handler, dependency sources, quotation assets and rewrite configuration must remain committed so Git-based deployments retain the API. Vercel rewrites `/api/v1/:path*` to this handler. Separate local Accounts draft additions are not activated by this handler.

Fixed quotation images/fonts are cached in warm server instances; cold instances must load them once. PDF responses above 4.4 MB return `413 pdf_too_large` instead of an invalid download.

## Public quotation PDF link for Interakt

`POST https://ttecrm.vercel.app/api/v1/rann/quote/pdf-link`

Use the same `x-api-key`, `quotes:generate` scope and JSON body as `/rann/quote/pdf`. It creates the identical quotation PDF and uploads it using the server-only service key. No Supabase credential is returned. Every call generates a new UUID filename and an audit entry. It does not send WhatsApp itself.

```bash
curl -X POST 'https://ttecrm.vercel.app/api/v1/rann/quote/pdf-link' \
  -H "x-api-key: $TTE_BOT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"check_in":"2026-11-15","nights":2,"rooms":1,"category":"Premium Tent","guest_name":"Customer Name"}'
```

Response HTTP 200 (fields at the top level):

```json
{"url":"https://<project>.supabase.co/storage/v1/object/public/quotes/Rann-Quotation-<uuid>.pdf","filename":"Rann-Quotation-<uuid>.pdf","expires_at":"2026-10-08T12:00:00.000Z","request_id":"...","meta":{"version":"2026-09-26"}}
```

MAX passes `url` and `filename` to the existing Interakt document/template sending flow. The PDF URL needs no login or API header. Upload or cleanup failure returns JSON 503; invalid quote input returns 400.

The `quotes` bucket is public: anyone with a file URL can download it. Filenames are random. `expires_at` is a seven-day retention target, not a signed URL expiry. On every PDF-link request, the server removes generated `Rann-Quotation-<uuid>.pdf` files older than seven days, gathering all pages before deleting so no records are skipped. With no subsequent calls, a file can remain beyond this date. Existing unrelated files are preserved. Each call makes a new file; do not assume retry deduplication for this quote-generation endpoint.
