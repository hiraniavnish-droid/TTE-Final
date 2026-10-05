import {build} from 'esbuild'; import assert from 'node:assert/strict';
await build({entryPoints:['lib/dashboardPeriods.ts'],bundle:true,platform:'node',format:'esm',outfile:'.tmp/dashboard-periods.mjs'});
const {getPeriodRange,businessDate,dateBoundary,validDateRange}=await import('../.tmp/dashboard-periods.mjs');
let r=getPeriodRange('Last Month',new Date('2026-01-02T00:00:00+05:30'));
assert.equal(r.start.toISOString(),'2025-11-30T18:30:00.000Z');assert.equal(businessDate(r.end),'2025-12-31');assert.equal(businessDate(r.prevStart),'2025-11-01');
r=getPeriodRange('This Month',new Date('2026-03-31T23:59:00+05:30'));assert.equal(businessDate(r.prevEnd),'2026-02-28');
r=getPeriodRange('This Month',new Date('2026-10-01T20:00:00Z'));assert.equal(businessDate(r.end),'2026-10-02');assert.equal(businessDate(r.prevEnd),'2026-09-02');
assert.equal(getPeriodRange('All Time').start,null);assert.equal(validDateRange('2026-10-02','2026-10-01'),false);assert.equal(validDateRange('2026-02-30','2026-03-01'),false);assert.equal(validDateRange('2024-02-29','2024-02-29'),true);assert.equal(dateBoundary('2026-10-02',true).toISOString(),'2026-10-02T18:29:59.999Z');
console.log('PASS: IST boundaries, January rollover, leap day, month-to-date comparison, custom validation and inclusive end dates.');
