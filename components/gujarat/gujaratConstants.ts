
import { Hotel, Sightseeing, Vehicle, ItineraryPackage, PolicyData } from '../../types';

// --- GUJARAT HOTEL DATA ---
export const GUJARAT_HOTELS: Record<string, Hotel[]> = {
  'Ahmedabad': [
    { name: 'Lemon Tree Premier', rate: 0, type: 'CPAI', tier: 'Budget', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Deluxe Double', capacity: 2, rate: 3200 }, { name: 'Deluxe Triple', capacity: 3, rate: 4000 }] },
    { name: 'Novotel Ahmedabad', rate: 0, type: 'CPAI', tier: 'Premium', img: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Superior Double', capacity: 2, rate: 5500 }, { name: 'Superior Triple', capacity: 3, rate: 6800 }] },
  ],
  'Dwarka': [
    { name: 'Hotel Dwarka Residency', rate: 0, type: 'MAPAI', tier: 'Budget', img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Standard Double', capacity: 2, rate: 2200 }, { name: 'Standard Triple', capacity: 3, rate: 2800 }] },
    { name: 'The Dwarkadhish Lords Eco Inn', rate: 0, type: 'MAPAI', tier: 'Premium', img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Premium Double', capacity: 2, rate: 3800 }, { name: 'Premium Triple', capacity: 3, rate: 4800 }] },
  ],
  'Somnath': [
    { name: 'Hotel Somnath Sagar', rate: 0, type: 'MAPAI', tier: 'Budget', img: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Deluxe Double', capacity: 2, rate: 2400 }, { name: 'Deluxe Triple', capacity: 3, rate: 3000 }] },
    { name: 'Lords Inn Somnath', rate: 0, type: 'MAPAI', tier: 'Premium', img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Premium Double', capacity: 2, rate: 4200 }, { name: 'Premium Triple', capacity: 3, rate: 5200 }] },
  ],
  'Gir': [
    { name: 'Gir Birding Lodge', rate: 0, type: 'MAPAI', tier: 'Budget', img: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Cottage Double', capacity: 2, rate: 2800 }, { name: 'Cottage Triple', capacity: 3, rate: 3600 }] },
    { name: 'Taj Gateway Gir', rate: 0, type: 'MAPAI', tier: 'Premium', img: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Superior Room', capacity: 2, rate: 6500 }, { name: 'Superior Triple', capacity: 3, rate: 8000 }] },
  ],
  'Statue of Unity': [
    { name: 'Tent City Narmada', rate: 0, type: 'MAPAI', tier: 'Budget', img: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'AC Tent Double', capacity: 2, rate: 3500 }, { name: 'AC Tent Triple', capacity: 3, rate: 4200 }] },
    { name: 'Hyatt Place Kevadia', rate: 0, type: 'CPAI', tier: 'Premium', img: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'King Room', capacity: 2, rate: 5800 }, { name: 'Twin Room', capacity: 3, rate: 7000 }] },
  ],
  'Vadodara': [
    { name: 'Express Inn Vadodara', rate: 0, type: 'CPAI', tier: 'Budget', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Standard Double', capacity: 2, rate: 2600 }, { name: 'Standard Triple', capacity: 3, rate: 3200 }] },
    { name: 'Grand Mercure Vadodara', rate: 0, type: 'CPAI', tier: 'Premium', img: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Superior Double', capacity: 2, rate: 4800 }, { name: 'Superior Triple', capacity: 3, rate: 5800 }] },
  ],
  'Saputara': [
    { name: 'Patang Residency', rate: 0, type: 'MAPAI', tier: 'Budget', img: 'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Deluxe Double', capacity: 2, rate: 2200 }, { name: 'Deluxe Triple', capacity: 3, rate: 2800 }] },
    { name: 'Hill Resort Saputara', rate: 0, type: 'MAPAI', tier: 'Premium', img: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Premium Suite', capacity: 2, rate: 3800 }, { name: 'Family Suite', capacity: 4, rate: 5200 }] },
  ],
  'Rajkot': [
    { name: 'Hotel Marasa Sarovar', rate: 0, type: 'CPAI', tier: 'Budget', img: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Standard Double', capacity: 2, rate: 2400 }, { name: 'Standard Triple', capacity: 3, rate: 3000 }] },
    { name: 'Fern Residency Rajkot', rate: 0, type: 'CPAI', tier: 'Premium', img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Deluxe Double', capacity: 2, rate: 4000 }, { name: 'Deluxe Triple', capacity: 3, rate: 5000 }] },
  ],
  'Junagadh': [
    { name: 'Hotel Sapphire', rate: 0, type: 'CPAI', tier: 'Budget', img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Deluxe Double', capacity: 2, rate: 1800 }, { name: 'Deluxe Triple', capacity: 3, rate: 2400 }] },
    { name: 'Lords Eco Inn Junagadh', rate: 0, type: 'CPAI', tier: 'Premium', img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=400&q=80', roomTypes: [{ name: 'Premium Double', capacity: 2, rate: 3200 }, { name: 'Premium Triple', capacity: 3, rate: 4000 }] },
  ],
};

// --- GUJARAT SIGHTSEEING DATA ---
export const GUJARAT_SIGHTSEEING: Record<string, Sightseeing[]> = {
  'Ahmedabad': [
    { name: 'Sabarmati Ashram', desc: 'Mahatma Gandhi\'s historic ashram on the riverbank', img: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80' },
    { name: 'Adalaj Stepwell', desc: 'Intricately carved five-story stepwell from the 15th century', img: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=400&q=80' },
    { name: 'Sidi Saiyyed Mosque', desc: 'Famous for its exquisite stone latticework jali windows', img: 'https://images.unsplash.com/photo-1585128792020-803d29415281?auto=format&fit=crop&w=400&q=80' },
    { name: 'Kankaria Lake', desc: 'Historic lakefront with zoo, toy train, and gardens', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=80' },
  ],
  'Dwarka': [
    { name: 'Dwarkadhish Temple', desc: 'Ancient Krishna temple, one of Char Dham pilgrimage sites', img: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=400&q=80' },
    { name: 'Nageshwar Jyotirlinga', desc: 'One of the 12 sacred Jyotirlinga shrines of Lord Shiva', img: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=400&q=80' },
    { name: 'Bet Dwarka', desc: 'Island shrine reached by boat, believed to be Krishna\'s residence', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80' },
  ],
  'Somnath': [
    { name: 'Somnath Temple', desc: 'First among the 12 Jyotirlingas, rebuilt multiple times', img: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=400&q=80' },
    { name: 'Somnath Beach', desc: 'Scenic Arabian Sea beach near the temple', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80' },
    { name: 'Triveni Sangam', desc: 'Confluence of three rivers - Hiran, Kapila & Saraswati', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=80' },
  ],
  'Gir': [
    { name: 'Gir Safari', desc: 'Home to the last wild Asiatic Lions', img: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?auto=format&fit=crop&w=400&q=80' },
    { name: 'Devaliya Safari Park', desc: 'Interpretation zone for guaranteed lion sighting', img: 'https://images.unsplash.com/photo-1551969014-7d2c4cddf0b6?auto=format&fit=crop&w=400&q=80' },
    { name: 'Kankai Mata Temple', desc: 'Hilltop temple inside the Gir forest', img: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=400&q=80' },
  ],
  'Statue of Unity': [
    { name: 'Statue of Unity', desc: 'World\'s tallest statue at 182m, dedicated to Sardar Patel', img: 'https://images.unsplash.com/photo-1609948543911-7280795f813d?auto=format&fit=crop&w=400&q=80' },
    { name: 'Valley of Flowers', desc: 'Beautifully landscaped garden near the statue', img: 'https://images.unsplash.com/photo-1490750967868-88aa4f44baee?auto=format&fit=crop&w=400&q=80' },
    { name: 'Sardar Sarovar Dam', desc: 'One of India\'s largest dams on the Narmada river', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=80' },
  ],
  'Vadodara': [
    { name: 'Laxmi Vilas Palace', desc: 'Grand palace of the Gaekwad dynasty, larger than Buckingham', img: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=400&q=80' },
    { name: 'Champaner-Pavagadh', desc: 'UNESCO World Heritage archaeological park', img: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=400&q=80' },
    { name: 'Sayaji Garden', desc: 'Sprawling public garden with zoo and planetarium', img: 'https://images.unsplash.com/photo-1490750967868-88aa4f44baee?auto=format&fit=crop&w=400&q=80' },
  ],
  'Saputara': [
    { name: 'Saputara Lake', desc: 'Scenic hill station lake with boating', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=80' },
    { name: 'Gira Waterfalls', desc: 'Beautiful waterfall near Saputara, best during monsoon', img: 'https://images.unsplash.com/photo-1432405972618-c6b0cfba8b68?auto=format&fit=crop&w=400&q=80' },
    { name: 'Sunset Point', desc: 'Panoramic viewpoint for stunning sunsets over the valley', img: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=400&q=80' },
  ],
  'Rajkot': [
    { name: 'Watson Museum', desc: 'Colonial-era museum with artifacts and royal memorabilia', img: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=400&q=80' },
    { name: 'Kaba Gandhi No Delo', desc: 'Childhood home of Mahatma Gandhi in Rajkot', img: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80' },
    { name: 'Rotary Dolls Museum', desc: 'Unique museum showcasing international dolls collection', img: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=400&q=80' },
  ],
  'Junagadh': [
    { name: 'Girnar Hill', desc: 'Sacred hill with 10,000 steps and ancient temples', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=80' },
    { name: 'Uparkot Fort', desc: '2300-year-old fort with Buddhist caves and stepwells', img: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=400&q=80' },
    { name: 'Mahabat Maqbara', desc: 'Stunning Indo-Islamic mausoleum with Gothic and European architecture', img: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=400&q=80' },
  ],
};

// --- GUJARAT VEHICLE DATA (shared with Kutch) ---
export const GUJARAT_VEHICLES: Vehicle[] = [
  { name: 'Sedan (Dzire)', rate: 3600, capacity: 4, img: 'https://stimg.cardekho.com/images/carexteriorimages/630x420/Maruti/Dzire-Tour-S/12461/1762857975456/front-left-side-47.jpg' },
  { name: 'Ertiga', rate: 4500, capacity: 6, img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlig-LMR58hNvPs_XtO5rbsP81uiR9d-TvpQ&s' },
  { name: 'Innova', rate: 5100, capacity: 7, img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTRj1HM8r-23OjwLoiga8ZWDxIasAfKxk8o4Q&s' },
  { name: 'Innova Crysta', rate: 5700, capacity: 7, img: 'https://cdni.autocarindia.com/ExtraImages/20220105033033_innova_crysta.jpg' },
  { name: 'Tempo Traveller', rate: 8700, capacity: 12, img: 'https://cdn.bluebirdtravels.in/wp-content/uploads/2017/01/Tempo_Traveller_PI.png' }
];

// --- GUJARAT PACKAGES ---
export const GUJARAT_PACKAGES: ItineraryPackage[] = [
  { id: 'gj-3n-saurashtra', name: '3N Saurashtra Express', img: 'https://images.unsplash.com/photo-1609948543911-7280795f813d?auto=format&fit=crop&w=400&q=80', days: 4, route: ['Ahmedabad', 'Somnath', 'Dwarka', 'Rajkot'] },
  { id: 'gj-4n-divine', name: '4N Divine Gujarat', img: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=400&q=80', days: 5, route: ['Ahmedabad', 'Vadodara', 'Statue of Unity', 'Somnath', 'Dwarka'] },
  { id: 'gj-5n-wildlife', name: '5N Wildlife & Heritage', img: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?auto=format&fit=crop&w=400&q=80', days: 6, route: ['Ahmedabad', 'Junagadh', 'Gir', 'Somnath', 'Dwarka', 'Rajkot'] },
  { id: 'gj-6n-grand', name: '6N Grand Gujarat', img: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=400&q=80', days: 7, route: ['Ahmedabad', 'Vadodara', 'Statue of Unity', 'Gir', 'Somnath', 'Dwarka', 'Rajkot'] },
  { id: 'gj-3n-saputara', name: '3N Saputara Retreat', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=80', days: 4, route: ['Ahmedabad', 'Saputara', 'Saputara', 'Vadodara'] },
];

// --- GUJARAT POLICY DATA ---
export const GUJARAT_POLICY_DATA: PolicyData = {
  inclusions: [
    'Pickup & Drop from Ahmedabad Airport/Railway Station',
    'Accommodation on Double Sharing Basis',
    'Meals as per Hotel Plan selected',
    'AC Vehicles as per selection (300km/day/vehicle)',
    'Driver Allowance, Toll, Parking',
    'Gir Safari Permit Assistance (if applicable)',
  ],
  exclusions: [
    'Lunch',
    'Monument/Temple Entry Tickets',
    'Guide Charges',
    'Personal Expenses',
    'Train/Flight Tickets',
    'Camera Charges at Gir/Monuments',
  ]
};

// --- CITY LIST ---
export const GUJARAT_CITIES = [
  'Ahmedabad', 'Dwarka', 'Somnath', 'Gir', 'Statue of Unity', 'Vadodara', 'Saputara', 'Rajkot', 'Junagadh'
];

export const GUJARAT_FALLBACK_IMG = "https://images.unsplash.com/photo-1609948543911-7280795f813d?auto=format&fit=crop&w=800&q=80";
