#!/usr/bin/env python3
"""
Data-fidelity audit: services/inlandData.ts vs the source Excel rate sheet.

Run:
    npx tsx scripts/dump-inland.ts          # writes inland_from_ts.json
    python3 scripts/audit-inland-vs-excel.py

WHY THIS EXISTS, AND WHY IT IS NOT scripts/verify-inland.ts
-----------------------------------------------------------
verify-inland.ts proves the RESOLVER's arithmetic is self-consistent. It cannot
detect a mis-transcribed number, because it reads the same inlandData.ts the
resolver reads. If the parser wrote 4,500 where the sheet says 5,400, that test
passes happily.

This script reads the Excel independently and compares every figure. Crucially
it does NOT import or reuse the original parser (parse_inland.py): re-running
the same block-state logic would only prove the parser agrees with itself. The
Excel-side extraction below is written from scratch, using different rules:

  * city   = a short label in column A with no room in column C. Column B may
             carry a locality banner or a note — an earlier rule required B to
             be empty and so missed three destinations entirely.
  * hotel  = column B populated and not the literal 'HOTEL' header
  * room   = column C populated and not the 'ROOM CATEGORY' sub-header

Two matching subtleties, both learned the hard way and both about the SHEET, not
the data:

  * The Ahmedabad Fern Residency entries are printed as 'The Fern Residency,'
    and 'The Fern Residency, ' — with a trailing comma. Our data disambiguates
    the two branches as '(Subhash Bridge)' / '(Ellis Bridge)', added during
    de-duplication. Both suffix and punctuation must be normalised away.
  * 'The Fern Residency' is a chain appearing in eight cities. Matching on hotel
    name ALONE silently compares Ahmedabad's rates against Porbandar's. The key
    must include the city.

A cell is read the way a human reads it: 3600, '₹ 3600', '₹ 3600 ' and '6200 ++'
are all the figure. A '-' or 'On Call' is not a figure and must be on-request.
"""
import json, os, re, sys

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required:  pip3 install openpyxl")

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.expanduser('~/Downloads/Inland hotel  rate sheet 2026-27 ( in Working).xlsx')
SHEET = 'Hotel Gujarat Rate Sheet 2025 -'
TS_JSON = os.environ.get('INLAND_TS_JSON', os.path.join(HERE, '..', 'inland_from_ts.json'))

N = lambda s: re.sub(r'\s+', ' ', str(s).strip()).lower()

# Text in column A that is a star rating, a footer line or a table header —
# never a destination.
DEST_NOISE = re.compile(r'star|hotel|destination|gst included|booking|email|web:|^\d', re.I)

def hotel_key(name: str) -> str:
    """Normalise a hotel name for comparison across the two sources."""
    n = N(name)
    n = re.sub(r'\s*\([^)]*\)\s*$', '', n)   # '(Subhash Bridge)' added by de-dup
    n = n.rstrip(' ,')                        # the sheet's trailing comma
    return n

def room_key(name: str) -> str:
    return re.sub(r'\s*\[block [ab]\]\s*$', '', N(name))

def cell_figure(v):
    """The rupee figure a human would read from this cell, or None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(round(v))
    m = re.fullmatch(r'(?:₹|rs\.?|inr)?\s*([\d,]+)\s*(?:\+\+)?\s*', str(v).strip(), re.I)
    return int(m.group(1).replace(',', '')) if m else None


def read_excel():
    ws = openpyxl.load_workbook(SRC, data_only=True)[SHEET]
    out, city, hotel = {}, None, None
    for r in range(1, ws.max_row + 1):
        a, b, c, d, e = (ws.cell(r, i).value for i in (1, 2, 3, 4, 5))
        # A destination marker is a short label in column A with no room in C.
        # Column B MAY carry a locality banner or a note — requiring it empty
        # silently missed SASANGIR ('Note :- For Jungle Safari Booking…'),
        # KEVADIYA ('STATUE OF UNITY') and DHORDO ('Kutch Hotels (Closed Now…'),
        # filing 36 hotels under a neighbouring city. Sasan Gir's lion-safari
        # lodges were sitting under Diu, a beach ~100km away.
        if isinstance(a, str) and a.strip() and c is None and not DEST_NOISE.search(a) \
                and len(a.split()) <= 4:
            city = N(a); continue
        if isinstance(b, str) and b.strip() and b.strip().upper() != 'HOTEL':
            hotel = hotel_key(b.split('\n')[0])
        if isinstance(c, str) and c.strip() and hotel and N(c) != 'room category':
            out.setdefault((hotel, room_key(c)), []).append(
                {'row': r, 'city': city, 'd': cell_figure(d), 'e': cell_figure(e), 'rawd': d, 'rawe': e})
    return out


def main():
    if not os.path.exists(TS_JSON):
        sys.exit(f"missing {TS_JSON} — run:  npx tsx scripts/dump-inland.ts")
    excel = read_excel()
    ts = json.load(open(TS_JSON))

    total_rooms = sum(len(h['rooms']) for h in ts)
    located = mismatches = unlocated = onreq_checked = 0
    problems = []

    for h in ts:
        hk, ck = hotel_key(h['name']), N(h['city'])
        for rm in h['rooms']:
            hits = excel.get((hk, room_key(rm['name'])))
            if not hits:
                unlocated += 1
                problems.append(('UNLOCATED', h['city'], h['name'], rm['name'], '', ''))
                continue
            # Prefer rows from the same city; a chain name repeats across cities.
            same_city = [x for x in hits if x['city'] == ck] or hits
            located += 1

            # A room only has a second rate axis if its block header printed a
            # label for column E. Where it did not, the sheet still sometimes
            # repeats the column D figure in E purely for visual balance, and we
            # correctly carry no rate2 — there is no second thing to choose.
            # That is only safe while the repeated value is IDENTICAL, so assert
            # it rather than waving the case through: a DIFFERENT figure under an
            # unlabelled column would be real data we are dropping on the floor.
            has_second_axis = bool((rm.get('axisLabels') or [None, None])[1])

            for field, col, rawcol in (('rate1', 'd', 'rawd'), ('rate2', 'e', 'rawe')):
                ours = rm.get(field)
                if field == 'rate2' and not has_second_axis:
                    for x in same_city:
                        if x['e'] is not None and x['e'] != x['d']:
                            mismatches += 1
                            problems.append(('UNLABELLED COLUMN E HOLDS A DISTINCT FIGURE',
                                             h['city'], h['name'], rm['name'],
                                             f"D={x['rawd']!r}", f"E={x['rawe']!r} (row {x['row']})"))
                    continue
                if ours is None:
                    # We call it on-request. The sheet must not hold a clean figure.
                    onreq_checked += 1
                    if same_city and all(x[col] is not None for x in same_city):
                        mismatches += 1
                        problems.append(('ON-REQUEST BUT SHEET HAS A FIGURE', h['city'], h['name'],
                                         rm['name'], field, [(x['row'], x[rawcol]) for x in same_city]))
                    continue
                if not any(x[col] == ours for x in same_city):
                    mismatches += 1
                    problems.append(('RATE MISMATCH', h['city'], h['name'], rm['name'],
                                     f'ours={ours}', [(x['row'], x[rawcol]) for x in same_city]))

    print(f"\nHotels in data          : {len(ts)}")
    print(f"Rooms in data           : {total_rooms}")
    print(f"Rooms located in Excel  : {located}")
    print(f"Rooms NOT located       : {unlocated}")
    print(f"On-request cells checked: {onreq_checked}")
    print(f"Rate mismatches         : {mismatches}")

    if problems:
        print(f"\n--- {len(problems)} finding(s), first 25 ---")
        for p in problems[:25]:
            print('   ', p)
        sys.exit(1)

    print("\nALL INLAND RATES MATCH THE SOURCE EXCEL — every room located and every figure verified.")


if __name__ == '__main__':
    main()
