import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
await build({entryPoints:['services/namakRates.ts'],outfile:'.tmp/namak-rates.mjs',bundle:true,platform:'node',format:'esm'});
const {quoteNamak,namakSupplement,namakMessage}=await import('../.tmp/namak-rates.mjs');
const base={guestName:'Demo Guest',reference:'TTE-DEMO',category:'premium',checkIn:'2026-11-15',nights:2,rooms:1,extraPersons:0,discountPct:0,gstPct:null};
assert.equal(quoteNamak(base).total,17000);
assert.equal(quoteNamak({...base,checkIn:'2026-11-21',nights:2}).total,18500);
assert.equal(quoteNamak({...base,checkIn:'2026-12-31',nights:3}).total,28500);
assert.equal(quoteNamak({...base,checkIn:'2027-01-19',nights:6}).total,63000);
assert.equal(quoteNamak({...base,category:'darbari',checkIn:'2026-12-24'}).total,56000);
const discount=quoteNamak({...base,extraPersons:1,rooms:2,discountPct:10,gstPct:18});
assert.equal(discount.roomRent,34000);assert.equal(discount.discount,3400);assert.equal(discount.extras,5000);assert.equal(discount.total,42008);
assert.equal(namakSupplement('2027-01-01').amount,0);assert.equal(namakSupplement('2026-11-08').amount,0);
assert.equal(quoteNamak({...base,checkIn:'2027-02-28',nights:1}).checkOut,'2027-03-01');
for(const invalid of [{checkIn:'2027-02-28',nights:2},{checkIn:'2026-10-31'},{checkIn:'2027-02-30'},{nights:0},{rooms:0},{category:'darbari',rooms:2},{extraPersons:-1},{discountPct:101},{gstPct:NaN}])assert.throws(()=>quoteNamak({...base,...invalid}));
assert.match(namakMessage(quoteNamak(base)),/applicable GST/);assert.doesNotMatch(namakMessage(quoteNamak(base)),/includes all sightseeing/);
await build({entryPoints:['services/namakQuotationPdf.ts'],outfile:'.tmp/namak-pdf.mjs',bundle:true,platform:'node',format:'esm',external:['jspdf']});
const {createNamakPdf}=await import('../.tmp/namak-pdf.mjs');
const load=async p=>{assert.ok(!/\.(jpe?g|webp)$/i.test(p),'Quotation must not load tent photographs');return (await fs.readFile('public'+p)).toString('base64');};
for(const [name,input,guide] of [['Namak-Quotation-Demo', {...base,guestName:'Avnish Hirani',checkIn:'2026-11-21',extraPersons:1},true],['Namak-Quotation-One-Page',base,false],['Namak-Quotation-Stress',{...base,guestName:'A long guest name for the extended family group accommodation quotation review',reference:'TTE-0123 / Family',checkIn:'2026-11-21',nights:28,rooms:10,extraPersons:20,discountPct:7,gstPct:18},false]]){
 const doc=await createNamakPdf(quoteNamak(input),guide,load);assert.equal(doc.getNumberOfPages(),guide?2:1);await fs.writeFile('output/pdf/'+name+'.pdf',Buffer.from(doc.output('arraybuffer')));
}
console.log('Namak verified: calendar boundaries, cross-band stays, extras, discounts, GST, inventory, invalid inputs and 1/2-page PDFs.');
