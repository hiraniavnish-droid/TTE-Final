import { build } from 'esbuild';
import assert from 'node:assert/strict';
await build({ entryPoints: ['lib/customerAccounts.ts'], bundle: true, platform: 'node', format: 'esm', outfile: '.tmp/customer-accounts.js' });
const { bookingVendors, totalVendors, matchesPayment, groupVendorBalances } = await import('../.tmp/customer-accounts.js');
const vendor = (name, cost, amounts = []) => ({ name, cost, payments: amounts.map(amount => ({ amount })) });
const lead = { id: 'a', vendors: [vendor('Hotel A', 100, [140]), vendor('Transport B', 80, [20])] };
const entries = bookingVendors(lead);
assert.deepEqual(totalVendors(entries), { cost: 180, paid: 160, owed: 60 });
assert.deepEqual(totalVendors(entries.filter(v => v.key === 'transport b')), { cost: 80, paid: 20, owed: 60 });
assert.equal(matchesPayment(entries[0], 'paid'), true);
assert.equal(matchesPayment(entries[1], 'partial'), true);
assert.equal(matchesPayment(entries[1], 'unpaid'), false);
assert.equal(matchesPayment(bookingVendors({ vendors: [vendor('A', 100)] })[0], 'unpaid'), true);
assert.equal(matchesPayment(bookingVendors({})[0], 'paid'), false);
assert.equal(matchesPayment(bookingVendors({})[0], 'no-cost'), true);
assert.equal(matchesPayment(entries[1], 'outstanding'), true);
assert.equal(matchesPayment(entries[0], 'outstanding'), false);
const duplicate = bookingVendors({ vendors: [vendor('Same vendor', 100, [100]), vendor(' same VENDOR ', 50)] });
assert.equal(duplicate.length, 1);
assert.equal(matchesPayment(duplicate[0], 'partial'), true);
assert.equal(duplicate[0].owed, 50);
const legacy = bookingVendors({ commercials: { netCost: 50, vendorId: 's1' } }, [{ id: 's1', name: 'Legacy Hotel' }]);
assert.equal(legacy[0].name, 'Legacy Hotel');
assert.equal(legacy[0].owed, 50);
assert.equal(bookingVendors({ commercials: { netCost: 25, manualVendorName: 'Manual' } })[0].name, 'Manual');
const groups = groupVendorBalances([
  { lead, vendorEntries: entries },
  { lead: { id: 'b' }, vendorEntries: bookingVendors({ vendors: [vendor(' hotel   a ', 100), vendor('Hotel A', 20)] }) },
]);
const a = groups.find(v => v.key === 'hotel a');
assert.deepEqual({ cost: a.cost, paid: a.paid, owed: a.owed, bookings: a.bookings.size }, { cost: 220, paid: 140, owed: 120, bookings: 2 });
assert.equal(groups[0].key, 'hotel a');
assert.equal(groupVendorBalances([{ lead, vendorEntries: entries.filter(v => v.key === 'transport b') }])[0].cost, 80);
console.log('PASS: vendor-scoped balances, unpaid/partial/paid/no-cost states, overpayments do not offset other liabilities, legacy vendors, normalized grouping and unique booking counts.');
