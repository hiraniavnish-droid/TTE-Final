
import { Hotel, ItineraryPackage, RoomType, Vehicle } from '../../types';
import { FleetItem } from './types';
import { useRoomCalculator } from '../../utils/helpers';

export const FALLBACK_IMG = "https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?q=80&w=1932&auto=format&fit=crop";

export const getMealPlanLabel = (type: string) => {
    const t = type ? type.toUpperCase() : '';
    if (t.includes('CPAI') || t.includes('CP')) return 'Breakfast Included';
    if (t.includes('MAPAI') || t.includes('MAP')) return 'Breakfast & Dinner Included';
    if (t.includes('APAI') || t.includes('AP')) return 'All Meals Included';
    return type || 'Plan Not Specified'; 
};

export const getShortMealPlan = (type: string) => {
    const t = type ? type.toUpperCase() : '';
    if (t.includes('CPAI') || t.includes('CP')) return 'Breakfast';
    if (t.includes('MAPAI') || t.includes('MAP')) return 'Bfast + Dinner';
    if (t.includes('APAI') || t.includes('AP')) return 'All Meals';
    return type || 'N/A'; 
};

export const getSmartDate = (startDateStr: string, dayIndex: number, short = false) => {
    const d = new Date(startDateStr);
    d.setDate(d.getDate() + dayIndex);
    return d.toLocaleDateString('en-GB', { 
        weekday: short ? 'short' : 'long', 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
};

export const getVehicleString = (fleet: FleetItem[]) => {
    if (fleet.length === 0) return 'No Vehicle Selected';
    return fleet.map(f => `${f.count}x ${f.name}`).join(', ');
};

export const generateRouteSummary = (route: string[]) => {
    if (!route || route.length === 0) return '';
    
    const summary: { city: string; nights: number }[] = [];
    let currentCity = route[0];
    let currentCount = 1;

    for (let i = 1; i < route.length; i++) {
        if (route[i] === currentCity) {
            currentCount++;
        } else {
            summary.push({ city: currentCity, nights: currentCount });
            currentCity = route[i];
            currentCount = 1;
        }
    }
    summary.push({ city: currentCity, nights: currentCount });

    return summary.map(s => `${s.city} ${s.nights}N`).join(' • ');
};

export const calculateGalleryPrice = (
    pkg: ItineraryPackage, 
    tier: 'Budget' | 'Premium',
    pax: number,
    gallerySharingMode: 'Double' | 'Quad',
    hotelData: Record<string, Hotel[]>
) => {
    const activePax = pax; 
    const targetCapacity = gallerySharingMode === 'Quad' ? 4 : 2;
    let totalHotelCost = 0;
    
    pkg.route.forEach(city => {
        const cityHotels = hotelData[city] || [];
        const hotel = cityHotels.find(h => h.tier === tier) || cityHotels[0];
        if (hotel) {
            let selectedRoom = hotel.roomTypes.find(r => r.capacity === targetCapacity);
            if (!selectedRoom) selectedRoom = hotel.roomTypes[0]; 
            const roomsNeeded = useRoomCalculator(activePax, selectedRoom?.capacity || 2);
            totalHotelCost += ((selectedRoom?.rate || 0) * roomsNeeded);
        }
    });
    
    // Rough estimate for transport in gallery view
    const estimatedVehicleCost = 3500 * Math.ceil(activePax/4) * pkg.days; 
    return totalHotelCost + estimatedVehicleCost; 
};
