
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Hotel, ItineraryPackage, Vehicle, Sightseeing, RoomType } from '../types';
import { useRealtime } from './useRealtime';

interface ItineraryData {
  hotelData: Record<string, Hotel[]>;
  sightseeingData: Record<string, Sightseeing[]>;
  vehicleData: Vehicle[];
  packages: ItineraryPackage[];
  loading: boolean;
  error: string | null;
}

// Helper to safely extract image from various common column names
// Includes fallback chain: image_url -> cover_image -> image -> photo -> url -> img
const extractImage = (row: any) => {
  return row.image_url || row.cover_image || row.image || row.photo || row.url || row.img || null;
};

export const useItineraryData = (destinationSlug: string = 'kutch') => {
  const [data, setData] = useState<ItineraryData>({
    hotelData: {},
    sightseeingData: {},
    vehicleData: [],
    packages: [],
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    try {
      // Don't set loading to true here to avoid flickering on updates
      // setData(prev => ({ ...prev, loading: true }));

      // 1. Fetch Hotels
      // Changed to select * to avoid "column does not exist" errors for specific image columns
      const { data: hotelsRaw, error: hotelError } = await supabase
        .from('hotels')
        .select(`
          *,
          locations!inner (name),
          room_types (name, capacity, rate)
        `);

      if (hotelError) throw hotelError;

      // 2. Fetch Sightseeing
      // Changed to select * to be safe
      const { data: sightsRaw, error: sightError } = await supabase
        .from('sightseeing')
        .select(`
          *,
          locations!inner (name)
        `);

      if (sightError) throw sightError;

      // 3. Fetch Vehicles (Select * to ensure we catch whatever column name exists)
      const { data: vehiclesRaw, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*');

      if (vehicleError) throw vehicleError;

      // 4. Fetch Packages (Select * to ensure we catch whatever column name exists)
      const { data: packagesRaw, error: packageError } = await supabase
        .from('packages')
        .select('*');

      if (packageError) throw packageError;

      // --- TRANSFORMATIONS ---

      // Transform Hotels: Group by City Name
      const hotelData: Record<string, Hotel[]> = {};
      hotelsRaw?.forEach((h: any) => {
        const city = h.locations?.name || 'Unknown';
        if (!hotelData[city]) hotelData[city] = [];

        hotelData[city].push({
          name: h.name?.trim(),
          rate: 0, 
          type: h.type,
          tier: h.tier,
          img: extractImage(h), // Will pick up image_url from *
          roomTypes: h.room_types.map((rt: any) => ({
            name: rt.name,
            capacity: rt.capacity,
            rate: rt.rate
          }))
        });
      });

      // Transform Sightseeing: Group by City Name
      const sightseeingData: Record<string, Sightseeing[]> = {};
      sightsRaw?.forEach((s: any) => {
        const city = s.locations?.name || 'Unknown';
        if (!sightseeingData[city]) sightseeingData[city] = [];

        sightseeingData[city].push({
          name: s.name?.trim(),
          desc: s.description,
          img: extractImage(s) // Will pick up image_url from *
        });
      });

      // Transform Vehicles
      const vehicleData: Vehicle[] = vehiclesRaw?.map((v: any) => ({
        name: v.name?.trim(), // Important: Trim whitespace
        rate: v.rate,
        capacity: v.capacity,
        img: extractImage(v) // Use robust helper
      })) || [];

      // Transform Packages
      const packages: ItineraryPackage[] = packagesRaw?.map((p: any) => ({
        id: p.id,
        name: p.name?.trim(),
        img: extractImage(p), // Use robust helper
        days: p.days,
        // Ensure route is parsed if it comes as a JSON string, or used directly if JSONB
        route: typeof p.route === 'string' ? JSON.parse(p.route) : p.route
      })) || [];

      setData({
        hotelData,
        sightseeingData,
        vehicleData,
        packages,
        loading: false,
        error: null
      });

    } catch (err: any) {
      console.error('Error fetching itinerary data:', err);
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [destinationSlug]);

  // Initial Fetch
  useEffect(() => {
    setData(prev => ({ ...prev, loading: true }));
    fetchData();
  }, [fetchData]);

  // --- Realtime Subscriptions ---
  // When any of these tables change, we re-fetch to ensure we get joined data (like locations) correctly
  const handleRealtimeUpdate = () => {
      console.log('Realtime update detected, refreshing data...');
      fetchData();
  };

  useRealtime('hotels', handleRealtimeUpdate);
  useRealtime('sightseeing', handleRealtimeUpdate);
  useRealtime('vehicles', handleRealtimeUpdate);
  useRealtime('packages', handleRealtimeUpdate);
  useRealtime('room_types', handleRealtimeUpdate); // Also listen to child table

  return data;
};
