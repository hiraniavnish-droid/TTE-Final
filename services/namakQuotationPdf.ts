import type { jsPDF } from 'jspdf';
import { NAMAK_CATEGORIES, namakDate, type NamakQuote } from './namakRates';
import { QUOTATION_CONTACT } from './rannQuotationContent';
const money = (n:number) => `INR ${n.toLocaleString('en-IN',{maximumFractionDigits:2})}`;
const clean = (s:string) => s.replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7E]/g,' ');
async function browserAsset(path:string) {
  const response=await fetch(path); if(!response.ok)throw new Error('Could not load quotation assets. Please try again.');
  const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);
}
/** Same validated quote drives screen, WhatsApp and PDF; no supplier margins. */
export async function createNamakPdf(q:NamakQuote,guide=false,load=browserAsset):Promise<jsPDF> {
  const {jsPDF}=await import('jspdf');
  const paths=['/quotation-assets/Outfit-Regular.ttf','/quotation-assets/Outfit-Semibold.ttf','/quotation-assets/Cormorant.ttf','/namak-assets/logo.png','/namak-assets/exterior.jpg',...(guide?['/namak-assets/bedroom.jpg','/namak-assets/seating.jpg']:[])];
  const a=Object.fromEntries(await Promise.all(paths.map(async p=>[p,await load(p)])));
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
  for(const [file,font,weight] of [['Outfit-Regular.ttf','Outfit','normal'],['Outfit-Semibold.ttf','Outfit','bold'],['Cormorant.ttf','Cormorant','normal']]){doc.addFileToVFS(file,a['/quotation-assets/'+file]);doc.addFont(file,font,weight);}
  const ink='#302A22',muted='#72695D',gold='#9F7934',cream='#FBF8F0',line='#DED3BC';
  const text=(s:string,x:number,y:number,size=9,color=ink,bold=false,width=180)=>{doc.setFont('Outfit',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);const ls=doc.splitTextToSize(clean(s),width);doc.text(ls,x,y,{baseline:'top',lineHeightFactor:1.25});return ls.length*size*.3528*1.25;};
  const title=(s:string,x:number,y:number,size=26)=>{doc.setFont('Cormorant','normal');doc.setFontSize(size);doc.setTextColor(ink);doc.text(clean(s),x,y,{baseline:'top'});};
  const rect=(x:number,y:number,w:number,h:number,fill=cream)=>{doc.setFillColor(fill);doc.setDrawColor(line);doc.setLineWidth(.2);doc.rect(x,y,w,h,'FD');};
  const photo=(p:string,x:number,y:number,w:number,h:number,contain=false)=>{const image=a['/namak-assets/'+p];const dim=doc.getImageProperties(image);const scale=contain?Math.min(w/dim.width,h/dim.height):Math.max(w/dim.width,h/dim.height);const iw=dim.width*scale,ih=dim.height*scale;doc.saveGraphicsState();doc.rect(x,y,w,h,null);doc.clip();doc.discardPath();doc.addImage(image,p.endsWith('png')?'PNG':'JPEG',x+(w-iw)/2,y+(h-ih)/2,iw,ih);doc.restoreGraphicsState();};
  const header=(page:number)=>{doc.setFillColor(cream);doc.rect(0,0,210,297,'F');doc.setFillColor(gold);doc.rect(0,0,210,2,'F');photo('logo.png',14,7,34,25,true);text('THE TOURISM EXPERTS',118,11,9,ink,true,78);text('Private stay quotation | Rann of Kutch',118,17,8,muted,false,78);text(QUOTATION_CONTACT.phone+' | '+QUOTATION_CONTACT.email,118,22,7,muted,false,78);doc.setDrawColor(line);doc.line(14,35,196,35);doc.line(14,279,196,279);text('NAMAK RESORT | namakrannofkutch.com',14,283,7,gold,true);text(`Personalised quotation  /  ${page}${guide?' of 2':' of 1'}`,144,283,7,muted,false,52);};
  doc.setProperties({title:`Namak quotation - ${clean(q.guestName||'Guest')}`,author:QUOTATION_CONTACT.name,subject:'Namak accommodation quotation'});
  header(1);text('A BOUTIQUE RANN UTSAV STAY',14,40,8,gold,true);title('Your Namak stay.',14,46,29);
  text(q.guestName?`Prepared for ${q.guestName}`:'Prepared for our guest',14,60,9,ink,true,135);
  if(q.reference)text(`Ref: ${q.reference}`,151,59,8,muted,false,45);
  photo('exterior.jpg',14,70,182,48);
  const cat=NAMAK_CATEGORIES[q.category];
  title(cat.name,14,124,22);text(`${cat.area} | ${q.rooms} ${q.category==='darbari'?'suite(s)':'tent(s)'} | ${q.nights} night(s) | ${q.guests} guests`,14,134,9,muted);
  rect(14,144,182,18,'#F1E8D5');text('CHECK-IN',19,147,7,gold,true);text(namakDate(q.checkIn),19,153,10,ink,true);text('CHECKOUT',83,147,7,gold,true);text(namakDate(q.checkOut),83,153,10,ink,true);text('EXTRA GUESTS',148,147,7,gold,true);text(`${q.extraPersons} total across rooms`,148,153,9,ink,false,43);
  // Group consecutive nights with identical tariffs so even a long quote remains a single page.
  const groups:{first:string;last:string;count:number;perRoom:number;label:string;total:number}[]=[];
  for(const n of q.nightly){const g=groups[groups.length-1];if(g&&g.perRoom===n.perRoom&&g.label===n.label){g.last=n.date;g.count++;g.total+=n.roomTotal;}else groups.push({first:n.date,last:n.date,count:1,perRoom:n.perRoom,label:n.label,total:n.roomTotal});}
  text('YOUR ACCOMMODATION',14,170,8,gold,true);let y=177;
  for(const g of groups){text(`${namakDate(g.first)}${g.count>1?' - '+namakDate(g.last):''} | ${g.label}`,14,y,8,ink,false,111);text(`${money(g.perRoom)} x ${g.count}N x ${q.rooms}`,14,y+4,7,muted,false,111);text(money(g.total),131,y+1,9,ink,true,65);y+=9;}
  // At most five date-band groups in a 28-night stay; totals sit independently on the right.
  const totalY=Math.max(199,y+2);let ty=totalY;
  if(q.discount){text(`Room discount (${q.discountPct}%)`,116,ty,8,muted,false,46);text('-'+money(q.discount),164,ty,8,ink,false,32);ty+=6;}
  if(q.extras){text(`Extra guests (${q.extraPersons} x ${q.nights}N)`,116,ty,8,muted,false,46);text(money(q.extras),164,ty,8,ink,false,32);ty+=6;}
  if(q.gst!==null){text(`GST (${q.gstPct}%)`,116,ty,8,muted,false,46);text(money(q.gst),164,ty,8,ink,false,32);ty+=6;}
  rect(116,ty+1,80,17,'#EEDFBF');text(q.gst===null?'STAY TOTAL + APPLICABLE GST':'GRAND TOTAL',120,ty+4,7,gold,true,72);text(money(q.total),120,ty+9,15,ink,true,72);
  text('INCLUDED IN YOUR STAY',14,totalY,8,gold,true,95);let iy=totalY+7;for(const item of q.inclusions){iy+=text('- '+item,14,iy,8,muted,false,94)+2;}
  const noteY=Math.max(ty+22,iy+3);text(q.category==='darbari'?'Transfer routes and sightseeing are as per your confirmed itinerary.':'Lunch, transport and sightseeing are not included in this quotation.',14,noteY,7.5,ink,false,182);
  text('Subject to availability. Confirm room capacity, child charges, check-in/out timings, payment and cancellation terms before booking. Planned imagery is illustrative; category layouts may vary.',14,noteY+7,7,muted,false,182);
  if(guide){doc.addPage();header(2);text('THE STAY GUIDE',14,41,8,gold,true);title('A little more of Namak.',14,47,29);photo('bedroom.jpg',14,64,112,60);photo('seating.jpg',130,64,66,60);text('Approved planned interiors; photographs are illustrative.',14,127,7,muted);
    let cy=139; for(const c of Object.values(NAMAK_CATEGORIES)){rect(14,cy,182,19,'#FFFFFF');text(c.name,19,cy+4,11,ink,true,65);text(`${c.area} | ${c.inventory} ${c.inventory===1?'suite':'tents'}`,19,cy+11,8,muted,false,65);text(`${money(c.base)} + GST / night`,101,cy+4,10,gold,true,90);text(`2 guests | Extra person ${money(c.extra)} + GST / night`,101,cy+11,7,muted,false,90);cy+=22;}
    text('Standard tariffs above. Premium / Super Premium: + INR 1,500 on Nov 22-25 and Feb 18-21; + INR 3,000 on Dec 18-31 and Jan 20-23. Supplements apply per tent, per night, plus GST. Darbari has no date supplement.',14,207,7.5,muted,false,182);
    text('SUGGESTED PLACES TO EXPLORE',14,228,8,gold,true);text('White Rann  /  Road to Heaven  /  Hodka  /  Nirona',14,236,11,ink,true);text('Ideas for planning your Kutch visit, not a scheduled or included tour. Transport, entry permits and guides are quoted separately unless expressly included in your confirmed Darbari itinerary.',14,244,8,muted,false,182);
    text('Premium & Super Premium: breakfast, hi-tea, dinner and a cultural programme. Darbari: all meals and confirmed itinerary privileges. Programme timings and booking conditions are confirmed by reservations.',14,259,7.5,muted,false,182);
  }
  return doc;
}
export async function downloadNamakPdf(q:NamakQuote,guide=false){const doc=await createNamakPdf(q,guide);const name=clean(q.guestName||'Guest').replace(/[^A-Za-z0-9 -]/g,'').trim().slice(0,60)||'Guest';doc.save(`Namak Quotation - ${name}.pdf`);}
