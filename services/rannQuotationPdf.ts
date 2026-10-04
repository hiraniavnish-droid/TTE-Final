import { quoteTentCity, TC_BASE, TC_SURCHARGE, TC_SUITE, TC_SEASON, tcTier, isSuite, type TCTentType } from './rannUtsavRates';
import { addLocalDays } from './rannItinerary';
import { BUDGET_KUTCH_PACKAGES, ROOM_PHOTOS, ROOM_FEATURES, ROOM_FEATURE_SOURCE, QUOTATION_CONTACT, TRANSFERS, quotationCompactItinerary, type BudgetKutchPackage } from './rannQuotationContent';
import { quotationDateEvent, quotationDateOptions, dateKey } from './rannQuotationDates';
import type { jsPDF } from 'jspdf';

export interface RannQuotationInput {
  guestName: string; reference?: string; checkIn: Date; nights: 1 | 2 | 3;
  category: TCTentType; rooms: number; single: boolean; extraMattresses: number;
  childrenUnder6?: number; discountPct: number; optionCategories?: TCTentType[];
}
export interface ClientPrice {
  roomRent: number; discountPct: number; discountAmount: number;
  extras: { label: string; amount: number; note?: string }[];
  subtotal: number; gst: number; total: number;
}
export interface RannQuotationModel extends RannQuotationInput {
  checkOut: Date; guests: number; price: ClientPrice; roomCalculation: string;
  alternatives: { category: TCTentType; total: number; difference: number; extraMattresses: number }[];
  budgetPackages: BudgetKutchPackage[];
}
// Currency spelled out because the supplied font subsets lack a rupee glyph.
// Selectable INR text is preferable to a missing-glyph square in a guest PDF.
const money = (value: number) => `INR ${Math.round(value).toLocaleString('en-IN')}`;
const dateLabel = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const printable = (s: string) => s.replace(/[\u2010-\u2015]/g, '-').replace(/\u00a0/g, ' ');

export function buildRannQuotationModel(input: RannQuotationInput, budgetPackages = BUDGET_KUTCH_PACKAGES): RannQuotationModel {
  if (!ROOM_PHOTOS[input.category]) throw new Error('Choose a valid room category.');
  if (![1, 2, 3].includes(input.nights)) throw new Error('Tent City supports one, two or three nights.');
  if (!(input.checkIn instanceof Date) || !Number.isFinite(input.checkIn.getTime()) || input.checkIn < TC_SEASON.start || input.checkIn > TC_SEASON.end) throw new Error('Check-in must fall within the 2026-27 Tent City season.');
  for (const [label, value, minimum] of [['Rooms', input.rooms, 1], ['Extra mattresses', input.extraMattresses, 0], ['Children', input.childrenUnder6 ?? 0, 0]] as const) {
    if (!Number.isInteger(value) || value < minimum) throw new Error(`${label} must be a whole number of at least ${minimum}.`);
  }
  if (!Number.isFinite(input.discountPct) || input.discountPct < 0 || input.discountPct > 100) throw new Error('Discount must be between 0% and 100%.');
  const suite = isSuite(input.category);
  const single = input.single && !suite;
  const result = quoteTentCity({ tent: input.category, checkIn: input.checkIn, nights: input.nights, rooms: input.rooms, single, extraMattress: input.extraMattresses, discountPct: input.discountPct, commissionPct: 0 });
  const price: ClientPrice = {
    roomRent: result.roomRent, discountPct: result.discountPct, discountAmount: result.clientDiscountAmount,
    extras: result.extras.map(e => ({ ...e })), subtotal: result.clientBeforeTax, gst: result.clientGst, total: result.sellingPrice,
  };
  const guests = (suite ? TC_SUITE[input.category].pax : single ? 1 : 2) * input.rooms + input.extraMattresses;
  const alternatives = (Object.keys(TC_BASE) as TCTentType[]).filter(category => category !== input.category).map(category => {
    // Preserve the guest count when moving from a four-person suite to tents.
    const extraMattresses = Math.max(0, guests - (single ? 1 : 2) * input.rooms);
    const quote = quoteTentCity({ tent: category, checkIn: input.checkIn, nights: input.nights, rooms: input.rooms, single, extraMattress: extraMattresses, discountPct: input.discountPct, commissionPct: 0 });
    return { category, total: quote.sellingPrice, difference: quote.sellingPrice - price.total, extraMattresses };
  });
  const packageRate = suite ? TC_SUITE[input.category].rates[input.nights] : TC_BASE[input.category][input.nights] + TC_SURCHARGE[tcTier(input.checkIn)][input.nights];
  const roomCalculation = suite
    ? `${money(packageRate)} per suite for ${input.nights} night(s) x ${input.rooms} suite(s)`
    : `${money(packageRate)} per person for ${input.nights} night(s) x 2 x ${input.rooms} room(s)${single ? ' x 75% single occupancy' : ''}`;
  return { ...input, single, checkOut: addLocalDays(input.checkIn, input.nights), guests, price, roomCalculation, alternatives, budgetPackages: budgetPackages.filter(p => Number.isFinite(p.total) && p.total > 0) };
}

const assetCache = new Map<string, Promise<string>>();
async function asset(name: string): Promise<string> {
  if (!assetCache.has(name)) {
    const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
    const request = fetch(`${base}quotation-assets/${encodeURIComponent(name)}`).then(async response => {
      if (!response.ok) throw new Error(`Could not load quotation asset: ${name}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    }).catch(error => { assetCache.delete(name); throw error; });
    assetCache.set(name, request);
  }
  return assetCache.get(name)!;
}

export async function createRannQuotationPdf(model: RannQuotationModel, loadAsset: (name: string) => Promise<string> = asset): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf');
  const days = quotationCompactItinerary(model.nights);
  const room = ROOM_PHOTOS[model.category];
  const payLogos = ['pay-razorpay.jpg', 'pay-visa.jpg', 'pay-amex.jpg', 'pay-rupay.jpg', 'pay-upi.jpg', 'pay-gpay.jpg'];
  const multiple = (model.optionCategories?.length ?? 0) > 1;
  const optionModels = multiple ? model.optionCategories!.map(category => buildRannQuotationModel({ ...model, category, optionCategories: undefined })) : [];
  const options = [
    { category: model.category, total: model.price.total, difference: 0, extraMattresses: model.extraMattresses, selected: !multiple },
    ...model.alternatives.map(a => ({ ...a, selected: false })),
  ].filter(a => !isSuite(a.category));
  const imageNames = new Set(['strip-header.jpg', 'rann-utsav-logo.png', 'logo-un-tourism.png', 'hero-panoramic-v2.png', 'hero-couple-packages.jpg', 'brochure-closing-photo.jpg', 'rann-utsav-white.png', 'gujarat-white.png', 'un-tourism-white.png', 'dhordo-tent-city.jpg', ...payLogos, room.hero, ...room.details, ...days.flatMap(day => day.photos), ...options.flatMap(a => [ROOM_PHOTOS[a.category].hero, ...ROOM_PHOTOS[a.category].details]), ...model.budgetPackages.map(p => p.photo)]);
  const loaded = await Promise.all(['Outfit-Regular.ttf', 'Outfit-Semibold.ttf', 'Cormorant.ttf', ...imageNames].map(async name => [name, await loadAsset(name)] as const));
  const assets = Object.fromEntries(loaded);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('Outfit-Regular.ttf', assets['Outfit-Regular.ttf']); doc.addFont('Outfit-Regular.ttf', 'Outfit', 'normal');
  doc.addFileToVFS('Outfit-Semibold.ttf', assets['Outfit-Semibold.ttf']); doc.addFont('Outfit-Semibold.ttf', 'Outfit', 'bold');
  doc.addFileToVFS('Cormorant.ttf', assets['Cormorant.ttf']); doc.addFont('Cormorant.ttf', 'Cormorant', 'normal');
  doc.setProperties({ title: `Rann Utsav quotation - ${model.guestName || 'Guest'}`, author: QUOTATION_CONTACT.name, subject: 'Personalised accommodation quotation' });
  const ink = '#251A30', muted = '#6A6071', rose = '#C9184A', pale = '#FBF1F4', line = '#E8DBE1';
  const sand = '#B68B46', warm = '#F8F4ED', green = '#34634D';
  let y = 0;
  let formal = true;
  const darkPages = new Set<number>();
  const text = (value: string, x: number, top: number, size = 9, color = ink, bold = false, width = 182, leading = 1.25) => {
    doc.setFont('Outfit', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    const lines: string[] = doc.splitTextToSize(printable(value), width);
    doc.text(lines, x, top, { baseline: 'top', lineHeightFactor: leading });
    return lines.length * size * .3528 * leading;
  };
  const measure = (value: string, width: number, size: number, bold = false, leading = 1.25) => {
    doc.setFont('Outfit', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    return doc.splitTextToSize(printable(value), width).length * size * .3528 * leading;
  };
  const serif = (value: string, x: number, top: number, size = 24, color = ink, width = 182) => {
    doc.setFont('Cormorant', 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    const lines = doc.splitTextToSize(printable(value), width);
    doc.text(lines, x, top, { baseline: 'top', lineHeightFactor: 1.08 });
    return lines.length * size * .3528 * 1.08;
  };
  const photo = (name: string, x: number, top: number, width: number, height: number, contain = false) => {
    const image = assets[name], dimensions = doc.getImageProperties(image);
    const scale = contain ? Math.min(width / dimensions.width, height / dimensions.height) : Math.max(width / dimensions.width, height / dimensions.height);
    const w = dimensions.width * scale, h = dimensions.height * scale;
    doc.saveGraphicsState(); doc.rect(x, top, width, height, null); doc.clip(); doc.discardPath();
    const focalY = name === 'exp-garba-dandiya.jpg' ? .15 : name === 'hero-panoramic-v2.png' ? .6 : .5;
    doc.addImage(image, name.endsWith('.png') ? 'PNG' : 'JPEG', x + (width - w) / 2, top + (height - h) * focalY, w, h, name, 'FAST');
    doc.restoreGraphicsState();
  };
  const card = (x: number, top: number, width: number, height: number, fill = '#FFFFFF', border = line, shadow = true) => {
    if (shadow && !formal) { doc.setFillColor('#F1EBEE'); doc.roundedRect(x + .8, top + 1.1, width, height, 2.5, 2.5, 'F'); }
    doc.setLineWidth(.25); doc.setDrawColor(border); doc.setFillColor(fill);
    if (formal) doc.rect(x, top, width, height, 'FD');
    else doc.roundedRect(x, top, width, height, 2.5, 2.5, 'FD');
  };
  const header = (first = false) => {
    if (!first) doc.addPage();
    photo('strip-header.jpg', 0, 0, 210, 4);
    photo('rann-utsav-logo.png', 14, 9, 39, 12, true);
    photo('logo-un-tourism.png', 139, 9, 57, 13, true);
    doc.setDrawColor(line); doc.line(14, 26, 196, 26);
  };
  const page = (eyebrow: string, title: string) => {
    formal = !['Discover the Rann & Kutch', 'Booking information', 'Continued'].includes(title);
    header(); text(eyebrow.toUpperCase(), 14, 32, 7, rose, true);
    const h = serif(title, 14, 39, 24); y = 39 + h + 7;
  };
  const paragraph = (value: string, size = 8.5, color = muted) => {
    const h = measure(value, 182, size);
    if (y + h + 4 > 272) page('Your quotation', 'Continued');
    y += text(value, 14, y, size, color) + 4;
  };
  const button = (label: string, x: number, top: number, width: number, url: string, fill = rose, color = '#FFFFFF') => {
    doc.setFillColor(fill); doc.rect(x, top, width, 13, 'F');
    text(label, x + 5, top + 4, 8.5, color, true, width - 10);
    doc.link(x, top, width, 13, { url });
  };
  const featureIcon = (label: string, x: number, top: number) => {
    doc.setDrawColor(sand); doc.setLineWidth(.28);
    const l = label.toLowerCase();
    if (/bed/.test(l)) { doc.rect(x, top + 1.6, 4.5, 2, 'S'); doc.rect(x + .5, top + 1, 1.3, .7, 'S'); doc.line(x, top, x, top + 4.2); doc.line(x + 4.5, top + 1.6, x + 4.5, top + 4.2); }
    else if (/air|conditioning/.test(l)) { doc.rect(x, top + .4, 4.5, 1.8, 'S'); [1, 2.3, 3.6].forEach(dx => doc.line(x + dx, top + 2.8, x + dx, top + 4)); }
    else if (/coffee/.test(l)) { doc.rect(x + .5, top + 1, 3, 2.6, 'S'); doc.rect(x + 3.5, top + 1.5, 1, 1.3, 'S'); doc.line(x, top + 4, x + 4.5, top + 4); }
    else if (/transfer/.test(l)) { doc.rect(x, top + .7, 4.5, 2.5, 'S'); doc.line(x + .5, top + 1.6, x + 4, top + 1.6); doc.circle(x + 1, top + 3.6, .5, 'S'); doc.circle(x + 3.5, top + 3.6, .5, 'S'); }
    else if (/check/.test(l)) { doc.rect(x, top + .5, 4, 3.5, 'S'); doc.line(x + .7, top + 2.3, x + 1.6, top + 3.2); doc.line(x + 1.6, top + 3.2, x + 3.4, top + 1.2); }
    else if (/sitting|sofa|chairs|living/.test(l)) { doc.rect(x + .7, top + .4, 3, 2, 'S'); doc.rect(x, top + 2, 4.5, 1.5, 'S'); doc.line(x + .6, top + 3.5, x + .6, top + 4.2); doc.line(x + 3.9, top + 3.5, x + 3.9, top + 4.2); }
    else if (/bath|toiletries/.test(l)) { doc.rect(x + .5, top + 1.3, 3.5, 2.5, 'S'); doc.line(x + .5, top + .4, x + 2.7, top + .4); doc.line(x + .5, top + .4, x + .5, top + 1.3); }
    else { doc.line(x, top + 1.3, x + 2.3, top); doc.line(x + 2.3, top, x + 4.5, top + 1.3); doc.rect(x + .5, top + 1.3, 3.5, 2.8, 'S'); }
  };
  const whatsapp = `${QUOTATION_CONTACT.whatsapp}?text=${encodeURIComponent(`Hello, I'd like to discuss my Rann Utsav quotation${model.reference ? ` (${model.reference})` : ''}.`)}`;

  // 1. A compact editorial cover with an actual destination introduction.
  header(true);
  photo('hero-panoramic-v2.png', 14, 33, 182, 44);
  serif(multiple ? 'Your Rann Utsav stay options' : 'Your Rann Utsav escape', 14, 82, 27, ink);
  text('THE WHITE RANN / DHORDO / SEASON 2026-27', 14, 94, 6.5, muted, true);
  y = 103;
  text('PREPARED ESPECIALLY FOR', 14, y, 6.5, rose, true); y += 5;
  let guestSize = 11;
  const guestName = model.guestName.trim() || 'Our guest';
  while (measure(guestName, 182, guestSize, true) > 17 && guestSize > 8) guestSize -= .5;
  y += text(guestName, 14, y, guestSize, ink, true) + 4;
  if (model.reference) y += text(`Quotation reference: ${model.reference}`, 14, y, 7, muted) + 3;
  const metaY = y;
  card(14, metaY, 182, 19, warm, '#E8DECE', false);
  const meta = [
    ['CHECK-IN', dateLabel(model.checkIn)], ['CHECK-OUT', dateLabel(model.checkOut)],
    ['YOUR STAY', `${model.nights} nights / ${model.nights + 1} days`],
    ['YOUR PARTY', `${model.rooms} ${isSuite(model.category) ? 'suite(s)' : 'room(s)'} / ${model.guests} guests`],
  ];
  meta.forEach(([label, value], i) => {
    const x = 19 + i * 45;
    text(label, x, metaY + 4, 6.1, sand, true, 40);
    text(value, x, metaY + 10, 8, ink, true, 40);
    if (i < 3) { doc.setDrawColor('#E8DECE'); doc.line(x + 40, metaY + 4, x + 40, metaY + 15); }
  });
  y = metaY + 25;
  const stayTop = y;
  if (!multiple) {
  text('YOUR ACCOMMODATION', 14, y, 7, rose, true, 83); y += 5;
  const catH = text(model.category, 14, y, 11, ink, true, 83); y += catH + 4;
  photo(room.hero, 14, y, 83, 44); y += 47;
  if (room.details.length) { room.details.slice(0, 2).forEach((name, i) => photo(name, 14 + i * 43, y, 40, 19)); y += 23; }
  const features = ROOM_FEATURES[model.category];
  const featureHeight = 9 + Math.ceil(features.highlights.length / 2) * 4.6;
  card(14, y, 83, featureHeight, warm, '#E8DECE', false);
  text(`YOUR ROOM / ${features.area}`, 18, y + 3, 7.4, sand, true, 75);
  features.highlights.forEach((feature, i) => {
    const fx = 18 + (i % 2) * 38, fy = y + 9 + Math.floor(i / 2) * 4.6;
    featureIcon(feature, fx, fy);
    text(feature, fx + 6.5, fy + .4, 6.7, ink, false, 31);
  });
  y += featureHeight + 3;
  text(`${isSuite(model.category) ? 'Suite occupancy' : model.single ? 'Single occupancy' : 'Double occupancy'}${model.childrenUnder6 ? ` / ${model.childrenUnder6} ${model.childrenUnder6 === 1 ? 'child' : 'children'} under 6 free` : ''}`, 14, y, 7, muted, false, 83);

  doc.setDrawColor('#CFC9C3'); doc.setLineWidth(.3); doc.rect(11, stayTop - 3, 89, y + 9 - stayTop, 'S');

  const priceX = 105, priceW = 91;
  const rows: [string, number, boolean, string?][] = [['Accommodation', model.price.roomRent, true]];
  if (model.price.discountPct > 0) rows.push([`Discount (${model.price.discountPct}%)`, model.price.discountAmount, false, '- ']);
  model.price.extras.forEach(e => rows.push([e.label, e.amount, false]));
  rows.push(['Subtotal', model.price.subtotal, false], ['GST @ 18%', model.price.gst, false]);
  const calculationH = measure(model.roomCalculation, 79, 7.4);
  const rowHeights = rows.map(([label]) => Math.max(7.5, measure(label, 45, 8) + 2));
  const priceH = 16 + calculationH + 5 + rowHeights.reduce((a, b) => a + b, 0) + 29;
  card(priceX, stayTop - 3, priceW, priceH + 3, '#F2F1EC', '#CEC7BD', false);
  text('YOUR PACKAGE PRICE', priceX + 6, stayTop + 6, 8, rose, true, 79);
  let py = stayTop + 15;
  py += text(model.roomCalculation, priceX + 6, py, 7.4, muted, false, 79) + 5;
  rows.forEach(([label, amount, bold, prefix], i) => {
    text(label, priceX + 6, py, 8, prefix ? rose : ink, bold, 45);
    doc.setFont('Outfit', bold ? 'bold' : 'normal'); doc.setFontSize(8); doc.setTextColor(prefix ? rose : ink);
    doc.text((prefix || '') + money(amount), priceX + priceW - 6, py, { align: 'right', baseline: 'top' });
    py += rowHeights[i];
    if (label === 'Subtotal') { doc.setDrawColor('#E7C9D4'); doc.line(priceX + 6, py - 1, priceX + priceW - 6, py - 1); }
  });
  py += 3;
  doc.setFillColor(ink); doc.rect(priceX + 5, py, priceW - 10, 20, 'F');
  text('TOTAL PAYABLE / INCLUDING GST', priceX + 10, py + 4, 6.2, '#FFFFFF', true, 71);
  text(money(model.price.total), priceX + 10, py + 10, 16, '#FFFFFF', true, 71);
  const noteTop = Math.max(y + 9, stayTop + priceH + 7);
  text(`A personalised package for the party shown above. ${model.price.discountPct > 0 ? 'Extra mattress charges are not discountable. ' : ''}Subject to availability at booking.`, 14, noteTop, 7.4, muted);
  } else {
    text('CHOOSE YOUR TENT / SAME DATES AND GUESTS', 14, stayTop, 7, rose, true);
    const optionRowHeight = Math.min(30, (270 - stayTop - 18) / optionModels.length);
    optionModels.forEach((m, index) => {
      const top = stayTop + 8 + index * optionRowHeight;
      card(14, top, 182, optionRowHeight - 3, '#F2F1EC', '#CEC7BD', false);
      photo(ROOM_PHOTOS[m.category].hero, 15, top + 1, 32, optionRowHeight - 5);
      text(m.category, 52, top + 3, 9.5, ink, true, 92);
      text(ROOM_FEATURES[m.category].comparison.split('\n')[0], 52, top + 9, 7, muted, false, 92);
      text(money(m.price.total), 148, top + 4, 12, ink, true, 44);
      const extras = m.price.extras.reduce((sum, item) => sum + item.amount, 0);
      text(`Room ${money(m.price.roomRent)}${m.price.discountAmount > 0 ? ` - discount ${money(m.price.discountAmount)}` : ''} / Extras ${money(extras)} / GST ${money(m.price.gst)}`, 52, top + 16, 6.6, muted, false, 138);
    });
    text(`All totals include GST${model.discountPct > 0 ? ` and ${model.discountPct}% discount on accommodation` : ''}. Same ${model.rooms} room(s), ${model.guests} guests and ${model.nights} nights. Options are subject to availability; no category has been reserved.`, 14, stayTop + 10 + optionModels.length * optionRowHeight, 7, muted, false, 182);
  }

  // 2. Two service panels and a paired route/timetable board.
  page('Included in your stay', 'Meals, experiences & transfers');
  const servicesY = 59;
  card(14, servicesY, 112, 103, '#FFFFFF');
  card(132, servicesY, 64, 103, warm, '#E8DECE');
  doc.setFillColor(ink); doc.rect(20, servicesY + 6, 5, 5, 'F');
  text('+', 21.3, servicesY + 6.4, 9, '#FFFFFF', true, 4);
  text('Included in your package', 29, servicesY + 6, 10, ink, true, 89);
  const inclusions = [
    `${model.nights} night(s) in ${multiple ? 'your chosen quoted tent category' : model.category}; ${model.rooms} ${isSuite(model.category) ? 'suite(s)' : 'room(s)'}.`,
    'Meals from arrival lunch to departure breakfast; morning tea / high tea as scheduled.',
    'Scheduled Bhuj AC coach transfers, White Rann sunset and the cultural programme.',
    'Yoga, craft market, art gallery and activity zones as per the programme.',
    ...(model.nights >= 2 ? ['White Rann sunrise; Kala Dungar via Gandhi Nu Gaam.'] : []),
    ...(model.nights === 3 ? ['Dholavira and Road Through Heaven excursion.'] : []),
    'Departure-day Temple and Kutch Museum visit, subject to transfers and opening days.',
  ];
  let sy = servicesY + 19;
  inclusions.forEach(v => {
    doc.setFillColor(green); doc.circle(21, sy + 1.6, .65, 'F');
    sy += text(v, 25, sy, 8.3, ink, false, 94) + 3;
  });
  text('Not included', 138, servicesY + 6, 10, sand, true, 52);
  let ey = servicesY + 19;
  ['Travel to / from Bhuj.', 'Private or out-of-schedule transfers.', 'Paid adventures, spa, shopping and personal expenses.', 'Anything not expressly included in the package.'].forEach((v, i) => {
    text(`0${i + 1}`, 138, ey, 7, sand, true, 7);
    ey += text(v, 149, ey, 8.2, muted, false, 40) + 5;
  });
  text('YOUR TRANSFER SCHEDULE', 14, 170, 7, rose, true);
  const routeTop = 179;
  card(14, routeTop, 88, 60, '#EDE4D8', '#D5C6B3');
  card(108, routeTop, 88, 60, '#EDE4D8', '#D5C6B3');
  text('ARRIVAL COACHES', 20, routeTop + 6, 6.5, rose, true, 76);
  text('Bhuj to Tent City', 20, routeTop + 12, 12, ink, true, 76);
  text('Airport / Railway Station / Dhordo', 20, routeTop + 19, 7, muted, false, 76);
  // A route line links origin and destination without introducing a chart legend.
  doc.setDrawColor('#D7A6B7'); doc.setLineWidth(.5); doc.line(20, routeTop + 30, 94, routeTop + 30);
  doc.setFillColor(rose); doc.circle(20, routeTop + 30, 1.2, 'F'); doc.circle(94, routeTop + 30, 1.2, 'F');
  const routeDistance = (centerX: number) => {
    doc.setFont('Outfit', 'bold'); doc.setFontSize(8.5); doc.setTextColor(ink);
    doc.text('85 km / approx. 1 hr 45 min', centerX, routeTop + 25, { align: 'center', baseline: 'top' });
  };
  routeDistance(58);
  TRANSFERS.arrival.forEach((time, i) => {
    const x = 20 + (i % 3) * 25, top = routeTop + 34 + Math.floor(i / 3) * 10;
    card(x, top, 23, 8, '#FFFFFF', '#E7C9D4', false); text(time, x + 2.5, top + 2, 7.8, rose, true, 19);
  });
  text('DEPARTURE COACHES', 114, routeTop + 6, 6.5, rose, true, 76);
  text('Tent City to Bhuj', 114, routeTop + 12, 12, ink, true, 76);
  text('Airport / Railway Station drop', 114, routeTop + 19, 7, muted, false, 76);
  routeDistance(152);
  doc.setDrawColor('#D7A6B7'); doc.setLineWidth(.5); doc.line(114, routeTop + 30, 188, routeTop + 30);
  doc.setFillColor(rose); doc.circle(114, routeTop + 30, 1.2, 'F'); doc.circle(188, routeTop + 30, 1.2, 'F');
  TRANSFERS.departure.forEach((time, i) => {
    const x = 114 + i * 39;
    card(x, routeTop + 34, 36, 13, '#FFFFFF', '#CFC9C3', false);
    text(time, x + 5, routeTop + 38, 11, ink, true, 26);
  });
  text('Early departure may miss breakfast\nand the complimentary Bhuj visits.', 114, routeTop + 51, 7.1, muted, false, 76);
  text('GOOD TO KNOW', 14, 247, 6.5, sand, true);
  text('Fixed coaches: seats are first-come, first-served. Private / out-of-schedule transfers cost extra. Timings may change.', 14, 253, 7.5, muted, false, 88);
  text('Evoke Dholavira guests only: pickup 10:00 AM; departure from Tent City 9:30 AM. Confirm transfers against your onward journey.', 108, 253, 7.5, muted, false, 88);

  // 3. Every stay length fits in a single, deliberately composed programme page.
  page('Your complete programme', 'Discover the Rann & Kutch');
  text(`${model.nights} nights / ${model.nights + 1} days / ${dateLabel(model.checkIn)} to ${dateLabel(model.checkOut)}`, 14, 54, 8, muted);
  const gridTop = 64;
  days.forEach((day, index) => {
    const stacked = days.length === 2;
    const x = stacked ? 14 : 14 + (index % 2) * 94;
    const top = gridTop + (stacked ? index * 99 : Math.floor(index / 2) * 104);
    const width = stacked ? 182 : 88, height = stacked ? 93 : 98;
    card(x, top, width, height, '#FFFFFF');
    const dayDate = addLocalDays(model.checkIn, index);
    if (stacked) photo(day.photos[0], x + 130, top + 5, 47, 32);
    else photo(day.photos[0], x + 1, top + 1, width - 2, 20);
    const titleTop = top + (stacked ? 6 : 25);
    text(`DAY ${index + 1} / ${dateLabel(dayDate)}`, x + 5, titleTop, 6.8, rose, true, stacked ? 120 : 78);
    const titleH = text(day.title, x + 5, titleTop + 5, 10, ink, true, stacked ? 120 : 78);
    const rowTop = titleTop + 5 + titleH + 4;
    const timeW = stacked ? 30 : 24, bodyW = stacked ? 85 : 49;
    const timeX = x + 5, bodyX = x + (stacked ? 38 : 32);
    const entries = day.entries.map(([time, activity]) => {
      const museumClosed = /Kutch Museum/.test(activity) && dayDate.getDay() === 3;
      const dholaviraClosed = /Dholavira archaeological museum/.test(activity) && dayDate.getDay() === 5;
      const displayed = museumClosed ? 'Swaminarayan Temple visit; Kutch Museum is closed on this date (Wednesday).' : dholaviraClosed ? 'Dholavira heritage site; archaeological museum is closed on this date (Friday).' : activity;
      return [time, displayed] as const;
    });
    let fontSize = 7.8;
    const required = (size: number) => entries.reduce((sum, [time, activity]) => sum + Math.max(measure(activity, bodyW, size, false, 1.16), measure(time, timeW, size - .8, false, 1.16)) + 1.4, 0);
    while (rowTop + required(fontSize) > top + height - 5 && fontSize > 7) fontSize -= .2;
    if (rowTop + required(fontSize) > top + height - 4) throw new Error('The programme needs a shorter activity description to fit its one-page layout.');
    let ry = rowTop;
    entries.forEach(([time, activity]) => {
      const th = text(time, timeX, ry, fontSize - .8, muted, false, timeW, 1.16);
      const ah = text(activity, bodyX, ry, fontSize, ink, false, bodyW, 1.16);
      ry += Math.max(th, ah) + 1.4;
    });
  });
  if (days.length === 3) {
    const top = gridTop + 104;
    card(108, top, 88, 98, warm, '#E8DECE');
    photo('dhordo-tent-city.jpg', 109, top + 1, 86, 20);
    text('A FEW TRAVEL NOTES', 114, top + 25, 7, sand, true, 76);
    text('Check-in from 12:30 PM.\nCheck-out at 9:30 AM.\n\nChoose between overlapping morning activities. Early transfers can affect meals and sightseeing.', 114, top + 34, 8.5, ink, false, 76);
  }
  text('Sunset / sunrise images are illustrative. Times may change with weather and operations. Museum closures are reflected for your dates; transfers can affect meals and sightseeing.', 14, 272, 7.2, muted, false, 182);

  // Date flexibility: event context and actual customer totals use the existing quote engine.
  if (!multiple) {
  page('A little flexibility, more possibilities', 'Find your ideal travel dates');
  const dateOptions = quotationDateOptions(model);
  card(14, 58, 182, 24, ink, ink, false);
  text('YOUR CHOSEN STAY', 20, 62, 6.5, '#E7B5C6', true);
  text(`${dateLabel(model.checkIn)} - ${dateLabel(model.checkOut)}`, 20, 68, 10, '#FFFFFF', true, 114);
  text(quotationDateEvent(model.checkIn), 20, 75, 7, '#E7B5C6', false, 114);
  text(money(model.price.total), 144, 67, 12, '#FFFFFF', true, 46);
  const monthKeys = new Map<string, Date>();
  [model.checkIn, ...dateOptions.map(o => o.date), addLocalDays(model.checkOut, -1)].forEach(d => monthKeys.set(`${d.getFullYear()}-${d.getMonth()}`, new Date(d.getFullYear(), d.getMonth(), 1)));
  const months = [...monthKeys.values()].sort((a, b) => a.getTime() - b.getTime());
  const calendarW = (182 - (months.length - 1) * 5) / months.length;
  const bandColors = { none: '#F7F6F3', s1: '#E9E1D1', s2: '#CFC5B7' };
  months.forEach((month, index) => {
    const x = 14 + index * (calendarW + 5), top = 89;
    card(x, top, calendarW, 81, '#FFFFFF', line, false);
    text(month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), x + 4, top + 4, 9, ink, true, calendarW - 8);
    const cellW = (calendarW - 8) / 7;
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((label, n) => text(label, x + 4 + n * cellW + cellW * .3, top + 13, 6, muted, true, cellW));
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= count; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day), slot = month.getDay() + day - 1;
      const cx = x + 4 + (slot % 7) * cellW, cy = top + 21 + Math.floor(slot / 7) * 10;
      const valid = date >= TC_SEASON.start && date <= TC_SEASON.end;
      const selected = dateKey(date) === dateKey(model.checkIn);
      const stay = date >= model.checkIn && date < model.checkOut;
      doc.setFillColor(valid ? bandColors[tcTier(date)] : '#F4F2F3');
      doc.rect(cx, cy, cellW - .6, 9.2, 'F');
      if (stay) { doc.setDrawColor(ink); doc.setLineWidth(.35); doc.rect(cx, cy, cellW - .6, 9.2, 'S'); }
      if (selected) { doc.setFillColor(ink); doc.circle(cx + (cellW - .6) / 2, cy + 2.35, 2.25, 'F'); }
      text(String(day), cx + (cellW - .6) / 2 - (day > 9 ? 1.5 : .8), cy + .8, 7, selected ? '#FFFFFF' : valid ? ink : '#B9B2BB', selected, cellW - 1);
      if (dateOptions.some(o => dateKey(o.date) === dateKey(date))) { doc.setDrawColor(green); doc.setLineWidth(.65); doc.line(cx + 1, cy + 8.8, cx + cellW - 1.6, cy + 8.8); }
      const event = valid ? quotationDateEvent(date) : 'Season dates';
      const special = event.split(' + ').filter(e => e !== 'Non-festive dates').map(e => e === 'Full-moon period' ? 'Full moon' : e === 'Diwali' ? 'Diwali week' : e === 'Christmas / New Year' ? (date.getMonth() === 11 ? 'Christmas' : 'New Year') : e).join(' / ').replace('Diwali week / Dark moon', 'Diwali / Dark moon');
      if (special) text(special, cx + .4, cy + 4.7, months.length > 2 ? 4.3 : months.length > 1 ? 4.9 : 5.5, ink, false, cellW - 1, 1.02);

    }
  });
  const bandNames = ['Standard dates', 'Date supplement I', 'Date supplement II'];
  (['none', 's1', 's2'] as const).forEach((tier, i) => {
    const x = 14 + i * 62;
    card(x, 172, 58, 16, bandColors[tier], bandColors[tier], false);
    text(bandNames[i], x + 3, 175, 7, ink, true, 52);
    text(isSuite(model.category) ? 'Suite rate stays the same' : `+ ${money(TC_SURCHARGE[tier][model.nights])} / person`, x + 3, 181, 6.5, muted, false, 52);
  });
  text('Festival and moon periods are named inside the calendar cells.', 14, 192, 7, muted);
  text('Circle: check-in. Outline: your nights. Green line: alternatives. Event windows follow the supplier calendar.', 14, 198, 7, muted);
  dateOptions.forEach((option, i) => {
    const top = 208 + i * 18;
    card(14, top, 182, 15, '#FFFFFF', line, false);
    text(`${dateLabel(option.date)} - ${dateLabel(addLocalDays(option.date, model.nights))}`, 19, top + 3, 8, ink, true, 76);
    text(option.event, 19, top + 9, 6.5, muted, false, 76);
    text(money(option.total), 101, top + 4, 10, ink, true, 43);
    text(option.difference < 0 ? `Save ${money(-option.difference)}` : option.difference > 0 ? `+ ${money(option.difference)}` : 'Same price', 147, top + 5, 7.5, option.difference < 0 ? green : muted, true, 44);
  });
  text('Same room, duration, guests, extras and discount; totals include GST. The check-in band sets the whole package rate. Supplements above are before tax; extra mattress rates may also vary. Dates are subject to availability; booking changes may attract fees.', 14, 265, 7, muted, false, 182);

  }

  // 4. All four eligible tent categories in a compact comparison grid.
  page('A stay that suits you', 'Compare your tent options');
  text(`Same dates, ${model.rooms} room(s) and ${model.guests} guests. Totals include GST${model.price.discountPct > 0 ? ` and the same ${model.price.discountPct}% accommodation discount` : ''}.`, 14, 54, 7.8, muted);
  card(14, 66, 182, 16, ink, ink, false);
  text(multiple ? `${model.nights} NIGHTS / ${dateLabel(model.checkIn)} TO ${dateLabel(model.checkOut)}` : `YOUR SELECTION / ${model.category}`, 20, 71, 8, '#FFFFFF', true, 125);
  doc.setFont('Outfit', 'bold'); doc.setFontSize(12); doc.setTextColor('#FFFFFF'); doc.text(multiple ? `${options.length} TENT OPTIONS` : money(model.price.total), 190, 70, { align: 'right', baseline: 'top' });
  options.forEach((option, index) => {
    const x = 14 + (index % 2) * 94, top = 86 + Math.floor(index / 2) * 92;
    const border = option.selected ? ink : '#CFC9C3';
    card(x, top, 88, 88, '#F2F1EC', border, false);
    const roomPhotos = ROOM_PHOTOS[option.category];
    photo(roomPhotos.hero, x + .5, top + .5, 57, 29);
    photo(roomPhotos.details[roomPhotos.details.length - 1] || roomPhotos.hero, x + 58.5, top + .5, 29, 29);
    const label = multiple ? (model.optionCategories!.includes(option.category) ? 'QUOTED TENT OPTION' : 'OTHER TENT OPTION') : option.selected ? 'YOUR SELECTED ROOM' : option.difference > 0 ? 'UPGRADE' : option.difference < 0 ? 'LOWER-PRICED OPTION' : 'ALTERNATIVE';
    text(label, x + 4, top + 32, 6, muted, true, 80);
    text(option.category, x + 4, top + 37, 9.5, ink, true, 80);
    const spec = ROOM_FEATURES[option.category];
    text(`${spec.area} / ${option.category.includes('Non-AC') ? 'Non-AC' : 'Air-conditioned'}`, x + 4, top + 43, 7.3, sand, true, 80);
    const items = spec.highlights.filter(f => !/conditioning|air-conditioned/.test(f));
    items.slice(0, 6).forEach((feature, n) => {
      const fx = x + 4 + (n % 2) * 40, fy = top + 49 + Math.floor(n / 2) * 6;
      featureIcon(feature, fx, fy);
      text(feature, fx + 6.5, fy + .4, 6.8, ink, false, 32);
    });
    doc.setDrawColor(line); doc.line(x + 4, top + 68, x + 84, top + 68);
    text(money(option.total), x + 4, top + 71, 12, ink, true, 80);
    const note = multiple ? 'Total for your entire stay / includes GST' : option.selected ? 'Included in your quotation' : option.difference > 0 ? `Upgrade: + ${money(option.difference)}` : option.difference < 0 ? `Save ${money(-option.difference)} on your stay` : 'Same total for your stay';
    text(note, x + 4, top + 80, 7, option.difference < 0 ? green : muted, true, 80);
    if (option.extraMattresses !== model.extraMattresses) text(`Includes ${option.extraMattresses} extra mattresses.`, x + 4, top + 85, 6, muted, false, 80);
  });
  text('Changing to a lower category after confirmation may attract the supplier change fee.', 14, 269, 7, muted);

  text('Room features: supplier accommodation guide', 14, 275, 6, muted);
  doc.link(14, 274, 80, 4, { url: ROOM_FEATURE_SOURCE });

  // 5. Policies with a clear refund scale, change fees and travel requirements.
  page('Confidence before confirmation', 'Booking information');
  text('CANCELLATION & REFUNDS', 14, 59, 7, rose, true);
  const refunds = [
    ['90%', 'REFUND', '30+ days before arrival', '#EDF4EF', green],
    ['60%', 'REFUND', '15-29 days before arrival', warm, sand],
    ['0%', 'REFUND', 'Under 15 days before arrival', pale, rose],
  ];
  refunds.forEach(([amount, label, timing, fill, color], i) => {
    const x = 14 + i * 62;
    card(x, 67, 58, 37, fill);
    text(amount, x + 6, 72, 23, color, true, 46);
    text(label, x + 6, 87, 6.5, color, true, 46);
    text(timing, x + 6, 95, 7.3, ink, false, 46);
  });
  card(14, 112, 182, 51, '#FFFFFF');
  text('Changes after confirmation', 20, 118, 11, ink, true);
  [['10%', 'Check-in date change'], ['5%', 'Primary guest name change'], ['5%', 'Category downgrade']].forEach(([amount, label], i) => {
    const x = 20 + i * 59;
    text(amount, x, 129, 17, rose, true, 53);
    text(label, x, 140, 7.8, muted, false, 53);
  });
  text('Fees apply to the booking amount. Date changes are allowed once, more than 72 hours before check-in; later requests follow the cancellation policy.', 20, 150, 7.2, muted, false, 170);
  card(14, 171, 88, 64, warm, '#E8DECE');
  card(108, 171, 88, 64, '#FFFFFF');
  text('Documents & check-in', 20, 177, 10, sand, true, 76);
  let iy = 188;
  iy += text('Present the booking voucher and government photo ID for every guest. Foreign guests require passport and visa / OCI documentation.', 20, iy, 8.4, ink, false, 76) + 4;
  text('Early tent allotment is subject to availability. Check-in from 12:30 PM; check-out at 9:30 AM.', 20, iy, 8.4, muted, false, 76);
  text('Transfers & programme', 114, 177, 10, rose, true, 76);
  let ty = 188;
  ty += text('Delayed flights / trains use the next available transfer. Missed meals and activities are not compensated.', 114, ty, 8.4, ink, false, 76) + 4;
  text('Sightseeing and transfer times may change with weather, sunset timings or operations. Personal expenses and paid activities are extra.', 114, ty, 8.4, muted, false, 76);
  card(14, 243, 182, 28, pale, '#E7C9D4', false);
  text('PLEASE KEEP IN MIND', 20, 249, 6.8, rose, true);
  text('Flight / train cancellation does not make accommodation refundable. This is a summary of the supplier conditions; full booking conditions apply and will be provided at confirmation.', 20, 256, 8, ink, false, 170);

  if (model.budgetPackages.length) {
    page('More ways to explore Kutch', 'Looking for budget-friendly options?');
    model.budgetPackages.forEach(p => {
      if (y + 64 > 270) page('More ways to explore Kutch', 'More budget-friendly options');
      card(14, y, 182, 59, warm);
      photo(p.photo, 19, y + 5, 51, 49);
      let ty = y + 6 + text(`${p.nights} nights / ${p.nights + 1} days - ${p.name}`, 76, y + 6, 11, ink, true, 113) + 3;
      ty += text(`${money(p.total)} / ${p.priceBasis}`, 76, ty, 12, rose, true, 113) + 3;
      ty += text(p.highlights.join(' | '), 76, ty, 8.5, muted, false, 113) + 3;
      text(p.taxNote, 76, ty, 7.5, muted, false, 113); y += 66;
    });
  }

  // 6. A brochure-style closing page. Payment marks are visual only; there is
  // deliberately no checkout URL or payment button in a quotation.
  formal = true;
  doc.addPage(); darkPages.add(doc.getNumberOfPages());
  const closingInk = '#110D1A';
  doc.setFillColor(closingInk); doc.rect(0, 0, 210, 297, 'F');
  photo('brochure-closing-photo.jpg', 0, 0, 210, 168);
  doc.saveGraphicsState(); doc.setGState(doc.GState({ opacity: .18 }));
  doc.setFillColor(closingInk); doc.rect(0, 0, 210, 168, 'F'); doc.restoreGraphicsState();
  for (let step = 0; step < 84; step++) {
    doc.saveGraphicsState(); doc.setGState(doc.GState({ opacity: (step + 1) / 84 }));
    doc.setFillColor(closingInk); doc.rect(0, 90 + step, 210, 1, 'F'); doc.restoreGraphicsState();
  }
  photo('rann-utsav-white.png', 17, 13, 42, 10, true);
  serif('Book your Rann Utsav', 17, 115, 32, '#FFFFFF');
  text('Personalised booking assistance for the 2026-27 season.', 17, 130, 9, '#FFFFFF');
  doc.setFillColor(rose); doc.roundedRect(17, 140, 58, 15, 7.5, 7.5, 'F');
  const closingCentered = (value: string, center: number, top: number, size: number, color: string, bold = false) => {
    doc.setFont('Outfit', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    doc.text(value, center, top, { align: 'center', baseline: 'top' });
  };
  closingCentered('Chat on WhatsApp', 46, 145.8, 9, '#FFFFFF', true);
  doc.link(17, 140, 58, 15, { url: whatsapp });
  text('Click here to chat with us >', 79, 145.8, 8, '#FFFFFF', false, 110);
  doc.link(79, 140, 90, 15, { url: whatsapp });
  doc.setFillColor('#211B29'); doc.setDrawColor('#524856'); doc.setLineWidth(.3);
  doc.roundedRect(17, 175, 176, 39, 4, 4, 'FD');
  closingCentered('PREFER TO CALL?', 105, 181, 7.8, '#C9BFCD', true);
  doc.setFont('Cormorant', 'normal'); doc.setFontSize(27); doc.setTextColor('#FFFFFF');
  doc.text(QUOTATION_CONTACT.phone, 105, 191, { align: 'center', baseline: 'top' });
  doc.link(60, 190, 120, 14, { url: 'tel:+919274730220' });
  closingCentered(`For more inquiries, email us at ${QUOTATION_CONTACT.email}`, 105, 205, 7, '#C9BFCD');
  doc.link(46, 203, 145, 7, { url: `mailto:${QUOTATION_CONTACT.email}` });
  [17, 77, 137].forEach(x => { doc.setFillColor('#211B29'); doc.setDrawColor('#524856'); doc.roundedRect(x, 220, 56, 22, 3, 3, 'FD'); });
  photo('gujarat-white.png', 38, 224, 14, 14, true);
  photo('un-tourism-white.png', 86, 224, 38, 14, true);
  doc.setFont('Outfit', 'bold'); doc.setFontSize(20); doc.setTextColor('#FFFFFF');
  doc.text('4.9', 163, 225, { align: 'right', baseline: 'top' });
  // Vector star avoids unsupported decorative glyphs in the embedded font.
  const points = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 1.5 : 3.4; return [170 + Math.cos(a) * r, 228.8 + Math.sin(a) * r]; });
  doc.setFillColor('#FFFFFF'); doc.lines(points.slice(1).map((p, i) => [p[0] - points[i][0], p[1] - points[i][1]]), points[0][0], points[0][1], [1, 1], 'F', true);
  closingCentered('2,400+ happy guests', 165, 235, 6.8, '#C9BFCD');
  doc.setFillColor('#FFFFFF'); doc.roundedRect(17, 248, 176, 24, 3, 3, 'F');
  text('SECURE PAYMENTS', 23, 253, 7, ink, true);
  payLogos.forEach((name, i) => photo(name, 23 + i * 28, 261, 25, 8, true));
  closingCentered('2026-27 season. Availability is subject to confirmation. Your quotation totals include GST as shown.', 105, 280, 6.4, '#A99DAF');
  closingCentered('YOUR BOOKING PARTNER: THE TOURISM EXPERTS', 105, 291, 7.3, '#A99DAF');

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i === totalPages) continue; // Back cover uses the supplied brochure's own footer composition.
    const dark = darkPages.has(i);
    doc.setDrawColor(dark ? '#625069' : line); doc.setLineWidth(.25); doc.line(14, 281, 196, 281);
    text('THE TOURISM EXPERTS / PERSONALISED QUOTATION', 14, 285, 6.4, dark ? '#CDBDD2' : muted, false, 140);
    text(QUOTATION_CONTACT.phone, 14, 289.5, 6.7, dark ? '#E7B5C6' : rose);
    doc.link(14, 289, 60, 5, { url: whatsapp });
    doc.setFont('Outfit', 'normal'); doc.setFontSize(6.7); doc.setTextColor(dark ? '#CDBDD2' : muted);
    doc.text(`${i} / ${totalPages}`, 196, 287, { align: 'right' });
  }
  return doc;
}

export async function downloadRannQuotationPdf(input: RannQuotationInput): Promise<void> {
  const model = buildRannQuotationModel(input);
  const doc = await createRannQuotationPdf(model);
  const name = (input.guestName || 'Guest').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 90) || 'Guest';
  doc.save(`Rann Utsav Quotation - ${name}.pdf`);
}

// A neutral, client-facing alternatives brochure; the first category is only an
// internal calculation anchor and is never presented as selected or reserved.
export async function downloadRannOptionsPdf(input: RannQuotationInput, categories: TCTentType[]) {
  const unique = [...new Set(categories)];
  if (!unique.length || unique.some(c => !(c in TC_BASE))) throw new Error('Choose at least one standard tent category.');
  const original = buildRannQuotationModel(input);
  const single = original.single;
  const model = buildRannQuotationModel({ ...input, category: unique[0], single,
    extraMattresses: Math.max(0, original.guests - (single ? 1 : 2) * input.rooms), optionCategories: unique });
  const doc = await createRannQuotationPdf(model);
  const name = (input.guestName || 'Guest').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 90) || 'Guest';
  doc.save(`Rann Utsav ${unique.length === 1 ? 'Quotation' : 'Tent Options'} - ${name}.pdf`);
}
