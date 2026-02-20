
import { Hotel, RoomType } from '../../types';

export interface FleetItem {
    id: string;
    name: string;
    count: number;
}

export interface CustomDay {
    id: string;
    city: string;
    hotel: Hotel | null;
    selectedRoomType?: RoomType;
    sightseeing: string[]; 
}

export interface ItineraryPricing {
    netTotal: number;
    finalTotal: number;
    perPerson: number;
}
