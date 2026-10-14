import {cronAuthorized} from './googleContactsDb';
import {runContactSync} from './googleContactsSync';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed.'});
 if(!cronAuthorized(req.headers?.authorization))return res.status(401).json({error:'Unauthorized.'});
 try{return res.status(200).json(await runContactSync());}
 catch{return res.status(503).json({error:'Google Contacts worker unavailable. Jobs are preserved.'});}
}
