
import { 
  Lead, 
  Interaction, 
  Reminder, 
  Supplier, 
  ActivityLog, 
  Hotel, 
  Sightseeing, 
  Vehicle, 
  ItineraryPackage, 
  PolicyData 
} from './types';

export const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    contact: { phone: '+1 (555) 0123', email: 'sarah.j@example.com' },
    tripDetails: { 
      destination: 'Bali', 
      paxConfig: { adults: 2, children: 0, childAges: [] },
      budget: 5000, 
      startDate: '2025-10-01' 
    },
    preferences: {
      hotel: '5 Star',
      mealPlan: 'CP (Bfast)'
    },
    status: 'New',
    temperature: 'Hot',
    source: 'Instagram',
    interestedServices: ['Holiday Package', 'Flight Booking'],
    tags: ['Honeymoon', 'Luxury'],
    assignedTo: 'Sonali',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    lastStatusUpdate: new Date(Date.now() - 1000 * 60 * 30).toISOString(), 
    vendors: []
  },
  {
    id: '2',
    name: 'Michael Chen',
    contact: { phone: '+1 (555) 0456', email: 'm.chen@example.com' },
    tripDetails: { 
      destination: 'Kyoto', 
      paxConfig: { adults: 2, children: 2, childAges: [8, 12] }, 
      budget: 12000, 
      startDate: '2025-04-15' 
    },
    preferences: {
      hotel: '4 Star',
      mealPlan: 'MAP (Bfast+Din)'
    },
    status: 'Contacted',
    temperature: 'Warm',
    source: 'Referral',
    referenceName: 'Mr. Tanaka',
    interestedServices: ['Flight Booking', 'Hotel Booking', 'Visa Service'],
    tags: ['Family', 'Cultural'],
    assignedTo: 'Vraj',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    lastStatusUpdate: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), 
    vendors: []
  },
  {
    id: '3',
    name: 'Emma Watson',
    contact: { phone: '+1 (555) 0789', email: 'emma.w@example.com' },
    tripDetails: { 
      destination: 'Maldives', 
      paxConfig: { adults: 2, children: 0, childAges: [] }, 
      budget: 8000, 
      startDate: '2025-12-20' 
    },
    preferences: {
      hotel: 'Luxury',
      mealPlan: 'AP (All Meals)'
    },
    status: 'Proposal Sent',
    temperature: 'Hot',
    source: 'Walk-in',
    interestedServices: ['Holiday Package', 'Travel Insurance'],
    tags: ['Anniversary'],
    assignedTo: 'Sonali',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    lastStatusUpdate: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), 
    vendors: [{ id: 'v1', name: 'Maldives Direct', cost: 6500, price: 8000 }] // Example data
  },
  {
    id: '4',
    name: 'David Miller',
    contact: { phone: '+1 (555) 1111', email: 'david.m@example.com' },
    tripDetails: { 
      destination: 'Swiss Alps', 
      paxConfig: { adults: 1, children: 0, childAges: [] }, 
      budget: 3500, 
      startDate: '2026-01-10' 
    },
    preferences: {
      hotel: '3 Star'
    },
    status: 'Discussion',
    temperature: 'Cold',
    source: 'Website',
    interestedServices: ['Flight Booking', 'Cab/Transfer'],
    tags: ['Adventure', 'Solo'],
    assignedTo: 'Vraj',
    createdAt: new Date().toISOString(),
    lastStatusUpdate: new Date().toISOString(), 
    vendors: []
  }
];

export const MOCK_INTERACTIONS: Interaction[] = [
  {
    id: '101',
    leadId: '1',
    type: 'Note',
    content: 'Client loves the private pool villa idea. Sent initial options.',
    sentiment: 'Positive',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '102',
    leadId: '2',
    type: 'Call',
    content: 'Discussed flight options. Prefers direct flights only.',
    sentiment: 'Neutral',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
  }
];

export const MOCK_REMINDERS: Reminder[] = [
  {
    id: '201',
    leadId: '1',
    task: 'Follow up on villa selection',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    isCompleted: false,
  },
  {
    id: '202',
    leadId: '3',
    task: 'Send final invoice',
    dueDate: new Date().toISOString(), // Today
    isCompleted: false,
  },
  {
    id: '203',
    leadId: '2',
    task: 'Check visa requirements',
    dueDate: new Date(Date.now() - 86400000).toISOString(), // Overdue
    isCompleted: false,
  }
];

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 's1',
    name: 'Falcon DMC',
    contactPerson: 'Ahmed Hassan',
    phone: '+971 50 123 4567',
    email: 'ahmed@falcondmc.ae',
    destinations: ['Dubai', 'Abu Dhabi', 'Oman'],
    category: 'DMC',
    rating: 5
  },
  {
    id: 's2',
    name: 'Siam Voyages',
    contactPerson: 'Ploy Thong',
    phone: '+66 81 987 6543',
    email: 'sales@siamvoyages.th',
    destinations: ['Thailand', 'Phuket', 'Bangkok'],
    category: 'DMC',
    rating: 4
  },
  {
    id: 's3',
    name: 'Swiss Transfer Co.',
    contactPerson: 'Hans Muller',
    phone: '+41 79 111 2233',
    email: 'bookings@swisstransfer.ch',
    destinations: ['Switzerland', 'Zurich', 'Geneva'],
    category: 'Transport',
    rating: 5
  },
  {
    id: 's4',
    name: 'Global Visa Experts',
    contactPerson: 'Sarah Jones',
    phone: '+1 212 555 9999',
    email: 'support@globalvisa.com',
    destinations: ['Europe', 'USA', 'UK'],
    category: 'Visa',
    rating: 3
  },
  {
    id: 's5',
    name: 'Bali Retreats',
    contactPerson: 'Wayan Sudra',
    phone: '+62 812 3456 7890',
    email: 'wayan@baliretreats.com',
    destinations: ['Bali', 'Ubud'],
    category: 'Hotelier',
    rating: 4
  }
];

export const MOCK_ACTIVITY_LOGS: ActivityLog[] = [
  {
    id: 'log1',
    agentName: 'Sonali',
    actionType: 'NEW_LEAD',
    details: 'Created new lead: Sarah Jenkins',
    timestamp: new Date().toISOString(), // Today
    leadId: '1',
    metadata: { leadName: 'Sarah Jenkins' }
  },
  {
    id: 'log2',
    agentName: 'Sonali',
    actionType: 'STATUS_CHANGE',
    details: 'Moved Sarah Jenkins from Contacted -> Proposal Sent',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    leadId: '1',
    metadata: { leadName: 'Sarah Jenkins', oldStatus: 'Contacted', newStatus: 'Proposal Sent' }
  },
  {
    id: 'log3',
    agentName: 'Vraj',
    actionType: 'STATUS_CHANGE',
    details: 'Moved Michael Chen to Won',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
    leadId: '2',
    metadata: { leadName: 'Michael Chen', oldStatus: 'Discussion', newStatus: 'Won' }
  },
  {
    id: 'log4',
    agentName: 'Sonali',
    actionType: 'STATUS_CHANGE',
    details: 'Moved Emma Watson to Won',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // Yesterday
    leadId: '3',
    metadata: { leadName: 'Emma Watson', oldStatus: 'Discussion', newStatus: 'Won' }
  },
  {
    id: 'log5',
    agentName: 'Vraj',
    actionType: 'NEW_LEAD',
    details: 'Created new lead: David Miller',
    timestamp: new Date().toISOString(),
    leadId: '4',
    metadata: { leadName: 'David Miller' }
  }
];

export const STATUS_COLUMNS = ['New', 'Contacted', 'Proposal Sent', 'Discussion', 'Won', 'Lost'];

// --- ITINERARY BUILDER DATA ---

export const HOTEL_DATA: Record<string, Hotel[]> = { 
  Bhuj: [ 
    { 
      name: 'Canyon Inn', 
      rate: 2800, 
      type: 'CPAI', 
      tier: 'Budget', 
      img: 'https://r2imghtlak.mmtcdn.com/r2-mmt-htl-image/htl-imgs/202408051554299523-ff55c592-4431-46f9-b238-45f37edfd52c.jpg',
      roomTypes: [
        { name: 'Standard Room', capacity: 2, rate: 2800 },
        { name: 'Family Room', capacity: 4, rate: 4500 }
      ]
    }, 
    { 
      name: 'Kutch Elegance', 
      rate: 2450, 
      type: 'CPAI', 
      tier: 'Budget', 
      img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSswwJgLyDQKyWxDaptiV4q-V2FCrbKhhKXIQ&s',
      roomTypes: [
        { name: 'Deluxe', capacity: 2, rate: 2450 },
        { name: 'Super Deluxe', capacity: 2, rate: 2800 }
      ]
    }, 
    { 
      name: 'Dream Resort', 
      rate: 3500, 
      type: 'CPAI', 
      tier: 'Budget', 
      img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSPITT_cvmmTWfZfvSGpkmQLC9qpjSPMuXrcg&s',
      roomTypes: [
        { name: 'Cottage', capacity: 2, rate: 3500 },
        { name: 'Family Cottage', capacity: 4, rate: 5500 }
      ]
    }, 
    { 
      name: 'Seven Sky Clarks', 
      rate: 5500, 
      type: 'MAPAI', 
      tier: 'Premium', 
      img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6CM6PMcwuSzQPkiR4raVHtKTJySnkKg_UZA&s',
      roomTypes: [
        { name: 'Executive', capacity: 2, rate: 5500 },
        { name: 'Suite', capacity: 2, rate: 8500 }
      ]
    }, 
    { 
      name: 'Times Square', 
      rate: 7000, 
      type: 'CPAI', 
      tier: 'Premium', 
      img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQv7XPKS5IT3MJBt9hY8dBZZsgg-iFPcjGRg&s',
      roomTypes: [
        { name: 'Club Room', capacity: 2, rate: 7000 },
        { name: 'Royal Suite', capacity: 2, rate: 12000 }
      ]
    }, 
    { 
      name: 'Ramee The Srinivas', 
      rate: 5500, 
      type: 'MAPAI', 
      tier: 'Premium', 
      img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSF50jsas5lHpEw-wP-6tPWGqDLz_G5PW7lg&s',
      roomTypes: [
        { name: 'Superior', capacity: 2, rate: 5500 },
        { name: 'Family Suite', capacity: 4, rate: 9500 }
      ]
    } 
  ], 
  Mandvi: [ 
    { 
      name: 'Vijay Vilas Heritage', 
      rate: 6950, 
      type: 'MAPAI', 
      tier: 'Budget', 
      img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTTl1ekiTQ8z-NhBTQyQirJV4EpLckm6_hN5A&s',
      roomTypes: [
        { name: 'Heritage Room', capacity: 2, rate: 6950 },
        { name: 'Royal Tent', capacity: 2, rate: 8500 }
      ]
    }, 
    { 
      name: 'Serena Beach Resort', 
      rate: 8800, 
      type: 'CPAI', 
      tier: 'Premium', 
      img: 'https://r1imghtlak.mmtcdn.com/efacd50272cb11e7b2390a4cef95d023.jpg',
      roomTypes: [
        { name: 'Garden Villa', capacity: 2, rate: 8800 },
        { name: 'Pool Villa', capacity: 2, rate: 15000 }
      ]
    } 
  ], 
  Dhordo: [ 
    { 
      name: 'Mahefeel-E-Rann', 
      rate: 3400, 
      type: 'MAPAI', 
      tier: 'Budget', 
      img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpnVGL19xSnKBEVyAETT0-iCK6GYrj17FOOg&s',
      roomTypes: [
        { name: 'Non-AC Bhunga', capacity: 2, rate: 3400 },
        { name: 'AC Bhunga', capacity: 2, rate: 4500 }
      ]
    }, 
    { 
      name: 'Rann Visamo', 
      rate: 3400, 
      type: 'MAPAI', 
      tier: 'Budget', 
      img: 'https://www.abtours.co.in/thumb/media/0/0/LriJPpDIMrFkwRpxDgiYaGwX16fPo72W.jpg',
      roomTypes: [
        { name: 'Standard Hut', capacity: 2, rate: 3400 },
        { name: 'Family Hut', capacity: 4, rate: 6000 }
      ]
    }, 
    { 
      name: 'Rann Heritage', 
      rate: 5500, 
      type: 'MAPAI', 
      tier: 'Premium', 
      img: 'https://media-cdn.tripadvisor.com/media/photo-s/2b/31/e1/5c/caption.jpg',
      roomTypes: [
        { name: 'Premium Bhunga', capacity: 2, rate: 5500 },
        { name: 'Royal Bhunga', capacity: 2, rate: 7500 }
      ]
    }, 
    { 
      name: 'Shaam-E-Sarhad', 
      rate: 4350, 
      type: 'MAPAI', 
      tier: 'Premium', 
      img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ2t_URd8b0G459lj0G5zt-uxEi_aRcoJE2ow&s',
      roomTypes: [
        { name: 'Mud Cottage', capacity: 2, rate: 4350 },
        { name: 'Eco Tent', capacity: 2, rate: 5000 }
      ]
    } 
  ], 
  Dholavira: [ 
    { 
      name: 'Rann Resort', 
      rate: 5400, 
      type: 'MAPAI', 
      tier: 'Budget', 
      img: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/16/ef/53/af/rann-resort-dholavira.jpg?w=900&h=500&s=1',
      roomTypes: [
        { name: 'Standard AC', capacity: 2, rate: 5400 },
        { name: 'Dormitory (6 Bed)', capacity: 6, rate: 9000 }
      ]
    }, 
    { 
      name: 'Road To Heaven', 
      rate: 6700, 
      type: 'MAPAI', 
      tier: 'Premium', 
      img: 'https://r2imghtlak.mmtcdn.com/r2-mmt-htl-image/htl-imgs/202510011050169708-6fb93127-39a6-457a-9a9c-81cf1ee85b47.jpg',
      roomTypes: [
        { name: 'Luxury Tent', capacity: 2, rate: 6700 },
        { name: 'Maharaja Suite', capacity: 2, rate: 9500 }
      ]
    } 
  ] 
};

export const SIGHTSEEING_DATA: Record<string, Sightseeing[]> = { 
  Bhuj: [ 
    { name: 'Aina Mahal', desc: '18th-century Palace of Mirrors showcasing Kutchi craftsmanship.', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcToxFtxUvdI6_hJL1RcSJfQdOsBYWPWjML6rg&s' }, 
    { name: 'Prag Mahal', desc: 'Italian Gothic palace and clock tower with panoramic city views.', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQktKpKS4NAWCqHIPIhg_i9n8O4PtZbKkVpGQ&s' }, 
    { name: 'Swaminarayan Temple', desc: 'Masterpiece of white marble carving and spiritual serenity.', img: 'https://hblimg.mmtcdn.com/content/hubble/img/BhujImage/mmt/activities/m_shri_swaminarayan_temple_bhuj_1_l_360_640.jpg' }, 
    { name: 'Bhujodi Park', desc: 'Artisan village famous for traditional handloom weaving.', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQxZ2fHunpy7X7wk9hR-EjRu51kfTBPMyofg&s' } 
  ], 
  Mandvi: [ 
    { name: 'Vijay Vilas Palace', desc: 'Majestic seaside royal estate and popular filming location.', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT93q0UOUK90Mib9L00zpX48rf66WmFalod7w&s' }, 
    { name: 'Wind Farm Beach', desc: 'Pristine beach famous for sunsets and water sports.', img: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg5gvq6pUaFql7364spEyL69l8OCExaZwalkK0DStrzfESSa08mu5yNf66IzzAnBYFlqXN080T2PCcjrtt1KXOE8RIJPxGMSzrss3G0vYiGc5x3wNG1H0F1Bx2NT0oEIMmmmyMKuH83k7A/s1600/beach.JPG' }, 
    { name: '72 Jinalay', desc: 'Serene Jain pilgrimage site featuring 72 distinct shrines.', img: 'https://s7ap1.scene7.com/is/image/incredibleindia/72-jinalay-kutch-gujarat-4-attr-hero?qlt=82&ts=1727256250676' } 
  ], 
  Dhordo: [ 
    { name: 'White Rann', desc: 'Endless expanse of white salt desert, best viewed at sunset.', img: 'https://www.hindustantimes.com/ht-img/img/2023/10/26/original/Dhordo_2_1698298529492.jpg' }, 
    { name: 'Kalo Dungar', desc: 'Highest point in Kutch offering panoramic views.', img: 'https://www.trawell.in/admin/images/upload/359804999Kalo_Dunga_Main_2.jpg' }, 
    { name: 'Gandhi Nu Gam', desc: 'Colourful craft village known for intricate Kutchi artworks.', img: 'https://i0.wp.com/madhuonthego.com/wp-content/uploads/2022/01/IMG_20211203_125957.jpg?resize=748%2C561&ssl=1' } 
  ], 
  Dholavira: [ 
    { name: 'Harappan Site', desc: 'UNESCO World Heritage site of the Indus Valley Civilization.', img: 'https://i.natgeofe.com/n/c20d01e3-b521-4447-a4cc-e736ebde6439/24712.jpg' }, 
    { name: 'Wood Fossil Park', desc: 'Prehistoric park housing 160-million-year-old fossils.', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBwxQGZSEheFkqy7L4TI2CKI0drAvp-dG0Qw&s' } 
  ] 
};

export const VEHICLE_DATA: Vehicle[] = [ 
  { name: 'Sedan (Dzire)', rate: 3600, capacity: 4, img: 'https://stimg.cardekho.com/images/carexteriorimages/630x420/Maruti/Dzire-Tour-S/12461/1762857975456/front-left-side-47.jpg' }, 
  { name: 'Ertiga', rate: 4500, capacity: 6, img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlig-LMR58hNvPs_XtO5rbsP81uiR9d-TvpQ&s' }, 
  { name: 'Innova', rate: 5100, capacity: 7, img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTRj1HM8r-23OjwLoiga8ZWDxIasAfKxk8o4Q&s' }, 
  { name: 'Innova Crysta', rate: 5700, capacity: 7, img: 'https://cdni.autocarindia.com/ExtraImages/20220105033033_innova_crysta.jpg' }, 
  { name: 'Tempo Traveller', rate: 8700, capacity: 12, img: 'https://cdn.bluebirdtravels.in/wp-content/uploads/2017/01/Tempo_Traveller_PI.png' } 
];

export const PACKAGES: ItineraryPackage[] = [ 
  { id: '2n', name: '2N Quick Rann', img: 'https://hldak.mmtcdn.com/prod-s3-hld-hpcmsadmin/holidays/images/cities/4927/Rann-Utsav-1.jpg?downsize=328:200', days: 3, route: ['Dhordo', 'Bhuj', 'Bhuj'] }, 
  { id: '3n', name: '3N Classic Kutch', img: 'https://www.rannutsavgujarat.in/thumb/media/0x0/fLwcdhrZsXKnmCSw6YFJN7jFE5RtP9zT.jpg', days: 4, route: ['Dhordo', 'Mandvi', 'Bhuj', 'Bhuj'] }, 
  { id: '4n', name: '4N Relaxed Kutch', img: 'https://www.rannutsavgujarat.in/thumb/media/0x0/fLwcdhrZsXKnmCSw6YFJN7jFE5RtP9zT.jpg', days: 5, route: ['Bhuj', 'Dhordo', 'Dhordo', 'Mandvi', 'Bhuj'] }, 
  { id: '5n', name: '5N Grand Dholavira', img: 'https://www.rannutsav.in/wp-content/uploads/2025/06/white-rann-500x360.png', days: 6, route: ['Bhuj', 'Dholavira', 'Dhordo', 'Dhordo', 'Mandvi', 'Bhuj'] } 
];

export const POLICY_DATA: PolicyData = {
    inclusions: [
        'Pickup & Drop from Bhuj Airport/Railway Station',
        'Accommodation on Double Sharing',
        'Meals as per Hotel Plan selected',
        'AC Vehicles as per selection (300km/day/vehicle)',
        'Driver Allowance, Toll, Parking',
        'Rann Utsav Permit Assistance'
    ],
    exclusions: [
        'Lunch',
        'Monument Entry Tickets',
        'Guide Charges',
        'Personal Expenses',
        'Train/Flight Tickets'
    ]
};
