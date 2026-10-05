
export type ThemeMode = 'light' | 'dark' | 'ocean';

export type LeadStatus = 'New' | 'Contacted' | 'Proposal Sent' | 'Discussion' | 'Won' | 'Lost';
export type LeadTemperature = 'Hot' | 'Warm' | 'Cold';
export type LeadSource = 'Instagram' | 'Walk-in' | 'Referral' | 'Website' | 'WhatsApp' | 'Other';

export type UserRole = 'admin' | 'agent';

export interface User {
  name: string;
  role: UserRole;
  id: string;
  passcode: string;
  phone?: string; // WhatsApp number for team lead-update notifications (empty = doesn't receive them)
}

export interface LeadContact {
  phone: string;
  email: string;
}

export interface PaxConfig {
  adults: number;
  children: number;
  childAges: number[];
}

export interface TripDetails {
  destination: string;
  paxConfig: PaxConfig;
  budget: number;
  startDate: string;
  nights?: number;
  rooms?: number;
  accommodation?: string;
  // The complete user-facing website form payload. Kept alongside the
  // normalised CRM fields so future form changes cannot lose enquiry data.
  websiteFields?: Record<string, string>;
}

export interface TravelPreferences {
  hotel?: '3 Star' | '4 Star' | '5 Star' | 'Luxury';
  mealPlan?: 'CP (Bfast)' | 'MAP (Bfast+Din)' | 'AP (All Meals)';
}

// Updated Data Structure for Multiple Vendors
export interface VendorPayment {
  id: string;
  amount: number;
  method: 'Cash' | 'Cheque' | 'Bank Transfer' | 'UPI' | 'Other';
  date: string; // yyyy-mm-dd
  reference?: string; // cheque no. / UTR / UPI txn ID / any entry ref
  notes?: string;
  recordedBy: string;
  recordedAt: string; // ISO timestamp
}

export interface VendorDetail {
  id: string;
  name: string; // Mandatory
  cost: number; // Buying Price
  price: number; // Selling Price
  category?: string; // e.g., Hotel, Transport
  payments?: VendorPayment[]; // Payments made to this vendor (partial or full)
}

export interface Commercials {
  sellingPrice: number;
  netCost: number;
  taxAmount?: number;
  vendorId: string; // 'manual' for others/custom
  manualVendorName?: string;
}

export interface Lead {
  id: string;
  leadCode?: string; // Human-readable display code (TTE-0001). Assigned by a DB trigger on insert — never set or edited by the app. Optional so the UI degrades gracefully before migration 006 runs. The uuid `id` remains the real key everywhere.
  name: string;
  contact: LeadContact;
  tripDetails: TripDetails;
  preferences?: TravelPreferences; 
  commercials?: Commercials; // Kept for backward compatibility/summary
  vendors?: VendorDetail[]; // NEW: Array of vendors
  status: LeadStatus;
  temperature: LeadTemperature;
  source: LeadSource;
  interestedServices: string[];
  referenceName?: string;
  assignedTo?: string | null; // New: Agent Name — null explicitly means "Unassigned" (must be null, not undefined, so it's still sent on update)
  tags: string[];
  createdAt: string; // ISO Timestamp
  lastStatusUpdate?: string; // ISO Timestamp
  wonAt?: string; // ISO Timestamp — stamped once, the first time this lead becomes Won; never overwritten afterwards. The canonical "which month is this sale attributed to" date.
  legacy?: boolean; // Old-company / handled-differently deal: stays fully visible but excluded from ALL financial aggregates (pending, outstanding, vendor owed, revenue/profit). Admin-toggleable.
}

export type InteractionType = 'Call' | 'Note' | 'Email' | 'StatusChange' | 'TaskLog' | 'WhatsApp';
export type Sentiment = 'Positive' | 'Neutral' | 'Negative';

export interface Interaction {
  id: string;
  leadId: string;
  type: InteractionType;
  content: string;
  sentiment?: Sentiment;
  timestamp: string;
}

export interface Reminder {
  id: string;
  leadId: string;
  task: string;
  dueDate: string;
  isCompleted: boolean;
}

export type SupplierCategory = 'DMC' | 'Hotelier' | 'Transport' | 'Visa';

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  destinations: string[];
  category: SupplierCategory;
  rating: number; // 1-5
}

// --- NEW ACTIVITY LOGGING ---
export type ActionType = 'NEW_LEAD' | 'STATUS_CHANGE' | 'COMMENT';

export interface ActivityLog {
  id: string;
  agentName: string;
  actionType: ActionType;
  details: string;
  timestamp: string; // ISO String
  leadId: string;
  metadata?: {
    leadName?: string;
    oldStatus?: string;
    newStatus?: string;
  };
}

// --- ITINERARY MODULE TYPES ---

export interface RoomType {
  name: string;
  capacity: number; // 2 for Double, 4 for Quad
  rate: number;    // CP rate (Breakfast only) — used as base/fallback
  mapRate?: number; // MAP rate (Breakfast + Dinner)
  apRate?: number;  // AP rate (All Meals)
}

export interface Hotel {
  name: string;
  rate: number; // Base rate (backward compatibility)
  type: string; // e.g. 'CPAI', 'MAPAI'
  tier: 'Budget' | 'Premium' | 'Luxury';
  img: string;
  roomTypes: RoomType[]; // New Advanced Structure
}

export interface Sightseeing {
  name: string;
  desc: string;
  img: string;
}

export interface Vehicle {
  name: string;
  rate: number;
  capacity: number;
  img: string;
}

export interface ItineraryPackage {
  id: string;
  name: string;
  img: string;
  days: number;
  route: string[]; // List of cities/locations
}

export interface PolicyData {
  inclusions: string[];
  exclusions: string[];
}
