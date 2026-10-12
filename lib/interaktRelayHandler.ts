import {relayRequest} from './interaktRelay';
const LIMIT=256*1024;
export default async function handler(req:any,res:any) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try {
    const chunks:Buffer[]=[];let bytes=0;
    for await(const chunk of req){const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=value.length;if(bytes>LIMIT)return res.status(413).json({error:'Payload too large'});chunks.push(value);}
    const result=await relayRequest(Buffer.concat(chunks),req.headers?.['interakt-signature']);
    return res.status(result.status).json(result.body);
  }catch{console.error('Interakt relay could not persist event');return res.status(503).json({error:'Relay temporarily unavailable'});}
}
