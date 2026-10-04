import {messageTime} from './maxAutomation';
import {canonicalBusinessDate} from './botApiContract';
export class LeadUpdateError extends Error {status=400;code='invalid_request';}
const bad=(message:string):never=>{throw new LeadUpdateError(message);};
const integer=(v:any,name:string,min:number,max:number)=>{if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)bad(`${name} must be an integer from ${min} to ${max}.`);return v;};
export function takeIfMatch(req:any): string | undefined {
 const value=req.headers?.['if-match'];
 // Node/Vercel's send layer also treats If-Match as a response precondition.
 // Preserve it for our database check and remove it before response handling.
 if(req.headers)delete req.headers['if-match'];
 if(value===undefined)return undefined;
 if(typeof value!=='string')bad('If-Match must be one version timestamp.');
 const cleaned=value.trim().replace(/^"(.*)"$/,'$1');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(cleaned)||Number.isNaN(Date.parse(cleaned)))bad('If-Match must be the lead updated_at timestamp, optionally quoted.');
 return cleaned;
}
export function tripUpdate(before:any, body:any): {trip:any;columns:any}|null {
 const incoming=body.trip;
 if(incoming!==undefined&&(!incoming||typeof incoming!=='object'||Array.isArray(incoming)))bad('trip must be an object.');
 const changes:any={...(incoming||{})};
 for(const [alias,target] of [['tent','accommodation'],['category','accommodation'],['check_in','startDate'],['nights','nights'],['rooms','rooms'],['adults','adults'],['children_under_6','childrenUnder6'],['occupancy','occupancy']] as const){if(body[alias]!==undefined){if(changes[target]!==undefined&&changes[target]!==body[alias])bad(`Conflicting ${alias} and trip.${target}.`);changes[target]=body[alias];}}
 for(const [alias,target] of [['tent','accommodation'],['category','accommodation'],['check_in','startDate']] as const){if(changes[alias]!==undefined){if(changes[target]!==undefined&&changes[target]!==changes[alias])bad(`Conflicting trip.${alias} and ${target}.`);changes[target]=changes[alias];delete changes[alias];}}
 const allowed=['destination','startDate','nights','rooms','accommodation','paxConfig','adults','childrenUnder6','children_under_6','occupancy'];
 if(Object.keys(changes).some(k=>!allowed.includes(k)))bad('Unsupported trip field. Allowed: destination, startDate/check_in, nights, rooms, accommodation/tent, paxConfig.');
 if(!Object.keys(changes).length)return null;
 const trip={...(before||{})},columns:any={};
 if(changes.occupancy!==undefined){if(!['single','double'].includes(changes.occupancy))bad('occupancy must be single or double.');trip.occupancy=changes.occupancy;}
 if(changes.children_under_6!==undefined){if(changes.childrenUnder6!==undefined&&changes.childrenUnder6!==changes.children_under_6)bad('Conflicting children counts.');changes.childrenUnder6=changes.children_under_6;}
 if(changes.childrenUnder6!==undefined)trip.childrenUnder6=integer(changes.childrenUnder6,'children_under_6',0,1000);
 if(changes.adults!==undefined){const adults=integer(changes.adults,'adults',1,1000);if(changes.paxConfig?.adults!==undefined&&changes.paxConfig.adults!==adults)bad('Conflicting adult counts.');changes.paxConfig={...(changes.paxConfig||{}),adults};}

 if(changes.startDate!==undefined){const date=canonicalBusinessDate(changes.startDate);if(!date)bad('check_in/startDate must be a valid YYYY-MM-DD date.');trip.startDate=date;columns.travel_date=date;}
 for(const key of ['destination','accommodation'])if(changes[key]!==undefined){if(typeof changes[key]!=='string'||!changes[key].trim()||changes[key].length>200)bad(`${key} must be nonempty text of at most 200 characters.`);trip[key]=changes[key].trim();if(key==='destination')columns.destination=trip[key];}
 if(changes.nights!==undefined)trip.nights=integer(changes.nights,'nights',1,365);
 if(changes.rooms!==undefined)trip.rooms=integer(changes.rooms,'rooms',1,1000);
 if(changes.paxConfig!==undefined){const p=changes.paxConfig;if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['adults','children','childAges'].includes(k)))bad('Invalid paxConfig.');const merged={...(trip.paxConfig||{}),...p};if(merged.adults!==undefined)integer(merged.adults,'adults',1,1000);if(merged.children!==undefined)integer(merged.children,'children',0,1000);if(merged.childAges!==undefined&&(!Array.isArray(merged.childAges)||merged.childAges.some((a:any)=>!Number.isInteger(a)||a<0||a>17)))bad('childAges must contain integer ages from 0 to 17.');if(merged.children!==undefined&&merged.childAges!==undefined&&merged.childAges.length!==merged.children)bad('childAges length must match children.');trip.paxConfig=merged;if(merged.adults!==undefined)columns.pax=merged.adults;}
 return {trip,columns};
}
