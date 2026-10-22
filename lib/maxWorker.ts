import {dispatchJigarWebhook} from './jigarWebhook';
import {dispatchPrakashWebhook} from './prakashWebhook';
import crypto from 'node:crypto';
import {maxDb} from './maxServerDb';
import {dispatchInteraktRelay} from './interaktRelay';
import {dispatchSonaliWebhook} from './sonaliWebhook';
import {dispatchWebhooks} from './maxAutomation';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:{code:'method_not_allowed'}});
 const secret=process.env.CRON_SECRET||'',given=String(req.headers?.authorization||'');const expected='Bearer '+secret;
 if(!secret||given.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(given),Buffer.from(expected)))return res.status(401).json({error:{code:'unauthorized'}});
 try{const [outbox,relay,sonali,jigar,prakash]=await Promise.allSettled([dispatchWebhooks(maxDb),dispatchInteraktRelay(maxDb),dispatchSonaliWebhook(maxDb),dispatchJigarWebhook(maxDb),dispatchPrakashWebhook(maxDb)]);if(outbox.status==='rejected'||relay.status==='rejected')throw Error('Queue failed');return res.status(200).json({...outbox.value,relay:relay.value,jigar:jigar.status==='fulfilled'?jigar.value:{error:'queue_unavailable'},prakash:prakash.status==='fulfilled'?prakash.value:{error:'queue_unavailable'},sonali:sonali.status==='fulfilled'?sonali.value:{error:'queue_unavailable'}});}catch{return res.status(503).json({error:{code:'worker_unavailable',message:'MAX queue could not be processed.'}});}
}
