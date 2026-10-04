# Additional SOU API (existing URLs unchanged)

Base: https://ttecrm.vercel.app/api/v1 — same Bearer API key, response envelope, rate limits and scopes as the current API.

Read scope `itinerary:read`:
- GET `/sou/catalog`: complete hotel/ticket bundle/transfer/Tent City rate catalog.
- GET `/sou/hotels`: hotel room/meal-plan rates, supplements and supplier caveats.
- GET `/sou/itineraries`: 1N2D / 2N3D attractions, item prices and service charges.
- GET `/sou/transfers`: railway ₹500/person; golf cart ₹5,000/vehicle/day (5 seats), e-rickshaw ₹2,100/vehicle/day (3 seats), reference only.
- GET `/sou/tentcity`: cottage/villa rates, season dates, meal plans, extra mattresses, peak surcharges and GST.

Write scope `quotes:generate`:
- POST `/sou/hotel-rates`: all resolved room/plan options using the same date/occupancy/extra-mattress engine as the CRM SOU Hotels builder.
- POST `/sou/itinerary/quote`: sightseeing and optional railway transfer, without hotel.
- POST `/sou/quote`: combined hotel and itinerary options; or `product: "sou-tentcity"` for existing cottage/villa quotation logic with `extra_mattresses`.

Example combined request:
```json
{"product":"sou-hotels","check_in":"2026-11-15","nights":2,"rooms":1,"pax":2,"extra_mattresses":0,"markup_mode":"percent","markup_value":10,"include_itinerary":true,"include_railway_transfer":true}
```
Optional `hotel_id` restricts results to a specific hotel. Combined itinerary supports 1 or 2 nights. Hotel-only supports 1–30 nights. All money is INR. Each priced row includes hotel and itinerary selling totals and package total/per person; blocked rows carry reasons without prices. Preserve `clientNote` and `resolutionOk` caveats when presenting options.

Sightseeing example:
```json
{"nights":1,"pax":2,"include_railway_transfer":true}
```
1N2D tickets ₹580/person + service ₹200/person = ₹780/person without railway, ₹1,280 with railway. 2N3D tickets ₹790 + service ₹300 = ₹1,090/person, or ₹1,590 with railway. These are existing CRM sheet rates, not live availability or independently verified current ticket prices. No separate child rates are published in this bundle. Golf cart/e-rickshaw never enter totals. Tent City Experiential includes sightseeing/pickup-drop and cannot be combined with the hotel ticket bundle via this endpoint.

No day-by-day timetable is promised by the rate-sheet bundle. Legacy brochure defaults and editable marketing prices are not supplier-confirmed rates; this API uses the current quotation engines. Existing `/itinerary/*`, `/rann/*`, lead APIs and authentication settings are unchanged.
