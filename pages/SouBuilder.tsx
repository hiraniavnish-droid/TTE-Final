
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import {
  ArrowLeft, Download, User, Package, Building2, ImageIcon,
  ChevronDown, ChevronUp, Upload, Trash2, FileText, Settings, Save, RefreshCw
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RoomRate {
  type: string;
  wd1n2d: string;
  we1n2d: string;
  wd2n3d: string;
  we2n3d: string;
}

interface HotelData {
  id: string;
  name: string;
  location: string;
  tier: string;
  popular: boolean;
  tags: string;
  defaultImgPath: string;
  photo: string;
  rates: RoomRate[];
}

interface BrochureData {
  clientName: string;
  travelDate: string;
  groupSize: string;
  customNote: string;
  show1N2D: boolean;
  show2N3D: boolean;
  showPricing: boolean;
  hotels: HotelData[];
  coverImgB64: string;     // per-quote override (base64 or URL)
  defaultCoverUrl: string; // global default from Manage tab (Supabase URL)
  isPreview: boolean;
  selectedHotelIds: string[];
  quoteRates: { rate1n2d: string; rate2n3d: string };
  coverSubtitle: string;
  tagline: string;
}

// ─── Default Rate Builder ──────────────────────────────────────────────────────

function makeRates(base1n2d: number, base2n3d: number, wePct = 0.17): RoomRate[] {
  const r = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
  const rnd = (n: number) => '₹' + (Math.round(n / 100) * 100).toLocaleString('en-IN');
  const we = (n: number) => rnd(n * (1 + wePct));
  return [
    { type: 'Double / Twin',    wd1n2d: r(base1n2d),         we1n2d: rnd(base1n2d*(1+wePct)),         wd2n3d: r(base2n3d),         we2n3d: rnd(base2n3d*(1+wePct)) },
    { type: 'Single',           wd1n2d: rnd(base1n2d*1.38),  we1n2d: we(base1n2d*1.38),  wd2n3d: rnd(base2n3d*1.38),  we2n3d: we(base2n3d*1.38) },
    { type: 'Triple',           wd1n2d: rnd(base1n2d*0.85),  we1n2d: we(base1n2d*0.85),  wd2n3d: rnd(base2n3d*0.85),  we2n3d: we(base2n3d*0.85) },
    { type: 'Child (W/ Bed)',   wd1n2d: rnd(base1n2d*0.62),  we1n2d: we(base1n2d*0.62),  wd2n3d: rnd(base2n3d*0.62),  we2n3d: we(base2n3d*0.62) },
    { type: 'Child (W/O Bed)',  wd1n2d: rnd(base1n2d*0.38),  we1n2d: we(base1n2d*0.38),  wd2n3d: rnd(base2n3d*0.38),  we2n3d: we(base2n3d*0.38) },
  ];
}

const HOTEL_GRADIENTS = [
  'linear-gradient(145deg,#2a1f14,#5a3a20)',
  'linear-gradient(145deg,#0d3320,#1a6640)',
  'linear-gradient(145deg,#1a2f4a,#2a5080)',
  'linear-gradient(145deg,#3a1a0a,#6a3010)',
  'linear-gradient(145deg,#2a1540,#4a2570)',
  'linear-gradient(145deg,#1a2810,#304818)',
];

const DEFAULT_HOTELS: HotelData[] = [
  { id: 'tent-city', name: 'Statue of Unity Tent City 1', location: 'Luxury Glamping · Ekta Nagar · Riverside',   tier: 'Glamping',    popular: false, photo: '', tags: '🏊 Pool, 🌊 River View, 🏋️ Gym, 4 Room Types',                  defaultImgPath: 'assets/images/gallery/statue-of-unity-tent-city-1/outdoor.webp',              rates: makeRates(5500, 10000) },
  { id: 'nirvana',   name: 'Nirvana Resort & Restaurant',  location: 'Nature Resort · Kevadia · Jungle Setting',    tier: 'Most Popular',popular: true,  photo: '', tags: '🌿 Forest View, 🍽️ Restaurant, 🌾 Organic Food, 🔥 Bonfire',  defaultImgPath: 'assets/images/gallery/nirvana-resort/2022-10-24.webp',                        rates: makeRates(8499, 10499) },
  { id: 'fern',      name: 'The Fern Sardar Sarovar Resort',location: 'Premium Hotel · Ekta Nagar · Full-Service',  tier: 'Luxury',      popular: false, photo: '', tags: '🏊 Pool & Spa, 🍷 Fine Dining, 🛎️ 24/7 Service',              defaultImgPath: 'assets/images/gallery/the-fern-sardar-sarovar-resort/2024-07-02.webp',        rates: makeRates(9599, 11599) },
  { id: 'regenta',   name: 'Regenta Resort Vidhyanchal',   location: 'Premium Resort · Kevadia · Forest Setting',   tier: '4-Star Resort',popular: false, photo: '', tags: '🏊 Pool, 🌿 Nature View, 🍽️ Multi-Cuisine',                    defaultImgPath: 'assets/images/gallery/regenta-resort-vidhyanchal/aerial.webp',                rates: makeRates(8999, 12499) },
  { id: 'ramada',    name: 'Ramada Encore by Wyndham',     location: 'Business Hotel · Ekta Nagar · Modern',        tier: '4-Star Hotel', popular: false, photo: '', tags: '🏊 Pool, 🏋️ Fitness Centre, 🍽️ Restaurant',                   defaultImgPath: 'assets/images/gallery/ramada-encore-by-wyndham/cover-photo.webp',             rates: makeRates(7999, 11999) },
  { id: 'fortune',   name: 'Fortune Ekta Nagar',           location: 'Business Hotel · Ekta Nagar · City Centre',   tier: '3-Star Hotel', popular: false, photo: '', tags: '🍽️ Restaurant, 🅿️ Parking, 📶 High-Speed WiFi',              defaultImgPath: 'assets/images/gallery/fortune/cover-photo.webp',                             rates: makeRates(6999, 10999) },
];

// ─── localStorage ──────────────────────────────────────────────────────────────

// ─── Supabase Storage ──────────────────────────────────────────────────────────

const BUCKET = 'sou-images';
const SETTINGS_PATH = 'settings/data.json';
const SB_PUBLIC_URL = (import.meta.env.VITE_SUPABASE_URL as string) + `/storage/v1/object/public/${BUCKET}/`;

// Writes go through a serverless function that holds the service-role key
// SERVER-SIDE only. In `vite dev` there is no local API, so fall back to prod.
const STORAGE_API = (import.meta as any).env?.DEV ? 'https://ttecrm.vercel.app' : '';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadToStorage(file: File, path: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const dataBase64 = await fileToBase64(file);
  const res = await fetch(`${STORAGE_API}/api/sou-storage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'upload', path, ext, contentType: file.type || 'image/jpeg', dataBase64 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url as string;
}

interface GlobalSettings { hotels: HotelData[]; defaultCoverUrl: string; }

async function loadGlobalSettings(): Promise<GlobalSettings | null> {
  try {
    const res = await fetch(SB_PUBLIC_URL + SETTINGS_PATH + '?t=' + Date.now());
    if (!res.ok) return null;
    return await res.json() as GlobalSettings;
  } catch { return null; }
}

async function saveGlobalSettings(hotels: HotelData[], defaultCoverUrl: string): Promise<void> {
  const res = await fetch(`${STORAGE_API}/api/sou-storage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save-settings', hotels, defaultCoverUrl }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || 'Save failed');
  }
}

function mergeHotels(saved: HotelData[]): HotelData[] {
  return DEFAULT_HOTELS.map(def => {
    const s = saved.find(h => h.id === def.id);
    return s ? { ...def, photo: s.photo ?? '', rates: s.rates ?? def.rates } : { ...def };
  });
}

// ─── HTML Generator ────────────────────────────────────────────────────────────

function generateBrochureHtml(data: BrochureData): string {
  const { clientName, travelDate, groupSize, customNote, show1N2D, show2N3D, showPricing, hotels, coverImgB64, defaultCoverUrl, isPreview, selectedHotelIds, quoteRates, coverSubtitle, tagline } = data;

  const cheapestPrice = hotels[0]?.rates[0]?.wd1n2d || '₹5,500';

  // per-quote override → global default → asset fallback
  const activeCoverSrc = coverImgB64 || defaultCoverUrl;
  const coverImgEl = activeCoverSrc
    ? '<img src="' + activeCoverSrc + '" alt="Statue of Unity" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;" />'
    : isPreview
      ? '<div style="width:100%;height:100%;background:linear-gradient(180deg,#0d0a05 0%,#2a1f14 40%,#1a1108 100%);"></div>'
      : '<img src="assets/images/gallery/generic-6.webp" alt="Statue of Unity" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;" />';

  const logoEl = isPreview
    ? '<div style="height:42px;display:flex;align-items:center;color:#FFB347;font-family:\'Lato\',Arial,sans-serif;font-size:8pt;font-weight:700;letter-spacing:0.1em;">THE TOURISM EXPERTS</div>'
    : '<img src="assets/images/logo-color.png" alt="The Tourism Experts" height="42px" />';
  const logoWhiteEl = isPreview
    ? '<div style="height:36px;display:flex;align-items:center;color:#fff;font-family:\'Lato\',Arial,sans-serif;font-size:7pt;font-weight:700;letter-spacing:0.1em;">THE TOURISM EXPERTS</div>'
    : '<img src="assets/images/logo-white.png" alt="The Tourism Experts" style="height:36px;" />';

  const pageImgEl = (fallbackPath: string, gradient: string) => isPreview
    ? '<div style="width:100%;height:100%;background:' + gradient + ';"></div>'
    : '<img src="' + fallbackPath + '" alt="" style="width:100%;height:100%;object-fit:cover;" />';

  const personalBanner = clientName
    ? '<div style="background:linear-gradient(90deg,#0d0a05,#1A1108 60%,#2B1A0A);padding:5mm 12mm;display:flex;align-items:center;justify-content:space-between;border-bottom:2.5px solid #E8841A;flex-shrink:0;position:relative;z-index:10;"><div><div style="font-size:5pt;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,179,71,0.6);margin-bottom:1.5mm;">Prepared Exclusively For</div><div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:15pt;font-weight:700;color:#FFB347;line-height:1.1;">' + clientName + '</div></div>' + (travelDate || groupSize ? '<div style="text-align:right;">' + (travelDate ? '<div style="font-size:7pt;color:rgba(255,255,255,0.55);margin-bottom:1.5mm;">' + travelDate + '</div>' : '') + (groupSize ? '<div style="font-size:9pt;color:rgba(255,255,255,0.85);font-weight:600;">' + groupSize + ' Pax</div>' : '') + '</div>' : '') + '</div>'
    : '';

  const customNoteHtml = customNote
    ? '<div style="background:#FFF7ED;border-left:3px solid #E8841A;padding:3mm 5mm;margin-bottom:5mm;border-radius:0 5px 5px 0;"><div style="font-size:5.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#C96A10;margin-bottom:1.5mm;">A Note For You</div><div style="font-size:7.5pt;color:#3D2B1F;line-height:1.55;">' + customNote + '</div></div>'
    : '';

  // ── Hotel cards for page 4 ──
  const buildHotelCard = (h: HotelData, idx: number) => {
    const imgHtml = h.photo
      ? '<img src="' + h.photo + '" alt="' + h.name + '" style="width:100%;height:100%;object-fit:cover;display:block;" />'
      : isPreview
        ? '<div style="width:100%;height:100%;min-height:30mm;background:' + HOTEL_GRADIENTS[idx % 6] + ';display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.35);font-size:5.5pt;text-align:center;padding:3mm;line-height:1.3;">' + h.name + '</div>'
        : '<img src="' + h.defaultImgPath + '" alt="' + h.name + '" style="width:100%;height:100%;object-fit:cover;display:block;" />';
    const startingFrom = h.rates[0]?.wd1n2d || '—';
    const tagsHtml = h.tags.split(',').map(t => '<span class="hcard-tag">' + t.trim() + '</span>').join('');
    return '<div class="hcard' + (h.popular ? ' popular' : '') + '">'
      + '<div class="hcard-img" style="min-height:30mm;position:relative;overflow:hidden;">'
      +   imgHtml
      +   '<span class="hcard-tier' + (h.popular ? ' popular' : '') + '">' + (h.popular ? '⭐ ' : '') + h.tier + '</span>'
      +   '<div class="hcard-price-overlay"><span class="hcard-from">Starting from</span><div class="hcard-price-big">' + startingFrom + ' <sub>/person</sub></div></div>'
      + '</div>'
      + '<div class="hcard-body"><h3 class="hcard-name">' + h.name + '</h3><p class="hcard-type">' + h.location + '</p><div class="hcard-tags">' + tagsHtml + '</div></div>'
      + '</div>';
  };

  const row1Html = hotels.slice(0, 3).map((h, i) => buildHotelCard(h, i)).join('');
  const row2Html = hotels.slice(3).map((h, i) => buildHotelCard(h, i + 3)).join('');

  const selectedHotels = selectedHotelIds.length > 0
    ? selectedHotelIds.map(id => hotels.find(h => h.id === id)).filter(Boolean) as HotelData[]
    : hotels;
  const unselectedHotels = hotels.filter(h => !selectedHotelIds.includes(h.id));

  const buildHotelCardHtml = (h: HotelData, idx: number, cardHeight = '55mm', fontSize = '7pt') => {
    const globalIdx = hotels.indexOf(h);
    const imgHtml = h.photo
      ? `<img src="${h.photo}" alt="${h.name}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
      : isPreview
        ? `<div style="width:100%;height:100%;background:${HOTEL_GRADIENTS[globalIdx % 6]};"></div>`
        : `<img src="${h.defaultImgPath}" alt="${h.name}" style="width:100%;height:100%;object-fit:cover;display:block;" />`;
    const rate1n2d = h.rates[0]?.wd1n2d || '—';
    const rate2n3d = h.rates[0]?.wd2n3d || '—';
    return `<div style="position:relative;border-radius:6px;overflow:hidden;height:${cardHeight};clip-path:inset(0);">
      ${imgHtml}
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(10,5,1,0.85) 0%,transparent 55%);"></div>
      ${h.popular ? '<div style="position:absolute;top:2mm;left:2mm;background:#E8841A;color:white;font-size:4.5pt;font-weight:700;padding:1px 4px;border-radius:2px;letter-spacing:0.05em;">★ POPULAR</div>' : ''}
      <div style="position:absolute;bottom:0;left:0;right:0;padding:2mm 3mm;">
        <div style="font-family:Georgia,serif;font-size:${fontSize};font-weight:700;color:white;line-height:1.2;margin-bottom:0.5mm;">${h.name}</div>
        <div style="font-size:4.5pt;color:rgba(255,255,255,0.6);">${h.location}</div>
        <div style="display:flex;gap:3mm;margin-top:1mm;">
          ${show1N2D ? `<span style="font-size:4.5pt;color:#FFB347;font-weight:700;">1N2D ${rate1n2d}/pp</span>` : ''}
          ${show2N3D ? `<span style="font-size:4.5pt;color:#FFD07A;font-weight:700;">2N3D ${rate2n3d}/pp</span>` : ''}
        </div>
      </div>
    </div>`;
  };

  const buildHeroHotelHtml = (h: HotelData, idx: number) => {
    const globalIdx = hotels.indexOf(h);
    const imgHtml = h.photo
      ? `<img src="${h.photo}" alt="${h.name}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
      : isPreview
        ? `<div style="width:100%;height:100%;background:${HOTEL_GRADIENTS[globalIdx % 6]};"></div>`
        : `<img src="${h.defaultImgPath}" alt="${h.name}" style="width:100%;height:100%;object-fit:cover;display:block;" />`;
    const startingFrom = quoteRates.rate1n2d ? '₹' + quoteRates.rate1n2d : h.rates[0]?.wd1n2d || '—';
    const tagsHtml = h.tags.split(',').map((t: string) => `<span style="font-size:6pt;color:#6B4020;padding:2px 6px;border:0.5px solid #DDD0B8;border-radius:2px;margin:1px;">${t.trim()}</span>`).join('');
    return `<div style="display:flex;gap:5mm;padding:4mm 7mm;background:#fff;height:135mm;flex-shrink:0;overflow:hidden;clip-path:inset(0);">
    <div style="width:70mm;flex-shrink:0;border-radius:8px;overflow:hidden;position:relative;clip-path:inset(0);">
      ${imgHtml}
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(10,5,1,0.82) 0%,transparent 55%);"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:4mm 5mm;">
        <div style="font-size:4.5pt;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:1mm;">Starting from</div>
        <div style="font-family:Georgia,serif;font-size:16pt;font-weight:700;color:#FFB347;line-height:1;">${startingFrom}<span style="font-size:5.5pt;color:rgba(255,255,255,0.5);font-weight:400;"> /person</span></div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;padding:2mm 0;">
      <div>
        <div style="font-size:4.5pt;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(232,132,26,0.7);margin-bottom:2.5mm;">Your Selected Hotel</div>
        <div style="font-family:Georgia,serif;font-size:14pt;font-weight:700;color:#1A1108;line-height:1.15;margin-bottom:1.5mm;">${h.name}</div>
        <div style="font-size:6pt;color:#64748B;margin-bottom:2mm;">${h.location}</div>
        <div style="width:20mm;height:1.5px;background:linear-gradient(to right,#E8841A,transparent);margin-bottom:2.5mm;"></div>
        <div style="display:flex;flex-wrap:wrap;gap:2px;">${tagsHtml}</div>
      </div>
      <div style="padding:3mm 4mm;background:#FFF7ED;border-radius:6px;border:1px solid #E8D5C0;">
        <div style="font-size:5pt;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C96A10;margin-bottom:2mm;">Package Rates (per person)</div>
        ${show1N2D ? `<div style="font-size:7pt;color:#3D2B1F;margin-bottom:2mm;display:flex;justify-content:space-between;align-items:center;"><span>1 Night · 2 Days</span><span style="font-family:Georgia,serif;font-size:10pt;font-weight:700;color:#C96A10;">${quoteRates.rate1n2d ? '₹'+quoteRates.rate1n2d : h.rates[0]?.wd1n2d||'—'}<span style="font-size:5pt;font-weight:400;color:#888;"> /pax</span></span></div>` : ''}
        ${show2N3D ? `<div style="font-size:7pt;color:#3D2B1F;display:flex;justify-content:space-between;align-items:center;"><span>2 Nights · 3 Days</span><span style="font-family:Georgia,serif;font-size:10pt;font-weight:700;color:#C96A10;">${quoteRates.rate2n3d ? '₹'+quoteRates.rate2n3d : h.rates[0]?.wd2n3d||'—'}<span style="font-size:5pt;font-weight:400;color:#888;"> /pax</span></span></div>` : ''}
      </div>
    </div>
  </div>`;
  };

  // Dynamic hotel page layout based on number of selected hotels
  const n = selectedHotels.length;
  let hotelPageBodyHtml: string;
  if (n === 0 || n === 6) {
    // Show all 6 in 3×2 grid (original layout)
    hotelPageBodyHtml = `<div class="hotel-cards-grid">
        <div class="hotel-row-label">Featured Properties</div>
        <div class="hotel-row">${row1Html}</div>
        <div class="hotel-row-label">More Options</div>
        <div class="hotel-row">${row2Html}</div>
      </div>`;
  } else if (n === 1) {
    // 1 hotel: hero + 5 others in compact row
    const [hero] = selectedHotels;
    hotelPageBodyHtml = `<div class="hotel-cards-grid" style="padding:0;gap:0;background:#F7F2EB;">
      ${buildHeroHotelHtml(hero, 0)}
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;clip-path:inset(0);">
        <div style="padding:2.5mm 7mm 1.5mm;font-size:4.8pt;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(26,17,8,0.45);display:flex;align-items:center;gap:3mm;background:#F7F2EB;flex-shrink:0;">Other Options<span style="flex:1;height:0.5px;background:rgba(26,17,8,0.15);display:block;"></span></div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2.5mm;padding:0 7mm 4mm;flex:1;overflow:hidden;clip-path:inset(0);">
          ${unselectedHotels.slice(0, 5).map((h, i) => buildHotelCardHtml(h, i, '100%', '6.5pt')).join('')}
        </div>
      </div>
    </div>`;
  } else if (n === 2) {
    // 2 hotels: 2 tall columns, fill full space
    hotelPageBodyHtml = `<div class="hotel-cards-grid" style="padding:4mm 7mm;gap:3mm;background:#F7F2EB;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4mm;flex:1;overflow:hidden;clip-path:inset(0);">
        ${selectedHotels.map((h, i) => buildHotelCardHtml(h, i, '100%', '9pt')).join('')}
      </div>
      ${unselectedHotels.length > 0 ? `
      <div style="font-size:4.8pt;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(26,17,8,0.45);flex-shrink:0;display:flex;align-items:center;gap:3mm;">Other Options<span style="flex:1;height:0.5px;background:rgba(26,17,8,0.15);display:block;"></span></div>
      <div style="display:grid;grid-template-columns:repeat(${Math.min(unselectedHotels.length,4)},1fr);gap:2.5mm;height:50mm;flex-shrink:0;overflow:hidden;clip-path:inset(0);">
        ${unselectedHotels.slice(0,4).map((h,i) => buildHotelCardHtml(h,i,'100%','6pt')).join('')}
      </div>` : ''}
    </div>`;
  } else if (n === 3) {
    // 3 hotels: 3 columns
    hotelPageBodyHtml = `<div class="hotel-cards-grid" style="padding:4mm 7mm;gap:3mm;background:#F7F2EB;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm;flex:1;overflow:hidden;clip-path:inset(0);">
        ${selectedHotels.map((h, i) => buildHotelCardHtml(h, i, '100%', '8pt')).join('')}
      </div>
      ${unselectedHotels.length > 0 ? `
      <div style="font-size:4.8pt;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(26,17,8,0.45);flex-shrink:0;display:flex;align-items:center;gap:3mm;">Other Options<span style="flex:1;height:0.5px;background:rgba(26,17,8,0.15);display:block;"></span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2.5mm;height:50mm;flex-shrink:0;overflow:hidden;clip-path:inset(0);">
        ${unselectedHotels.slice(0,3).map((h,i) => buildHotelCardHtml(h,i,'100%','6pt')).join('')}
      </div>` : ''}
    </div>`;
  } else if (n === 4) {
    // 4 hotels: 2×2 grid
    hotelPageBodyHtml = `<div class="hotel-cards-grid" style="padding:4mm 7mm;gap:3mm;background:#F7F2EB;">
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:3mm;flex:1;overflow:hidden;clip-path:inset(0);">
        ${selectedHotels.map((h, i) => buildHotelCardHtml(h, i, '100%', '8pt')).join('')}
      </div>
      ${unselectedHotels.length > 0 ? `
      <div style="font-size:4.8pt;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(26,17,8,0.45);flex-shrink:0;display:flex;align-items:center;gap:3mm;">Other Options<span style="flex:1;height:0.5px;background:rgba(26,17,8,0.15);display:block;"></span></div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2.5mm;height:45mm;flex-shrink:0;overflow:hidden;clip-path:inset(0);">
        ${unselectedHotels.slice(0,2).map((h,i) => buildHotelCardHtml(h,i,'100%','6pt')).join('')}
      </div>` : ''}
    </div>`;
  } else {
    // 5 hotels: 3 top + 2 bottom
    hotelPageBodyHtml = `<div class="hotel-cards-grid" style="padding:4mm 7mm;gap:3mm;background:#F7F2EB;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm;flex:1;overflow:hidden;clip-path:inset(0);">
        ${selectedHotels.slice(0,3).map((h, i) => buildHotelCardHtml(h, i, '100%', '8pt')).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm;flex:1;overflow:hidden;clip-path:inset(0);">
        ${selectedHotels.slice(3,5).map((h, i) => buildHotelCardHtml(h, i, '100%', '8pt')).join('')}
      </div>
      ${unselectedHotels.length > 0 ? `
      <div style="font-size:4.8pt;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(26,17,8,0.45);flex-shrink:0;display:flex;align-items:center;gap:3mm;">Other Options<span style="flex:1;height:0.5px;background:rgba(26,17,8,0.15);display:block;"></span></div>
      <div style="display:grid;grid-template-columns:1fr;gap:2.5mm;height:40mm;flex-shrink:0;overflow:hidden;clip-path:inset(0);">
        ${unselectedHotels.slice(0,1).map((h,i) => buildHotelCardHtml(h,i,'100%','6pt')).join('')}
      </div>` : ''}
    </div>`;
  }

  // ── Pricing page (page 5) ──
  const pricingPageHtml = !showPricing || isPreview ? '' : (() => {
    const hotelsForPricing = selectedHotelIds.length > 0 ? hotels.filter(h => selectedHotelIds.includes(h.id)) : hotels;
    const rateCards = hotelsForPricing.map((h, hidx) => {
      // Build a simple single-rate table (no WD/WE split)
      let thead = '<tr><th class="rt-room-lbl" style="text-align:left;">Room Type</th>';
      if (show1N2D) thead += '<th class="rt-pkg" style="text-align:center;">1 Night · 2 Days</th>';
      if (show2N3D) thead += '<th class="rt-pkg rt-sep" style="text-align:center;">2 Nights · 3 Days</th>';
      thead += '</tr>';

      const tbody = h.rates.map((r, ridx) => {
        // For selected hotels, use quoteRates for the first room type row
        const rate1n2d = (selectedHotelIds.includes(h.id) && ridx === 0 && quoteRates.rate1n2d)
          ? '₹' + quoteRates.rate1n2d
          : r.wd1n2d;
        const rate2n3d = (selectedHotelIds.includes(h.id) && ridx === 0 && quoteRates.rate2n3d)
          ? '₹' + quoteRates.rate2n3d
          : r.wd2n3d;
        let row = '<tr><td class="rt-room-lbl">' + r.type + '</td>';
        if (show1N2D) row += '<td class="rt-wd" style="text-align:center;">' + rate1n2d + '</td>';
        if (show2N3D) row += '<td class="rt-wd rt-sep" style="text-align:center;">' + rate2n3d + '</td>';
        row += '</tr>';
        return row;
      }).join('');

      return '<div class="rc' + (h.popular ? ' rc-pop' : '') + '">'
        + '<div class="rc-hd"><span class="rc-name">' + (h.popular ? '⭐ ' : '') + h.name + '</span><span class="rc-tier">' + h.tier + '</span></div>'
        + '<table class="rt"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>'
        + '</div>';
    }).join('');

    return '<div class="page"><div class="rates-pg">'
      + '<div class="hotel-hd">'
      +   '<div class="hotel-hd-bg">' + pageImgEl('assets/images/gallery/generic-3.webp', 'linear-gradient(180deg,#0d1a2a,#1a3a5a)') + '</div>'
      +   '<div class="hotel-hd-top"><span class="hotel-hd-eyebrow">Pricing</span><div class="hotel-hd-logo">' + logoEl + '</div></div>'
      +   '<div class="hotel-hd-bottom"><div class="hotel-hd-title">Hotel Rate Card &amp; <em>Package Pricing</em></div><p class="hotel-hd-sub">All rates per person · Breakfast included · GST additional · Subject to availability</p></div>'
      + '</div>'
      + '<div class="rates-legend"><span class="rates-pill">All rates per person per package</span><span class="rates-pill">Breakfast included</span><span class="rates-pill">Peak season surcharge may apply</span></div>'
      + '<div class="rates-grid">' + rateCards + '</div>'
      + '<div class="contact-ft"><div class="contact-ft-logo">' + logoWhiteEl + '</div><div class="contact-ft-divider"></div><div class="contact-ft-details"><div class="contact-ft-item"><span class="contact-ft-lbl">Email</span><span class="contact-ft-val">booking@thetourismexperts.com</span></div><div class="contact-ft-item"><span class="contact-ft-lbl">Website</span><span class="contact-ft-val">statueofunitybooking.com</span></div></div><div><span class="contact-ft-phone-lbl">WhatsApp / Call</span><div class="contact-ft-phone">+91 92747 30220</div></div></div>'
      + '</div></div>';
  })();

  // ── Itinerary pages ──
  const page2 = show1N2D ? `
<div class="page" id="page-1n2d">
  <div class="itin-page">
    <div class="itin-hd">
      <div class="itin-hd-bg">${pageImgEl('assets/images/gallery/generic-2.webp', 'linear-gradient(180deg,#0d2a3a,#1a4a5a)')}</div>
      <div class="itin-hd-top"><span class="itin-hd-eyebrow">Package · 01</span><div class="itin-hd-logo">${logoEl}</div></div>
      <div class="itin-hd-bottom"><div class="itin-hd-title">1 Night · <em>2 Days</em></div><div class="itin-hd-stats"><div class="itin-stat"><span class="itin-stat-num">2</span><span class="itin-stat-label">Days</span></div><div class="itin-stat"><span class="itin-stat-num">13</span><span class="itin-stat-label">Attractions</span></div><div class="itin-stat"><span class="itin-stat-num">E-Auto</span><span class="itin-stat-label">Both Days</span></div></div></div>
    </div>
    <div class="itin-cols">
      <div class="day-col">
        <div class="day-mosaic">
          <div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/jungle-safari.webp','linear-gradient(145deg,#1a3a1a,#2a5a2a)')}<span class="day-mosaic-label">Jungle Safari</span></div>
          <div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/sou-viewing-gallary.webp','linear-gradient(145deg,#1a1a3a,#2a2a5a)')}<span class="day-mosaic-label">Viewing Gallery</span></div>
        </div>
        <div class="day-hd"><div class="day-num">1</div><div class="day-hd-text"><span class="day-hd-title">Day One</span><span class="day-hd-sub">Arrive &amp; Explore · By E-Auto</span></div></div>
        <div class="day-acts">
          <div class="act"><div class="act-icon">🦁</div><div class="act-body"><span class="act-name">Jungle Safari</span><span class="act-desc">Explore Ekta Nagar's wildlife reserve — spot deer, leopard, sloth bear, and over 200 bird species.</span><span class="act-tag">Entry Included</span></div></div>
          <div class="act"><div class="act-icon">🏛️</div><div class="act-body"><span class="act-name">Sardar Sarovar Dam View</span><span class="act-desc">Marvel at one of the world's largest gravity dams and the sweeping Narmada river panorama.</span></div></div>
          <div class="act"><div class="act-icon">🌸</div><div class="act-body"><span class="act-name">Valley of Flowers</span><span class="act-desc">A vibrant floral garden at the base of the Statue with thousands of seasonal blooms.</span></div></div>
          <div class="act"><div class="act-icon">🗿</div><div class="act-body"><span class="act-name">Statue of Unity</span><span class="act-desc">Stand before the world's tallest statue (182m) — a tribute to Sardar Vallabhbhai Patel.</span><span class="act-tag">Entry Included</span></div></div>
          <div class="act"><div class="act-icon">🔭</div><div class="act-body"><span class="act-name">Viewing Gallery</span><span class="act-desc">Ascend to 153m inside the statue for 360° views of the Narmada valley and Vindhya hills.</span><span class="act-tag">Entry Included</span></div></div>
        </div>
      </div>
      <div class="day-col">
        <div class="day-mosaic">
          <div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/vishwa-van.webp','linear-gradient(145deg,#0d2a1a,#1a4a30)')}<span class="day-mosaic-label">Arogya Van</span></div>
          <div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/cactus-garden.webp','linear-gradient(145deg,#1a2a0d,#2a4a1a)')}<span class="day-mosaic-label">Cactus Garden</span></div>
          <div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/narmada-maha-aarti.webp','linear-gradient(145deg,#1a0d2a,#3a1a4a)')}<span class="day-mosaic-label">Narmada Aarti</span></div>
        </div>
        <div class="day-hd"><div class="day-num">2</div><div class="day-hd-text"><span class="day-hd-title">Day Two</span><span class="day-hd-sub">Gardens &amp; Aarti · E-Auto</span></div></div>
        <div class="day-acts">
          <div class="act"><div class="act-icon">🌿</div><div class="act-body"><span class="act-name">Arogya Van</span><span class="act-desc">5,000+ medicinal plants — healing trails and wellness walk through the therapeutic garden.</span></div></div>
          <div class="act"><div class="act-icon">🌵</div><div class="act-body"><span class="act-name">Cactus Garden</span><span class="act-desc">Asia's largest cactus collection — 450+ species over 24 acres of stunning desert landscape.</span><span class="act-tag">Entry Included</span></div></div>
          <div class="act"><div class="act-icon">🦋</div><div class="act-body"><span class="act-name">Butterfly Garden</span><span class="act-desc">India's first climate-controlled butterfly conservatory — a magical experience.</span><span class="act-tag">Entry Included</span></div></div>
          <div class="act"><div class="act-icon">🌲</div><div class="act-body"><span class="act-name">Miyawaki Forest</span><span class="act-desc">Dense native micro-forest — oxygen-rich, serene, and lush. A true nature escape.</span></div></div>
          <div class="act"><div class="act-icon">🌱</div><div class="act-body"><span class="act-name">Ekta Nursery &amp; Ekta Mall</span><span class="act-desc">Rare plants, local crafts, organic products and souvenirs to take home.</span></div></div>
          <div class="act"><div class="act-icon">🪔</div><div class="act-body"><span class="act-name">Narmada Maha Aarti</span><span class="act-desc">Grand riverbank prayer ceremony — the soul of Kevadia. An unmissable spiritual experience.</span><span class="act-tag">Unmissable</span></div></div>
        </div>
      </div>
    </div>
    <div class="itin-ft"><span class="itin-ft-note">E-Auto sightseeing included both days. Sequence may vary. All entry tickets included as specified.</span><span class="itin-ft-brand">The Tourism Experts · +91 92747 30220</span></div>
  </div>
</div>` : '';

  const page3 = show2N3D ? `
<div class="page" id="page-2n3d">
  <div class="itin-page">
    <div class="itin-hd">
      <div class="itin-hd-bg">${pageImgEl('assets/images/gallery/generic-4.webp','linear-gradient(180deg,#1a0d05,#3a1a08)')}</div>
      <div class="itin-hd-top"><span class="itin-hd-eyebrow">Package · 02</span><div class="itin-hd-logo">${logoEl}</div></div>
      <div class="itin-hd-bottom"><div class="itin-hd-title">2 Nights · <em>3 Days</em></div><div class="itin-hd-stats"><div class="itin-stat"><span class="itin-stat-num">3</span><span class="itin-stat-label">Days</span></div><div class="itin-stat"><span class="itin-stat-num">16+</span><span class="itin-stat-label">Attractions</span></div><div class="itin-stat"><span class="itin-stat-num">Private Car</span><span class="itin-stat-label">Day 3</span></div></div></div>
    </div>
    <div class="itin-cols itin-cols-3">
      <div class="day-col">
        <div class="day-mosaic"><div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/jungle-safari.webp','linear-gradient(145deg,#1a3a1a,#2a5a2a)')}<span class="day-mosaic-label">Jungle Safari</span></div><div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/sou-viewing-gallary.webp','linear-gradient(145deg,#1a1a3a,#2a2a5a)')}<span class="day-mosaic-label">Viewing Gallery</span></div></div>
        <div class="day-hd"><div class="day-num">1</div><div class="day-hd-text"><span class="day-hd-title">Day One</span><span class="day-hd-sub">Arrive &amp; Explore · By E-Auto</span></div></div>
        <div class="day-acts">
          <div class="act"><div class="act-icon">🦁</div><div class="act-body"><span class="act-name">Jungle Safari</span><span class="act-desc">Wildlife reserve with deer, leopard, sloth bear and 200+ bird species.</span><span class="act-tag">Entry Included</span></div></div>
          <div class="act"><div class="act-icon">🏛️</div><div class="act-body"><span class="act-name">Sardar Sarovar Dam View</span><span class="act-desc">One of the world's largest gravity dams — stunning Narmada panorama.</span></div></div>
          <div class="act"><div class="act-icon">🌸</div><div class="act-body"><span class="act-name">Valley of Flowers</span><span class="act-desc">Thousands of seasonal blooms at the base of the Statue.</span></div></div>
          <div class="act"><div class="act-icon">🗿</div><div class="act-body"><span class="act-name">Statue of Unity</span><span class="act-desc">World's tallest statue — 182m monument to Sardar Patel.</span><span class="act-tag">Entry Included</span></div></div>
          <div class="act"><div class="act-icon">🔭</div><div class="act-body"><span class="act-name">Viewing Gallery</span><span class="act-desc">Breathtaking 360° views from 153m inside the statue.</span><span class="act-tag">Entry Included</span></div></div>
          <div class="act"><div class="act-icon">✨</div><div class="act-body"><span class="act-name">Laser &amp; Light Show</span><span class="act-desc">Evening show at the dam — subject to availability.</span><span class="act-tag">Subject to Availability</span></div></div>
        </div>
      </div>
      <div class="day-col">
        <div class="day-mosaic"><div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/vishwa-van.webp','linear-gradient(145deg,#0d2a1a,#1a4a30)')}<span class="day-mosaic-label">Arogya Van</span></div><div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/cactus-garden.webp','linear-gradient(145deg,#1a2a0d,#2a4a1a)')}<span class="day-mosaic-label">Cactus</span></div><div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/narmada-maha-aarti.webp','linear-gradient(145deg,#1a0d2a,#3a1a4a)')}<span class="day-mosaic-label">Aarti</span></div></div>
        <div class="day-hd"><div class="day-num">2</div><div class="day-hd-text"><span class="day-hd-title">Day Two</span><span class="day-hd-sub">Gardens &amp; Aarti · E-Auto</span></div></div>
        <div class="day-acts">
          <div class="act"><div class="act-icon">🌿</div><div class="act-body"><span class="act-name">Arogya Van</span><span class="act-desc">5,000+ medicinal plants — healing trails and wellness walk.</span></div></div>
          <div class="act"><div class="act-icon">🌵</div><div class="act-body"><span class="act-name">Cactus Garden</span><span class="act-desc">Asia's largest cactus collection — 450+ species over 24 acres.</span><span class="act-tag">Entry Included</span></div></div>
          <div class="act"><div class="act-icon">🦋</div><div class="act-body"><span class="act-name">Butterfly Garden</span><span class="act-desc">India's first climate-controlled butterfly conservatory.</span><span class="act-tag">Entry Included</span></div></div>
          <div class="act"><div class="act-icon">🌲</div><div class="act-body"><span class="act-name">Miyawaki Forest</span><span class="act-desc">Dense native micro-forest — oxygen-rich and serene.</span></div></div>
          <div class="act"><div class="act-icon">🌱</div><div class="act-body"><span class="act-name">Ekta Nursery &amp; Ekta Mall</span><span class="act-desc">Rare plants, local crafts, organic products and souvenirs.</span></div></div>
          <div class="act"><div class="act-icon">🪔</div><div class="act-body"><span class="act-name">Narmada Maha Aarti</span><span class="act-desc">Grand riverbank prayer ceremony — the soul of Kevadia.</span><span class="act-tag">Unmissable</span></div></div>
        </div>
      </div>
      <div class="day-col">
        <div class="day-mosaic"><div class="day-mosaic-img">${pageImgEl('assets/images/gallery/activities/narmada-maha-aarti.webp','linear-gradient(145deg,#1a0d2a,#3a1a4a)')}<span class="day-mosaic-label">Temple Circuit</span></div></div>
        <div class="day-hd"><div class="day-num" style="background:var(--espresso);">3</div><div class="day-hd-text"><span class="day-hd-title">Day Three</span><span class="day-hd-sub">Temple Circuit · Private AC Car</span></div></div>
        <div class="day-acts">
          <div class="day-note"><div class="day-note-text">🚗 Private AC Car Included</div><div class="day-note-sub">Dedicated vehicle for the full-day temple circuit — comfort assured</div></div>
          <div class="act"><div class="act-icon">🛕</div><div class="act-body"><span class="act-name">Garudeshwar Dutt Mandir</span><span class="act-desc">Revered Dattatreya shrine on the Narmada banks — one of Gujarat's most sacred river-side temples.</span></div></div>
          <div class="act"><div class="act-icon">🛕</div><div class="act-body"><span class="act-name">Kuber Bhandari Temple</span><span class="act-desc">Ancient temple dedicated to Lord Kubera, deity of wealth, set amid scenic natural surroundings.</span></div></div>
          <div class="act"><div class="act-icon">🛕</div><div class="act-body"><span class="act-name">Neelkanthdam Pochi Temple</span><span class="act-desc">A spiritually significant riverside temple — a serene farewell to Kevadia.</span></div></div>
          <div class="act" style="background:#FFF7ED;border-radius:5px;padding:2.5mm 4mm;"><div class="act-icon" style="background:rgba(26,17,8,0.07);">🍽️</div><div class="act-body"><span class="act-name" style="color:var(--saffron-dk);">Departure after Lunch</span><span class="act-desc">Check-out after breakfast. Lunch on the way. Warm farewell with lasting memories of Kevadia.</span></div></div>
        </div>
      </div>
    </div>
    <div class="itin-ft"><span class="itin-ft-note">Day 3 temple circuit by private AC car (included). E-Auto for Days 1 &amp; 2. Sequence may vary. All entry tickets included as specified.</span><span class="itin-ft-brand">The Tourism Experts · +91 92747 30220</span></div>
  </div>
</div>` : '';

  const autoPrint = !isPreview ? '<script>window.onload=function(){setTimeout(function(){window.print();},900);}<\/script>' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>SOU Package — ${clientName || 'The Tourism Experts'}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--espresso:#1A1108;--saffron:#E8841A;--saffron-dk:#C96A10;--gold:#FFB347;--cream:#FFF7ED;--white:#FFFFFF;--muted:#64748B;}
@page{size:A4 portrait;margin:0;}
body{background:${isPreview ? '#1e1e1e' : 'none'};padding:${isPreview ? '24px' : '0'};font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
@media print{
  html,body{width:210mm;margin:0;padding:0;background:none;}
  .page{margin:0!important;box-shadow:none!important;page-break-after:always;break-after:page;}
  .page:last-child{page-break-after:avoid;break-after:avoid;}
}
.page{width:210mm;height:297mm;background:#fff;margin:0 auto 24px;overflow:hidden;clip-path:inset(0);position:relative;page-break-after:always;break-after:page;box-shadow:${isPreview ? '0 8px 40px rgba(0,0,0,0.55)' : 'none'};}
.cover{height:297mm;max-height:297mm;position:relative;display:flex;flex-direction:column;color:#fff;overflow:hidden;clip-path:inset(0);}
.cover-bg{position:absolute;inset:0;z-index:0;}
.cover-bg img,.cover-bg div{width:100%;height:100%;object-fit:cover;object-position:center 15%;}
.cover-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,3,1,0.62) 0%,rgba(5,3,1,0.18) 28%,rgba(5,3,1,0.10) 48%,rgba(5,3,1,0.55) 68%,rgba(5,3,1,0.92) 88%,rgba(5,3,1,0.97) 100%);}
.cover-topbar{position:relative;z-index:5;padding:9mm 12mm 0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.cover-logo img,.cover-logo div{height:58px;}
.cover-official{font-size:6pt;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:#FFB347;background:rgba(232,132,26,0.20);border:1px solid rgba(232,132,26,0.50);padding:3px 10px;border-radius:100px;}
.cover-spacer{flex:1;}
.cover-content{position:relative;z-index:3;padding:0 13mm;}
.cover-eyebrow{display:block;font-size:6.5pt;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#FFB347;margin-bottom:4mm;}
.cover-title{font-family:Georgia,serif;font-size:38pt;font-weight:700;line-height:1.08;color:#fff;margin-bottom:4mm;letter-spacing:-0.01em;}
.cover-title em{font-style:normal;font-weight:400;color:#FFB347;display:block;font-size:28pt;letter-spacing:0.04em;}
.cover-rule{width:32mm;height:2px;background:linear-gradient(to right,#E8841A,#FFB347,transparent);margin-bottom:5mm;}
.cover-tagline{font-size:9pt;color:rgba(255,255,255,0.78);line-height:1.60;font-weight:300;max-width:145mm;margin-bottom:7mm;}
.cover-stats{display:flex;gap:0;margin-bottom:7mm;border:1px solid rgba(255,255,255,0.15);border-radius:10px;overflow:hidden;width:fit-content;}
.cover-stat{padding:4mm 7mm;text-align:center;border-right:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);backdrop-filter:blur(6px);}
.cover-stat:last-child{border-right:none;}
.cover-stat-num{font-family:Georgia,serif;font-size:15pt;font-weight:700;color:#FFB347;display:block;line-height:1.1;}
.cover-stat-label{font-size:5pt;color:rgba(255,255,255,0.55);letter-spacing:0.1em;text-transform:uppercase;display:block;margin-top:1mm;}
.cover-pkgs{display:flex;flex-wrap:wrap;gap:2.5mm;margin-bottom:8mm;}
.cover-pkg{font-size:7pt;font-weight:600;padding:2mm 5mm;border-radius:100px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.20);color:rgba(255,255,255,0.85);}
.cover-pkg.accent{background:rgba(232,132,26,0.20);border-color:rgba(232,132,26,0.50);color:#FFB347;}
.cover-footer{position:relative;z-index:3;display:flex;align-items:center;gap:6mm;padding:4mm 13mm;background:rgba(0,0,0,0.30);backdrop-filter:blur(8px);border-top:1px solid rgba(255,255,255,0.12);flex-shrink:0;}
.cover-footer-item{font-size:7pt;color:rgba(255,255,255,0.70);font-weight:500;display:flex;align-items:center;gap:2.5mm;}
.cover-footer-dot{width:4px;height:4px;border-radius:50%;background:#E8841A;flex-shrink:0;}
.itin-page{height:297mm;max-height:297mm;display:flex;flex-direction:column;background:#fff;overflow:hidden;clip-path:inset(0);}
.itin-hd{position:relative;height:38mm;overflow:hidden;clip-path:inset(0);flex-shrink:0;display:flex;flex-direction:column;justify-content:space-between;padding:5mm 10mm;}
.itin-hd-bg{position:absolute;inset:0;z-index:0;}
.itin-hd-bg img,.itin-hd-bg div{width:100%;height:100%;object-fit:cover;}
.itin-hd-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(160deg,rgba(5,3,1,0.80) 0%,rgba(5,3,1,0.40) 55%,rgba(5,3,1,0.88) 100%);}
.itin-hd-top,.itin-hd-bottom{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;}
.itin-hd-eyebrow{font-size:5pt;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,179,71,0.80);}
.itin-hd-logo img,.itin-hd-logo div{height:22px;}
.itin-hd-title{font-family:Georgia,serif;font-size:17pt;font-weight:700;color:#fff;letter-spacing:-0.01em;}
.itin-hd-title em{color:#FFB347;font-style:normal;}
.itin-hd-stats{display:flex;gap:6mm;}
.itin-stat{text-align:right;}
.itin-stat-num{font-family:'Cormorant Garamond',Georgia,serif;font-size:11pt;font-weight:700;color:#FFB347;display:block;line-height:1.1;}
.itin-stat-label{font-size:4pt;color:rgba(255,255,255,0.50);letter-spacing:0.12em;text-transform:uppercase;}
.itin-cols{display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden;clip-path:inset(0);gap:0;border-top:2px solid var(--saffron);}
.itin-cols-3{grid-template-columns:1fr 1fr 1fr;}
.day-col{display:flex;flex-direction:column;overflow:hidden;clip-path:inset(0);border-right:1px solid #E8DDD0;}
.day-col:last-child{border-right:none;}
.day-mosaic{display:grid;grid-template-columns:repeat(2,1fr);gap:0.8mm;flex-shrink:0;height:32mm;background:#1A1108;}
.day-mosaic-img{position:relative;overflow:hidden;}
.day-mosaic-img img,.day-mosaic-img div{width:100%;height:100%;object-fit:cover;display:block;}
.day-mosaic-img:only-child{grid-column:span 2;}
.day-mosaic-img .day-mosaic-label{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.72),transparent);color:rgba(255,255,255,0.92);font-size:4pt;font-weight:700;padding:1.5mm 3mm 1.2mm;letter-spacing:0.06em;text-transform:uppercase;}
.day-hd{display:flex;align-items:center;gap:2.5mm;padding:2mm 4mm;background:#FBF6EF;border-bottom:1px solid #E8DDD0;flex-shrink:0;}
.day-num{width:7mm;height:7mm;border-radius:50%;background:var(--saffron);color:#fff;font-size:8pt;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;letter-spacing:-0.05em;}
.day-hd-title{font-family:Georgia,serif;font-size:8.5pt;font-weight:700;color:var(--espresso);display:block;line-height:1.2;}
.day-hd-sub{font-size:4.5pt;color:var(--muted);letter-spacing:0.06em;text-transform:uppercase;}
.day-acts{flex:1;overflow:hidden;clip-path:inset(0);display:flex;flex-direction:column;padding:1.5mm 4mm;gap:0;}
.act{display:flex;align-items:flex-start;gap:2mm;padding:2mm 0;border-bottom:1px solid #F0E8DC;}
.act:last-child{border-bottom:none;}
.act-icon{width:9mm;height:9mm;border-radius:3px;background:#FFF3E0;display:flex;align-items:center;justify-content:center;font-size:10pt;flex-shrink:0;}
.act-body{display:flex;flex-direction:column;gap:0.4mm;min-width:0;}
.act-name{font-size:6pt;font-weight:700;color:var(--espresso);line-height:1.25;}
.act-desc{font-size:5.5pt;color:#5A4040;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.act-tag{font-size:4.8pt;font-weight:700;color:#E8841A;background:#FFF3E0;padding:1px 5px;border-radius:100px;letter-spacing:0.05em;align-self:flex-start;}
.day-note{background:linear-gradient(90deg,rgba(232,132,26,0.1),transparent);border-left:2px solid var(--saffron);padding:2mm 3mm;margin-bottom:2mm;border-radius:0 4px 4px 0;}
.day-note-text{font-size:6.5pt;font-weight:700;color:var(--saffron-dk);}
.day-note-sub{font-size:5pt;color:var(--muted);margin-top:0.5mm;}
.day-sched{margin-top:auto;border-top:1px dashed rgba(232,132,26,0.30);padding:3mm 4mm;background:linear-gradient(to bottom,#FFFCF8,#FFF7ED);flex-shrink:0;}
.day-sched-ttl{font-size:4.8pt;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:#C96A10;margin-bottom:2mm;}
.day-sched-row{display:flex;gap:2mm;align-items:baseline;padding:1mm 0;border-bottom:1px solid rgba(232,213,192,0.45);}
.day-sched-row:last-child{border-bottom:none;}
.ds-t{font-size:5.2pt;font-weight:700;color:#1A1108;white-space:nowrap;min-width:14mm;}
.ds-a{font-size:5.2pt;color:#5A4040;line-height:1.3;}
.day-tips{border-top:1px solid #EDE5DA;padding:2.5mm 4mm;background:#FFFAF5;flex-shrink:0;}
.day-tips-ttl{font-size:4.8pt;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:#7A5030;margin-bottom:1.8mm;}
.day-tips-items{display:flex;flex-direction:column;gap:1.5mm;}
.dtip{font-size:5.2pt;color:#5A4040;line-height:1.35;}
.itin-ft{flex-shrink:0;background:var(--espresso);padding:2.5mm 10mm;display:flex;align-items:center;justify-content:space-between;}
.itin-ft-note{font-size:5pt;color:rgba(255,255,255,0.50);line-height:1.4;}
.itin-ft-brand{font-size:5.5pt;font-weight:700;color:#FFB347;white-space:nowrap;flex-shrink:0;}
.hotel-page{height:297mm;max-height:297mm;display:flex;flex-direction:column;background:#fff;overflow:hidden;clip-path:inset(0);}
.hotel-hd{position:relative;height:36mm;overflow:hidden;flex-shrink:0;display:flex;flex-direction:column;justify-content:space-between;padding:5mm 10mm;}
.hotel-hd-bg{position:absolute;inset:0;z-index:0;}
.hotel-hd-bg img,.hotel-hd-bg div{width:100%;height:100%;object-fit:cover;}
.hotel-hd-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,3,1,0.72) 0%,rgba(5,3,1,0.40) 50%,rgba(5,3,1,0.88) 100%);}
.hotel-hd-top,.hotel-hd-bottom{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;}
.hotel-hd-eyebrow{font-size:5.5pt;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#FFB347;}
.hotel-hd-logo img,.hotel-hd-logo div{height:22px;}
.hotel-hd-title{font-family:Georgia,serif;font-size:16pt;font-weight:700;color:#fff;}
.hotel-hd-title em{color:#FFB347;font-style:normal;}
.hotel-hd-sub{font-size:6.5pt;color:rgba(255,255,255,0.60);margin-top:2mm;}
.hotel-cards-grid{flex:1;overflow:hidden;clip-path:inset(0);display:flex;flex-direction:column;padding:4mm 7mm;gap:2.5mm;background:#F7F2EB;}
.hotel-row-label{flex-shrink:0;padding:0 0.5mm;font-size:5pt;font-weight:700;letter-spacing:0.20em;text-transform:uppercase;color:rgba(26,17,8,0.45);display:flex;align-items:center;gap:3mm;}
.hotel-row-label::after{content:'';flex:1;height:0.5px;background:rgba(26,17,8,0.18);}
.hotel-row{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;flex:1;overflow:hidden;clip-path:inset(0);}
.hcard{display:flex;flex-direction:column;position:relative;overflow:hidden;border-radius:5px;border:1px solid rgba(26,17,8,0.08);background:#fff;}
.hcard.popular{border-color:var(--saffron);}
.hcard-img{overflow:hidden;position:relative;height:32mm;flex-shrink:0;background:#2B1A0A;}
.hcard-img img,.hcard-img div{width:100%;height:100%;object-fit:cover;display:block;}
.hcard-img::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(10,5,1,0.80) 0%,rgba(10,5,1,0.20) 50%,transparent 75%);}
.hcard-tier{position:absolute;top:3.5px;left:3.5px;z-index:3;font-size:4.5pt;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;padding:1.5px 6px;border-radius:2px;background:rgba(10,5,1,0.65);color:rgba(255,255,255,0.85);}
.hcard-tier.popular{background:var(--saffron);color:#fff;}
.hcard-price-overlay{position:absolute;bottom:0;left:0;right:0;z-index:2;padding:2mm 3.5mm;}
.hcard-from{font-size:4pt;color:rgba(255,255,255,0.50);text-transform:uppercase;letter-spacing:0.12em;display:block;margin-bottom:0.3mm;}
.hcard-price-big{font-family:Georgia,serif;font-size:12pt;font-weight:700;color:#FFB347;line-height:1;}
.hcard-price-big sub{font-family:Arial,Helvetica,sans-serif;font-size:4.5pt;font-weight:400;color:rgba(255,255,255,0.50);font-style:normal;vertical-align:baseline;}
.hcard-body{flex-shrink:0;padding:2mm 3.5mm 2.5mm;display:flex;flex-direction:column;gap:0;}
.hcard-name{font-family:Georgia,serif;font-size:7.5pt;font-weight:700;color:var(--espresso);margin-bottom:0.5mm;line-height:1.2;}
.hcard-type{font-size:4.5pt;color:var(--muted);margin-bottom:1.5mm;letter-spacing:0.04em;}
.hcard-tags{display:flex;flex-wrap:wrap;gap:1.5px;}
.hcard-tag{color:#6B4020;font-size:4.5pt;padding:1px 4px;border:0.5px solid #DDD0B8;border-radius:2px;}
/* ── Pricing Page ── */
.rates-pg{height:297mm;max-height:297mm;display:flex;flex-direction:column;background:#fff;overflow:hidden;clip-path:inset(0);}
.rates-legend{flex-shrink:0;display:flex;gap:3mm;padding:2.5mm 8mm;background:#FFFAF5;border-bottom:1px solid #EDE5DA;flex-wrap:wrap;}
.rates-pill{font-size:5pt;font-weight:600;color:#7A5030;background:#FFF3E0;border:1px solid #E8D5C0;padding:1.5px 5mm;border-radius:100px;letter-spacing:0.04em;}
.rates-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:4mm;padding:4mm 8mm;overflow:hidden;}
.rc{background:#fff;border-radius:6px;border:1px solid #E8D5C0;overflow:hidden;display:flex;flex-direction:column;}
.rc-pop{border-color:#E8841A;box-shadow:0 0 0 1.5px rgba(232,132,26,0.25);}
.rc-hd{background:#1A1108;padding:2.5mm 3.5mm;display:flex;justify-content:space-between;align-items:flex-start;gap:2mm;}
.rc-name{font-size:6.5pt;font-weight:700;color:#FFB347;line-height:1.25;flex:1;}
.rc-tier{font-size:4.8pt;color:rgba(255,255,255,0.50);text-transform:uppercase;letter-spacing:0.08em;font-weight:600;white-space:nowrap;padding-top:0.5mm;}
.rt{width:100%;border-collapse:collapse;font-size:5.2pt;font-family:Arial,Helvetica,sans-serif;}
.rt thead tr:first-child th{background:#F0E8DC;color:#5A3010;font-weight:700;padding:1.5mm 2mm;text-align:center;border-bottom:1px solid #E8D5C0;font-size:4.8pt;letter-spacing:0.04em;}
.rt thead tr:first-child th:first-child{text-align:left;background:transparent;}
.rt thead tr:nth-child(2) th{background:#F7F0E8;color:#7A5030;font-weight:600;padding:1.2mm 2mm;text-align:center;border-bottom:1px solid #EDE5DA;font-size:4.5pt;text-transform:uppercase;letter-spacing:0.03em;}
.rt thead tr:nth-child(2) th:first-child{text-align:left;}
.rt-pkg{font-size:5pt !important;}
.rt-sep{border-left:1.5px solid #DDD0C0 !important;}
.rt-room-lbl{text-align:left !important;color:#5A4040;font-weight:500;}
.rt-wd{color:#2D1A0A;font-weight:600;}
.rt-we{color:#C96A10;font-weight:600;}
.rt td{padding:1.5mm 2mm;text-align:center;border-bottom:1px solid #F5EDE3;font-size:5.2pt;}
.rt tbody tr:last-child td{border-bottom:none;}
.rt tbody tr:nth-child(even){background:#FFFBF8;}
/* ── Inclusions page ── */
.incl-wrap{flex:1;overflow:hidden;display:flex;flex-direction:column;border-bottom:1px solid #EDE5DA;}
.incl-grid{display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden;}
.incl-col{padding:4mm 7mm;border-right:1px solid #EDE5DA;overflow:hidden;display:flex;flex-direction:column;}
.incl-col:last-child{border-right:none;}
.incl-heading{font-size:7pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:2mm 3mm;margin-bottom:2.5mm;border-radius:4px;}
.incl-heading.yes{background:#F0FDF4;color:#15803D;}
.incl-heading.no{background:#FEF2F2;color:#B91C1C;}
.incl-list{list-style:none;flex:1;display:flex;flex-direction:column;gap:0;}
.incl-item{display:flex;align-items:flex-start;gap:6px;font-size:6.5pt;color:#3D2B1F;padding:1.8mm 0;border-bottom:1px solid #F0EAE0;line-height:1.35;}
.incl-item:last-child{border-bottom:none;}
.ic-yes{color:#16A34A;font-size:7.5pt;flex-shrink:0;line-height:1.35;}
.ic-no{color:#DC2626;font-size:7.5pt;flex-shrink:0;line-height:1.35;}
.incl-addon-bar{background:linear-gradient(90deg,#1A1108 0%,#2B1A0A 100%);border-top:2px solid var(--saffron);padding:3.5mm 7mm;display:flex;gap:7mm;align-items:center;flex-shrink:0;}
.incl-addon-label{font-size:6.5pt;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:var(--saffron);white-space:nowrap;flex-shrink:0;padding-right:7mm;border-right:1px solid rgba(232,132,26,0.35);}
.incl-addon-items{display:flex;gap:6mm;flex-wrap:wrap;align-items:center;}
.incl-addon-item{font-size:6.5pt;color:rgba(255,255,255,0.88);display:flex;align-items:center;gap:4px;}
.incl-addon-item::before{content:'＋';color:var(--saffron);font-weight:800;font-size:8pt;}
.terms{background:#FFF7ED;flex-shrink:0;padding:3mm 12mm;border-bottom:1px solid #EDE5DA;}
.terms-label{font-size:6pt;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--espresso);margin-bottom:1.5mm;}
.terms-body{font-size:5.5pt;color:var(--muted);line-height:1.55;}
.contact-ft{background:var(--espresso);flex-shrink:0;padding:4mm 12mm;display:flex;align-items:center;gap:10mm;}
.contact-ft-logo{flex-shrink:0;}
.contact-ft-logo img,.contact-ft-logo div{height:36px;}
.contact-ft-divider{width:1px;height:28px;background:rgba(255,255,255,0.15);flex-shrink:0;}
.contact-ft-details{display:flex;gap:10mm;flex:1;}
.contact-ft-item{display:flex;flex-direction:column;}
.contact-ft-lbl{font-size:5.5pt;color:rgba(255,255,255,0.40);letter-spacing:0.10em;text-transform:uppercase;margin-bottom:1mm;}
.contact-ft-val{font-size:7.5pt;color:rgba(255,255,255,0.88);font-weight:500;}
.contact-ft-phone{font-family:Georgia,serif;font-size:11pt;font-weight:700;color:var(--saffron);white-space:nowrap;flex-shrink:0;}
.contact-ft-phone-lbl{font-size:5.5pt;color:rgba(255,255,255,0.40);letter-spacing:0.10em;text-transform:uppercase;display:block;margin-bottom:1mm;}
</style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page">
  <div class="cover">
    <div class="cover-bg">${coverImgEl}</div>
    <div class="cover-topbar">
      <div class="cover-logo">${logoEl}</div>
      <span class="cover-official">✦ Trusted Booking Partner of Statue of Unity</span>
    </div>
    ${personalBanner}
    <div class="cover-spacer"></div>
    <div class="cover-content">
      <span class="cover-eyebrow">Kevadia, Gujarat · India</span>
      <h1 class="cover-title">Statue of Unity<em>${coverSubtitle}</em></h1>
      <div class="cover-rule"></div>
      ${customNoteHtml}
      <p class="cover-tagline">${tagline}</p>
      <div class="cover-stats">
        <div class="cover-stat"><span class="cover-stat-num">13+</span><span class="cover-stat-label">Attractions</span></div>
        <div class="cover-stat"><span class="cover-stat-num">6</span><span class="cover-stat-label">Hotels</span></div>
        <div class="cover-stat"><span class="cover-stat-num">${cheapestPrice}</span><span class="cover-stat-label">Starting / pax</span></div>
        <div class="cover-stat"><span class="cover-stat-num">2–3</span><span class="cover-stat-label">Day Options</span></div>
      </div>
      <div class="cover-pkgs">
        ${show1N2D ? '<div class="cover-pkg accent">1 Night · 2 Days Package</div>' : ''}
        ${show2N3D ? '<div class="cover-pkg accent">2 Nights · 3 Days Package</div>' : ''}
        <div class="cover-pkg">All Entry Tickets Included</div>
        <div class="cover-pkg">E-Auto Sightseeing · Meals</div>
        <div class="cover-pkg">6 Hotel Options · Expert Support</div>
      </div>
    </div>
    <div class="cover-footer">
      <div class="cover-footer-item"><span class="cover-footer-dot"></span>+91 92747 30220</div>
      <div class="cover-footer-item"><span class="cover-footer-dot"></span>statueofunitybooking.com</div>
      <div class="cover-footer-item"><span class="cover-footer-dot"></span>booking@thetourismexperts.com</div>
    </div>
  </div>
</div>

${page2}

${page3}

<!-- PAGE 4: HOTELS -->
<div class="page">
  <div class="hotel-page">
    <div class="hotel-hd">
      <div class="hotel-hd-bg">${pageImgEl('assets/images/gallery/generic-5.webp','linear-gradient(180deg,#1a1108,#3a2010)')}</div>
      <div class="hotel-hd-top"><span class="hotel-hd-eyebrow">Choose Your Stay</span><div class="hotel-hd-logo">${logoEl}</div></div>
      <div class="hotel-hd-bottom"><div class="hotel-hd-title">Accommodation Options &amp; <em>Hotel Showcase</em></div><p class="hotel-hd-sub">Six handpicked properties — from glamping to luxury. Detailed pricing overleaf.</p></div>
    </div>
    ${hotelPageBodyHtml}
    <div class="contact-ft"><div class="contact-ft-logo">${logoWhiteEl}</div><div class="contact-ft-divider"></div><div class="contact-ft-details"><div class="contact-ft-item"><span class="contact-ft-lbl">Email</span><span class="contact-ft-val">booking@thetourismexperts.com</span></div><div class="contact-ft-item"><span class="contact-ft-lbl">Website</span><span class="contact-ft-val">statueofunitybooking.com</span></div></div><div><span class="contact-ft-phone-lbl">WhatsApp / Call</span><div class="contact-ft-phone">+91 92747 30220</div></div></div>
  </div>
</div>

<!-- PAGE 5: RATE TABLES -->
${pricingPageHtml}

<!-- PAGE 6: INCLUSIONS + TERMS -->
<div class="page">
  <div class="hotel-page">
    <div class="hotel-hd">
      <div class="hotel-hd-bg">${pageImgEl('assets/images/gallery/generic-7.webp','linear-gradient(180deg,#0d1a2a,#1a3a5a)')}</div>
      <div class="hotel-hd-top"><span class="hotel-hd-eyebrow">Package Details</span><div class="hotel-hd-logo">${logoEl}</div></div>
      <div class="hotel-hd-bottom"><div class="hotel-hd-title">What's Included &amp; <em>Important Info</em></div><p class="hotel-hd-sub">Everything covered in your package — and what to budget additionally.</p></div>
    </div>
    <div class="incl-wrap">
      <div class="incl-grid">
        <div class="incl-col">
          <div class="incl-heading yes">✓ &nbsp;What's Included</div>
          <ul class="incl-list">
            <li class="incl-item"><span class="ic-yes">✓</span> Accommodation (as per selected hotel category)</li>
            <li class="incl-item"><span class="ic-yes">✓</span> Welcome drink on arrival</li>
            <li class="incl-item"><span class="ic-yes">✓</span> Breakfast &amp; Dinner (1N2D) · All Meals B+L+D (2N3D)</li>
            <li class="incl-item"><span class="ic-yes">✓</span> E-Auto for sightseeing — Day 1 &amp; Day 2</li>
            <li class="incl-item"><span class="ic-yes">✓</span> Private AC car for Day 3 temple circuit <em>(2N3D only)</em></li>
            <li class="incl-item"><span class="ic-yes">✓</span> Statue of Unity entry + Viewing Gallery tickets</li>
            <li class="incl-item"><span class="ic-yes">✓</span> Jungle Safari entry ticket</li>
            <li class="incl-item"><span class="ic-yes">✓</span> All garden entries — Cactus, Butterfly, Arogya Van</li>
            <li class="incl-item"><span class="ic-yes">✓</span> GST as applicable</li>
            <li class="incl-item"><span class="ic-yes">✓</span> Children below 5: Complimentary · Age 5–12: 50% of adult</li>
          </ul>
        </div>
        <div class="incl-col">
          <div class="incl-heading no">✕ &nbsp;Not Included</div>
          <ul class="incl-list">
            <li class="incl-item"><span class="ic-no">✗</span> Train / Flight tickets to Kevadia or Ekta Nagar</li>
            <li class="incl-item"><span class="ic-no">✗</span> Laser &amp; Light Show (separate ticket if operational)</li>
            <li class="incl-item"><span class="ic-no">✗</span> Ekta Cruise / River Rafting (optional add-on)</li>
            <li class="incl-item"><span class="ic-no">✗</span> Personal expenses, shopping &amp; tips</li>
            <li class="incl-item"><span class="ic-no">✗</span> Camera charges at ticketed venues</li>
            <li class="incl-item"><span class="ic-no">✗</span> Any activity not mentioned in the itinerary</li>
            <li class="incl-item"><span class="ic-no">✗</span> Medical / travel insurance</li>
          </ul>
        </div>
      </div>
      <div class="incl-addon-bar">
        <span class="incl-addon-label">Optional Add-ons</span>
        <div class="incl-addon-items">
          <span class="incl-addon-item">Ekta Cruise — ₹470/person</span>
          <span class="incl-addon-item">River Rafting — ₹1,150/person</span>
          <span class="incl-addon-item">Narmada Aarti Boat Seat — ₹1,270/person</span>
        </div>
      </div>
    </div>
    <div class="terms">
      <p class="terms-label">Terms &amp; Conditions</p>
      <p class="terms-body">Prices are per person based on double/twin sharing · Rates valid for Indian nationals · Subject to availability at time of booking · Peak season surcharge may apply (Diwali, New Year, summer holidays, long weekends) · Cancellation Policy: 30+ days before travel = Full refund · 15–30 days = 50% refund · Less than 15 days = No refund · Itinerary sequence may vary based on timings and local conditions · Package rates include taxes as applicable.</p>
    </div>
    <div class="contact-ft"><div class="contact-ft-logo">${logoWhiteEl}</div><div class="contact-ft-divider"></div><div class="contact-ft-details"><div class="contact-ft-item"><span class="contact-ft-lbl">Email</span><span class="contact-ft-val">booking@thetourismexperts.com</span></div><div class="contact-ft-item"><span class="contact-ft-lbl">Website</span><span class="contact-ft-val">statueofunitybooking.com</span></div></div><div><span class="contact-ft-phone-lbl">WhatsApp / Call</span><div class="contact-ft-phone">+91 92747 30220</div></div></div>
  </div>
</div>

${autoPrint}
</body>
</html>`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className={cn('border rounded-xl overflow-hidden mb-3', isDark ? 'border-gray-700' : 'border-gray-200')}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold transition-colors', isDark ? 'bg-gray-800 text-gray-100 hover:bg-gray-750' : 'bg-gray-50 text-gray-800 hover:bg-gray-100')}>
        <span className="opacity-60">{icon}</span>
        {title}
        <span className="ml-auto opacity-40">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {open && <div className={cn('px-4 py-3 space-y-3', isDark ? 'bg-gray-850' : 'bg-white')}>{children}</div>}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { theme } = useTheme();
  return (
    <div>
      <label className={cn('block text-xs font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{label}</label>
      {children}
    </div>
  );
};

const inputCls = (isDark: boolean) => cn(
  'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
  isDark ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500 focus:border-amber-500' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-amber-500'
);

const ImageUpload: React.FC<{
  label: string;
  value: string;
  onChange: (url: string) => void;
  uploadPath?: string; // if set → uploads to Supabase Storage and returns public URL
  compact?: boolean;
}> = ({ label, value, onChange, uploadPath, compact }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (uploadPath) {
      setUploading(true);
      try {
        const url = await uploadToStorage(file, uploadPath);
        onChange(url);
      } catch (err) {
        setError('Upload failed — check connection');
        console.error(err);
      } finally {
        setUploading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = ev => onChange(ev.target?.result as string ?? '');
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      {!compact && label && <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>{label}</label>}
      <div className="flex gap-2 items-center flex-wrap">
        {value ? (
          <div className="relative rounded-lg overflow-hidden border border-amber-400 flex-shrink-0" style={{ width: compact ? 40 : 72, height: compact ? 28 : 48 }}>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange('')} className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-white">
              <Trash2 size={8} />
            </button>
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className={cn('flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors', uploading ? 'opacity-60 cursor-wait' : '', isDark ? 'border-gray-600 text-gray-300 hover:border-amber-500 hover:text-amber-400' : 'border-gray-300 text-gray-600 hover:border-amber-500 hover:text-amber-600')}>
            <Upload size={11} />
            {uploading ? 'Uploading…' : value ? (compact ? 'Change' : 'Replace Photo') : (compact ? 'Upload' : 'Upload Photo')}
          </button>
          {uploadPath && !uploading && (
            <span className={cn('text-xs opacity-40', isDark ? 'text-gray-400' : 'text-gray-500')}>Saved to Supabase Storage</span>
          )}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
};

// ─── Hotel Rate Editor (Manage tab) ───────────────────────────────────────────

const HotelEditor: React.FC<{ hotel: HotelData; onChange: (h: HotelData) => void }> = ({ hotel, onChange }) => {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const tinyInput = cn('rounded border px-2 py-1 text-xs outline-none w-full transition-colors',
    isDark ? 'bg-gray-700 border-gray-600 text-gray-100 focus:border-amber-500' : 'bg-white border-gray-200 text-gray-800 focus:border-amber-500');

  const updateRate = (idx: number, field: keyof RoomRate, val: string) => {
    const rates = hotel.rates.map((r, i) => i === idx ? { ...r, [field]: val } : r);
    onChange({ ...hotel, rates });
  };

  return (
    <div className={cn('border rounded-xl overflow-hidden mb-3', isDark ? 'border-gray-700' : 'border-gray-200')}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center gap-3 px-4 py-3 text-left transition-colors', isDark ? 'bg-gray-800 text-gray-100 hover:bg-gray-750' : 'bg-gray-50 text-gray-800 hover:bg-gray-100')}>
        {hotel.photo && <div className="w-9 h-6 rounded overflow-hidden flex-shrink-0"><img src={hotel.photo} alt="" className="w-full h-full object-cover" /></div>}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{hotel.name}</div>
          <div className="text-xs opacity-50 truncate">{hotel.location}</div>
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0', hotel.popular ? 'bg-amber-500 text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600')}>
          {hotel.tier}
        </span>
        <span className="opacity-40 flex-shrink-0">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>

      {open && (
        <div className={cn('px-4 py-4 space-y-4', isDark ? 'bg-gray-900' : 'bg-white')}>
          {/* Photo */}
          <div>
            <p className={cn('text-xs font-semibold mb-2', isDark ? 'text-gray-300' : 'text-gray-600')}>Hotel Photo (shown in brochure)</p>
            <ImageUpload label="" value={hotel.photo} onChange={photo => onChange({ ...hotel, photo })} uploadPath={`hotels/${hotel.id}`} />
          </div>

          {/* Rates */}
          <div>
            <p className={cn('text-xs font-semibold mb-2', isDark ? 'text-gray-300' : 'text-gray-600')}>Room Rates (per person)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className={cn('text-left pb-2 pr-2 font-semibold', isDark ? 'text-gray-400' : 'text-gray-500')} style={{ minWidth: 110 }}>Room Type</th>
                    <th className={cn('pb-2 px-1 font-semibold text-center', isDark ? 'text-gray-400' : 'text-gray-500')} style={{ minWidth: 72 }}>1N2D WD</th>
                    <th className={cn('pb-2 px-1 font-semibold text-center', isDark ? 'text-gray-400' : 'text-gray-500')} style={{ minWidth: 72 }}>1N2D WE</th>
                    <th className={cn('pb-2 px-1 font-semibold text-center border-l', isDark ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-200')} style={{ minWidth: 72 }}>2N3D WD</th>
                    <th className={cn('pb-2 pl-1 font-semibold text-center', isDark ? 'text-gray-400' : 'text-gray-500')} style={{ minWidth: 72 }}>2N3D WE</th>
                  </tr>
                </thead>
                <tbody>
                  {hotel.rates.map((rate, idx) => (
                    <tr key={idx}>
                      <td className="py-1 pr-2">
                        <input value={rate.type} onChange={e => updateRate(idx, 'type', e.target.value)} className={tinyInput} />
                      </td>
                      <td className="py-1 px-1"><input value={rate.wd1n2d} onChange={e => updateRate(idx, 'wd1n2d', e.target.value)} className={tinyInput} /></td>
                      <td className="py-1 px-1"><input value={rate.we1n2d} onChange={e => updateRate(idx, 'we1n2d', e.target.value)} className={cn(tinyInput, 'text-amber-600')} /></td>
                      <td className={cn('py-1 px-1 border-l', isDark ? 'border-gray-700' : 'border-gray-200')}><input value={rate.wd2n3d} onChange={e => updateRate(idx, 'wd2n3d', e.target.value)} className={tinyInput} /></td>
                      <td className="py-1 pl-1"><input value={rate.we2n3d} onChange={e => updateRate(idx, 'we2n3d', e.target.value)} className={cn(tinyInput, 'text-amber-600')} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={cn('text-xs mt-2 opacity-50', isDark ? 'text-gray-400' : 'text-gray-500')}>WD = Weekday · WE = Weekend · Amber columns = weekend prices</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const SouBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'builder' | 'manage'>('builder');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Shared hotel data — loaded from Supabase on mount
  const [hotels, setHotels] = useState<HotelData[]>(() => DEFAULT_HOTELS.map(h => ({ ...h })));

  // Global default cover (Supabase URL)
  const [defaultCoverUrl, setDefaultCoverUrl] = useState<string>('');

  // Load global settings from Supabase on mount
  useEffect(() => {
    loadGlobalSettings().then(s => {
      if (s) {
        setHotels(mergeHotels(s.hotels));
        if (s.defaultCoverUrl) setDefaultCoverUrl(s.defaultCoverUrl);
      }
      setSettingsLoading(false);
    });
  }, []);

  // Builder state (per-quote, not persisted)
  const [clientName, setClientName] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [show1N2D, setShow1N2D] = useState(true);
  const [show2N3D, setShow2N3D] = useState(true);
  const [showPricing, setShowPricing] = useState(true);
  const [coverImgB64, setCoverImgB64] = useState(''); // per-quote override (base64)
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [quoteRates, setQuoteRates] = useState({ rate1n2d: '', rate2n3d: '' });
  const [coverSubtitle, setCoverSubtitle] = useState('Experience Packages');
  const [tagline, setTagline] = useState("Handcrafted itineraries at the world's tallest statue — combining wildlife, gardens, spirituality & luxury stays, personalised to your pace.");
  const [pdfProgress, setPdfProgress] = useState(0); // 0=idle, 1-100=generating
  const [showAddHotel, setShowAddHotel] = useState(false);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelLocation, setNewHotelLocation] = useState('');
  const [newHotelTier, setNewHotelTier] = useState('3-Star Hotel');

  const handleDefaultCoverChange = (url: string) => {
    setDefaultCoverUrl(url);
    saveGlobalSettings(hotels, url).catch(() => {});
  };

  const brochureData: BrochureData = useMemo(() => ({
    clientName, travelDate, groupSize, customNote,
    show1N2D, show2N3D, showPricing, hotels, coverImgB64, defaultCoverUrl, isPreview: true,
    selectedHotelIds, quoteRates, coverSubtitle, tagline,
  }), [clientName, travelDate, groupSize, customNote, show1N2D, show2N3D, showPricing, hotels, coverImgB64, defaultCoverUrl, selectedHotelIds, quoteRates, coverSubtitle, tagline]);

  const previewHtml = useMemo(() => {
    try { return generateBrochureHtml(brochureData); }
    catch (e) { return '<html><body style="color:red;padding:20px;font-family:sans-serif;">Preview error: ' + String(e) + '</body></html>'; }
  }, [brochureData]);

  const compressToDataUrl = (src: string, maxW = 900): Promise<string> =>
    new Promise((resolve) => {
      if (!src) return resolve(src);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const scale = Math.min(maxW / img.naturalWidth, 1);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });

  const handleDownloadPdf = async () => {
    if (pdfProgress > 0) return;
    setPdfProgress(5);
    let styleEl: HTMLStyleElement | null = null;
    let container: HTMLDivElement | null = null;
    try {
      // Step 1: compress all images
      const coverSrc = brochureData.coverImgB64 || defaultCoverUrl;
      const compressedCover = coverSrc ? await compressToDataUrl(coverSrc) : '';
      const compressedHotels = await Promise.all(
        hotels.map(async (h) => ({
          ...h,
          photo: h.photo ? await compressToDataUrl(h.photo) : h.photo,
        }))
      );
      setPdfProgress(25);

      // Step 2: generate HTML with compressed images
      const html = generateBrochureHtml({
        ...brochureData,
        hotels: compressedHotels,
        coverImgB64: compressedCover,
        defaultCoverUrl: '',
        isPreview: false,
      });

      // Step 3: extract CSS + body and inject into DOM
      const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const cssContent = styleMatch ? styleMatch[1] : '';
      const bodyContent = bodyMatch ? bodyMatch[1] : '';

      styleEl = document.createElement('style');
      styleEl.id = '__pdf-tmp-styles';
      styleEl.textContent = cssContent + '\n.page{margin:0 !important;box-shadow:none !important;}';
      document.head.appendChild(styleEl);

      container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;pointer-events:none;';
      container.innerHTML = bodyContent;
      document.body.appendChild(container);

      // Wait for images to load inside injected HTML
      await new Promise(r => setTimeout(r, 1000));
      setPdfProgress(35);

      // Step 4: render each .page with html2canvas → jsPDF
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const pages = Array.from(container.querySelectorAll('.page')) as HTMLElement[];
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const progressPerPage = 60 / Math.max(pages.length, 1);

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 794,
          windowHeight: 1123,
        });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, 210, 297);
        setPdfProgress(35 + Math.round((i + 1) * progressPerPage));
      }

      // Step 5: download
      const filename = `SOU Package — ${brochureData.clientName || 'The Tourism Experts'}.pdf`;
      pdf.save(filename);

    } catch (e) {
      console.error('PDF error:', e);
      alert('PDF generation failed. Please try again.');
    } finally {
      if (styleEl) document.head.removeChild(styleEl);
      if (container) document.body.removeChild(container);
      setPdfProgress(0);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveGlobalSettings(hotels, defaultCoverUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert('Save failed — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!window.confirm('Reset all hotel rates and photos to factory defaults?')) return;
    const fresh = DEFAULT_HOTELS.map(h => ({ ...h }));
    setHotels(fresh);
  };

  const toggleSwitch = (val: boolean, setter: (v: boolean) => void) => (
    <button type="button" onClick={() => setter(!val)}
      className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0', val ? 'bg-amber-500' : isDark ? 'bg-gray-600' : 'bg-gray-300')}>
      <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform" style={{ transform: val ? 'translateX(18px)' : 'translateX(2px)' }} />
    </button>
  );

  return (
    <div className={cn('flex flex-col h-full min-h-0', isDark ? 'bg-gray-900' : 'bg-gray-50')}>

      {/* ── Header ── */}
      <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b flex-shrink-0 z-10', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
        <button type="button" onClick={() => navigate('/builder')}
          className={cn('flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0', isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100')}>
          <ArrowLeft size={14} /> Hub
        </button>
        <div className="h-4 w-px opacity-20 bg-current" />
        <span className="text-lg flex-shrink-0">🏛️</span>
        <div className="hidden sm:block">
          <div className={cn('text-sm font-bold leading-tight', isDark ? 'text-gray-100' : 'text-gray-800')}>SOU Package Builder</div>
          <div className={cn('text-xs opacity-40', isDark ? 'text-gray-300' : 'text-gray-600')}>Statue of Unity · Kevadia</div>
        </div>

        {/* Tabs */}
        <div className={cn('flex items-center rounded-lg p-0.5 ml-3 flex-shrink-0', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
          <button type="button" onClick={() => setActiveTab('builder')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all', activeTab === 'builder'
              ? isDark ? 'bg-gray-700 text-gray-100 shadow' : 'bg-white text-gray-800 shadow'
              : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}>
            <FileText size={12} /> Builder
          </button>
          <button type="button" onClick={() => setActiveTab('manage')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all', activeTab === 'manage'
              ? isDark ? 'bg-gray-700 text-gray-100 shadow' : 'bg-white text-gray-800 shadow'
              : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}>
            <Settings size={12} /> Rates &amp; Photos
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeTab === 'builder' && (<>
            <div className={cn('text-xs px-2 py-1 rounded-full hidden md:block', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500')}>
              Preview updates live
            </div>
            <button type="button" onClick={handleDownloadPdf} disabled={pdfProgress > 0}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-80 overflow-hidden min-w-[140px]"
              style={{ background: 'linear-gradient(135deg,#E8841A,#C96A10)' }}>
              {pdfProgress > 0 && (
                <span className="absolute inset-0 bg-black/20 rounded-xl" style={{ width: `${pdfProgress}%`, transition: 'width 0.4s ease' }} />
              )}
              <span className="relative flex items-center gap-2">
                {pdfProgress > 0
                  ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg> Generating… {pdfProgress}%</>
                  : <><Download size={14} /> Download PDF</>
                }
              </span>
            </button>
          </>)}
          {activeTab === 'manage' && (<>
            <button type="button" onClick={handleReset}
              className={cn('flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors', isDark ? 'border-gray-600 text-gray-400 hover:border-red-500 hover:text-red-400' : 'border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-600')}>
              <RefreshCw size={12} /> Reset
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-60', saved ? 'bg-green-500 text-white' : 'text-white hover:opacity-90 active:scale-95')}
              style={saved ? {} : { background: 'linear-gradient(135deg,#E8841A,#C96A10)' }}>
              <Save size={13} /> {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </>)}
        </div>
      </div>

      {/* ── Builder Tab ── */}
      {activeTab === 'builder' && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Editor */}
          <div className={cn('w-96 flex-shrink-0 overflow-y-auto border-r', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>

            {/* Section: Client */}
            <div className={cn('px-4 pt-4 pb-3 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <div className={cn('text-xs font-bold tracking-widest uppercase mb-3', isDark ? 'text-gray-500' : 'text-gray-400')}>1 — Client Details</div>
              <div className="space-y-2.5">
                <div>
                  <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>Client Name</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Sharma Family" className={inputCls(isDark)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>Travel Date</label>
                    <input value={travelDate} onChange={e => setTravelDate(e.target.value)} placeholder="24–26 Oct 2025" className={inputCls(isDark)} />
                  </div>
                  <div>
                    <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>Group Size</label>
                    <input value={groupSize} onChange={e => setGroupSize(e.target.value)} placeholder="4 Pax" className={inputCls(isDark)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Hotel */}
            <div className={cn('px-4 pt-3 pb-3 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <div className="flex items-center justify-between mb-1.5">
                <div className={cn('text-xs font-bold tracking-widest uppercase', isDark ? 'text-gray-500' : 'text-gray-400')}>2 — Select Hotels</div>
                <div className="flex items-center gap-2">
                  {selectedHotelIds.length > 0 && (
                    <span className="text-xs text-amber-600 font-semibold">{selectedHotelIds.length} selected</span>
                  )}
                  {selectedHotelIds.length > 0 && (
                    <button type="button" onClick={() => { setSelectedHotelIds([]); setQuoteRates({rate1n2d:'',rate2n3d:''}); }}
                      className="text-xs text-gray-400 hover:text-red-500 font-medium">Clear</button>
                  )}
                </div>
              </div>
              <p className={cn('text-xs mb-2.5 leading-relaxed', isDark ? 'text-gray-500' : 'text-gray-500')}>
                Select 1–6 hotels to feature. Click to toggle. Order of selection = order in PDF.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {hotels.map((h, idx) => {
                  const selIdx = selectedHotelIds.indexOf(h.id);
                  const isSelected = selIdx !== -1;
                  return (
                    <button key={h.id} type="button"
                      onClick={() => setSelectedHotelIds(prev =>
                        isSelected ? prev.filter(id => id !== h.id) : [...prev, h.id]
                      )}
                      className={cn('relative text-left rounded-lg overflow-hidden border-2 transition-all',
                        isSelected
                          ? 'border-amber-500 shadow-md shadow-amber-200/50'
                          : isDark ? 'border-gray-700 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300'
                      )}>
                      <div className="h-14 relative">
                        {h.photo
                          ? <img src={h.photo} alt={h.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full" style={{ background: HOTEL_GRADIENTS[idx % 6] }} />
                        }
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold" style={{fontSize:'7px'}}>
                            {selIdx + 1}
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1.5 right-1">
                          <div className="text-white font-bold leading-tight" style={{fontSize:'7px',lineHeight:'1.2'}}>{h.name}</div>
                        </div>
                      </div>
                      <div className={cn('px-1.5 py-1 flex items-center justify-between', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                        <div>
                          <span className={cn('inline-block px-1 py-0.5 rounded text-white font-bold leading-none', isSelected ? 'bg-amber-500' : 'bg-gray-400')} style={{fontSize:'6px'}}>{h.tier}</span>
                          <span className={cn('ml-1 font-medium', isDark ? 'text-gray-400' : 'text-gray-500')} style={{fontSize:'7px'}}>{h.rates[0]?.wd1n2d || '—'}</span>
                        </div>
                        <button type="button"
                          onClick={e => { e.stopPropagation(); setHotels(prev => { const next = prev.filter(x => x.id !== h.id); saveGlobalSettings(next, defaultCoverUrl).catch(()=>{}); return next; }); setSelectedHotelIds(prev => prev.filter(id => id !== h.id)); }}
                          className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0"
                          title="Remove hotel">
                          <svg width="8" height="8" viewBox="0 0 8 8"><line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                    </button>
                  );
                })}
                {/* Add Hotel button */}
                <button type="button" onClick={() => setShowAddHotel(p => !p)}
                  className={cn('relative text-left rounded-lg border-2 border-dashed transition-all h-auto min-h-[90px] flex flex-col items-center justify-center gap-1',
                    isDark ? 'border-gray-700 hover:border-amber-600 text-gray-500 hover:text-amber-500' : 'border-gray-300 hover:border-amber-500 text-gray-400 hover:text-amber-600'
                  )}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="7" y="2" width="2" height="12" rx="1"/><rect x="2" y="7" width="12" height="2" rx="1"/></svg>
                  <span style={{fontSize:'8px'}} className="font-bold text-center">Add Hotel</span>
                </button>
              </div>
              {/* Inline add hotel form */}
              {showAddHotel && (
                <div className={cn('mt-2 p-3 rounded-lg border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                  <div className={cn('text-xs font-bold mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>New Hotel</div>
                  <div className="space-y-1.5">
                    <input value={newHotelName} onChange={e => setNewHotelName(e.target.value)} placeholder="Hotel name" className={cn(inputCls(isDark), 'text-xs py-1')} />
                    <input value={newHotelLocation} onChange={e => setNewHotelLocation(e.target.value)} placeholder="Location (e.g. Ekta Nagar)" className={cn(inputCls(isDark), 'text-xs py-1')} />
                    <select value={newHotelTier} onChange={e => setNewHotelTier(e.target.value)}
                      className={cn(inputCls(isDark), 'text-xs py-1')}>
                      {['Glamping','Budget','3-Star Hotel','4-Star Hotel','4-Star Resort','Luxury'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => {
                      if (!newHotelName.trim()) return;
                      const newH: HotelData = {
                        id: 'custom-' + Date.now(),
                        name: newHotelName.trim(),
                        location: newHotelLocation.trim() || 'Ekta Nagar',
                        tier: newHotelTier,
                        popular: false,
                        tags: 'Hotel',
                        defaultImgPath: '',
                        photo: '',
                        rates: [
                          { type: 'Double / Twin', wd1n2d: '—', we1n2d: '—', wd2n3d: '—', we2n3d: '—' },
                          { type: 'Single', wd1n2d: '—', we1n2d: '—', wd2n3d: '—', we2n3d: '—' },
                        ],
                      };
                      setHotels(prev => { const next = [...prev, newH]; saveGlobalSettings(next, defaultCoverUrl).catch(()=>{}); return next; });
                      setNewHotelName(''); setNewHotelLocation(''); setNewHotelTier('3-Star Hotel'); setShowAddHotel(false);
                    }} className="flex-1 py-1 text-xs font-bold text-white rounded-lg bg-amber-500 hover:bg-amber-600">Add</button>
                    <button type="button" onClick={() => setShowAddHotel(false)} className={cn('py-1 px-3 text-xs rounded-lg', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600')}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Section: Quote Rates — only show when hotel(s) selected */}
            {selectedHotelIds.length > 0 && (
              <div className={cn('px-4 pt-3 pb-3 border-b', isDark ? 'border-gray-800 bg-amber-900/10' : 'border-gray-100 bg-amber-50/50')}>
                <div className={cn('text-xs font-bold tracking-widest uppercase mb-1', isDark ? 'text-amber-400' : 'text-amber-700')}>3 — Quote Rates</div>
                <p className={cn('text-xs mb-2.5', isDark ? 'text-gray-500' : 'text-gray-500')}>Enter the total rate per person for this client quote. Leave blank to use global rates.</p>
                <div className="space-y-2">
                  {show1N2D && (
                    <div>
                      <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>1 Night · 2 Days — Rate per person</label>
                      <div className={cn('flex items-center rounded-lg border overflow-hidden', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                        <span className={cn('px-2.5 text-xs font-bold border-r', isDark ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-200')}>₹</span>
                        <input value={quoteRates.rate1n2d} onChange={e => setQuoteRates(r => ({...r, rate1n2d: e.target.value}))}
                          placeholder="e.g. 8,499" className={cn('flex-1 py-2 px-2 text-sm bg-transparent outline-none', isDark ? 'text-gray-200' : 'text-gray-800')} />
                      </div>
                    </div>
                  )}
                  {show2N3D && (
                    <div>
                      <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>2 Nights · 3 Days — Rate per person</label>
                      <div className={cn('flex items-center rounded-lg border overflow-hidden', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                        <span className={cn('px-2.5 text-xs font-bold border-r', isDark ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-200')}>₹</span>
                        <input value={quoteRates.rate2n3d} onChange={e => setQuoteRates(r => ({...r, rate2n3d: e.target.value}))}
                          placeholder="e.g. 10,499" className={cn('flex-1 py-2 px-2 text-sm bg-transparent outline-none', isDark ? 'text-gray-200' : 'text-gray-800')} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section: Packages */}
            <div className={cn('px-4 pt-3 pb-3 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <div className={cn('text-xs font-bold tracking-widest uppercase mb-2', isDark ? 'text-gray-500' : 'text-gray-400')}>{selectedHotelIds.length > 0 ? '4' : '3'} — Packages</div>
              <div className="space-y-2">
                {[
                  { label: '1 Night · 2 Days', val: show1N2D, set: setShow1N2D },
                  { label: '2 Nights · 3 Days', val: show2N3D, set: setShow2N3D },
                  { label: 'Show Pricing Page', val: showPricing, set: setShowPricing },
                ].map(({ label, val, set }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>{label}</span>
                    {toggleSwitch(val, set)}
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Brochure Text */}
            <div className={cn('px-4 pt-3 pb-3 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <div className={cn('text-xs font-bold tracking-widest uppercase mb-2', isDark ? 'text-gray-500' : 'text-gray-400')}>{selectedHotelIds.length > 0 ? '5' : '4'} — Brochure Text</div>
              <div className="space-y-2.5">
                <div>
                  <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>Cover Subtitle</label>
                  <input value={coverSubtitle} onChange={e => setCoverSubtitle(e.target.value)} placeholder="Experience Packages" className={inputCls(isDark)} />
                </div>
                <div>
                  <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>Cover Tagline</label>
                  <textarea value={tagline} onChange={e => setTagline(e.target.value)} rows={2} className={cn(inputCls(isDark), 'resize-none text-xs')} />
                </div>
                <div>
                  <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>Personal Note to Client</label>
                  <textarea value={customNote} onChange={e => setCustomNote(e.target.value)} rows={2}
                    placeholder="A warm note that appears on the cover…" className={cn(inputCls(isDark), 'resize-none')} />
                </div>
              </div>
            </div>

            {/* Section: Cover Image */}
            <div className={cn('px-4 pt-3 pb-3 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <div className={cn('text-xs font-bold tracking-widest uppercase mb-2', isDark ? 'text-gray-500' : 'text-gray-400')}>{selectedHotelIds.length > 0 ? '6' : '5'} — Cover Image</div>
              {defaultCoverUrl && !coverImgB64 && (
                <div className={cn('flex items-center gap-2 p-2 rounded-lg mb-2 text-xs', isDark ? 'bg-green-900/20 text-green-400 border border-green-800/30' : 'bg-green-50 text-green-700 border border-green-100')}>
                  <div className="w-10 h-7 rounded overflow-hidden flex-shrink-0">
                    <img src={defaultCoverUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span>Using default cover from Manage tab</span>
                </div>
              )}
              <ImageUpload label="Per-Quote Override (optional)" value={coverImgB64} onChange={setCoverImgB64} />
              {coverImgB64 && (
                <button type="button" onClick={() => setCoverImgB64('')} className="text-xs text-red-500 mt-1 hover:underline">Remove override</button>
              )}
            </div>

            {/* Download tip */}
            <div className={cn('m-4 rounded-xl p-3 text-xs leading-relaxed border', isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500')}>
              <div className="font-bold mb-1 text-amber-600">↓ Download PDF</div>
              <p>Click the orange button above. The PDF downloads directly — no print dialog or pop-ups needed.</p>
            </div>

          </div>

          {/* Right: Preview */}
          <div className={cn('flex-1 overflow-auto p-6', isDark ? 'bg-gray-800' : 'bg-gray-300')}>
            <div className={cn('text-center mb-4 text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
              <FileText size={12} className="inline mr-1.5" />
              Live Preview — gradient placeholders for images; real photos appear in the downloaded PDF
            </div>
            <iframe srcDoc={previewHtml} title="Brochure Preview" className="w-full rounded-lg shadow-2xl"
              style={{ minHeight: '2100px', border: 'none', background: '#1e1e1e' }}
              sandbox="allow-same-origin" />
          </div>
        </div>
      )}

      {/* ── Manage Tab ── */}
      {activeTab === 'manage' && (
        <div className={cn('flex-1 overflow-y-auto', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
          <div className="max-w-4xl mx-auto px-6 py-6">
            {settingsLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <RefreshCw size={22} className="animate-spin text-amber-500" />
                <p className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>Loading shared settings…</p>
              </div>
            ) : (<>
            <div className={cn('rounded-xl p-4 mb-6 text-sm border', isDark ? 'bg-blue-900/20 border-blue-800/30 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-700')}>
              <strong>Admin Panel</strong> — All data (photos + rates + cover) is stored in <strong>Supabase</strong> and shared across all devices. Click <strong>Save Changes</strong> to push rate changes to everyone.
            </div>

            {/* Default Cover Image */}
            <div className={cn('rounded-xl border p-4 mb-6', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
              <div className="flex items-start gap-3">
                {defaultCoverUrl && (
                  <div className="w-20 h-14 rounded-lg overflow-hidden border border-amber-400 flex-shrink-0">
                    <img src={defaultCoverUrl} alt="Cover" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className={cn('text-sm font-bold mb-0.5', isDark ? 'text-gray-100' : 'text-gray-800')}>Default Cover Image</h3>
                  <p className={cn('text-xs mb-3 opacity-60', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    Used on the brochure cover for all quotes. Upload once — stored in Supabase, works on every device.
                  </p>
                  <ImageUpload
                    label=""
                    value={defaultCoverUrl}
                    onChange={handleDefaultCoverChange}
                    uploadPath="cover/default"
                  />
                </div>
              </div>
            </div>

            <h3 className={cn('text-sm font-bold mb-1', isDark ? 'text-gray-200' : 'text-gray-700')}>Hotel Photos &amp; Rates</h3>
            <p className={cn('text-xs mb-4 opacity-50', isDark ? 'text-gray-400' : 'text-gray-500')}>
              WD = Weekday (Mon–Thu) · WE = Weekend (Fri–Sun, Public Holidays) · All prices per person
            </p>

            {hotels.map(h => (
              <HotelEditor key={h.id} hotel={h} onChange={updated => setHotels(prev => {
                const next = prev.map(x => x.id === updated.id ? updated : x);
                if (updated.photo && updated.photo !== h.photo) {
                  // Auto-save to Supabase when a photo is uploaded
                  saveGlobalSettings(next, defaultCoverUrl).catch(() => {});
                }
                return next;
              })} />
            ))}

            <div className={cn('mt-6 pt-6 border-t', isDark ? 'border-gray-700' : 'border-gray-200')}>
              <button type="button" onClick={handleSave} disabled={saving}
                className={cn('w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60', saved ? 'bg-green-500 text-white' : 'text-white hover:opacity-90')}
                style={saved ? {} : { background: 'linear-gradient(135deg,#E8841A,#C96A10)' }}>
                <Save size={15} /> {saving ? 'Saving to Cloud…' : saved ? '✓ Saved — Visible on All Devices' : 'Save Changes'}
              </button>
              <p className={cn('text-xs text-center mt-2 opacity-50', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Saved rates and photos are used automatically in the Builder tab
              </p>
            </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
};

export default SouBuilder;
