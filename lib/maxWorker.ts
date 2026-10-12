import crypto from 'node:crypto';
import {maxDb} from './maxServerDb';
import {dispatchInteraktRelay} from './interaktRelay';
import {dispatchWebhooks} from './maxAutomation';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:{code:'method_not_allowed'}});
 const secret=process.env.CRON_SECRET||'',given=String(req.headers?.authorization||'');const expected='Bearer '+secret;
 if(!secret||given.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(given),Buffer.from(expected)))return res.status(401).json({error:{code:'unauthorized'}});
 try{const [outbox,relay]=await Promise.allSettled([dispatchWebhooks(maxDb),dispatchInteraktRelay(maxDb)]);if(outbox.status==='rejected'||relay.status==='rejected')throw Error('Queue failed');return res.status(200).json({...outbox.value,relay:relay.value});}catch{return res.status(503).json({error:{code:'worker_unavailable',message:'MAX queue could not be processed.'}});}
}
