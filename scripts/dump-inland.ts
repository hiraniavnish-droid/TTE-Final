// Dumps INLAND_HOTELS to JSON so the Python fidelity audit can read it without
// needing a TypeScript runtime. Paired with scripts/audit-inland-vs-excel.py.
//
// The repo is ESM ("type": "module") so __dirname is unavailable, and the
// project path contains spaces — url.pathname leaves them percent-encoded, so
// fileURLToPath is required rather than .pathname.
import { INLAND_HOTELS } from '../services/inlandData';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
const out = fileURLToPath(new URL('../inland_from_ts.json', import.meta.url));
fs.writeFileSync(out, JSON.stringify(INLAND_HOTELS, null, 1));
console.log(`wrote ${INLAND_HOTELS.length} hotels -> ${out}`);
