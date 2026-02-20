
export type ThemeMode = 'light' | 'dark' | 'ocean';

export type LeadStatus = 'New' | 'Contacted' | 'Proposal Sent' | 'Discussion' | 'Won' | 'Lost';
export type LeadTemperature = 'Hot' | 'Warm' | 'Cold';
export type LeadSource = 'Instagram' | 'Walk-in' | 'Referral' | 'Website' | 'Other';

export type UserRole = 'admin' | 'agent';

export interface User {
  name: string;
  role: UserRole;
  id: string;
  passcode: string;
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
}

export interface TravelPreferences {
  hotel?: '3 Star' | '4 Star' | '5 Star' | 'Luxury';
  mealPlan?: 'CP (Bfast)' | 'MAP (Bfast+Din)' | 'AP (All Meals)';
}

// Updated Data Structure for Multiple Vendors
export interface VendorDetail {
  id: string;
  name: string; // Mandatory
  cost: number; // Buying Price
  price: number; // Selling Price
  category?: string; // e.g., Hotel, Transport
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
  assignedTo?: string; // New: Agent Name
  tags: string[];
  createdAt: string; // ISO Timestamp
  lastStatusUpdate?: string; // ISO Timestamp
}

export type InteractionType = 'Call' | 'Note' | 'Email' | 'StatusChange' | 'TaskLog';
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
  rate: number; // Rate per Room per Night
}

export interface Hotel {
  name: string;
  rate: number; // Base rate (backward compatibility)
  type: string; // e.g. 'CPAI', 'MAPAI'
  tier: 'Budget' | 'Premium';
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
