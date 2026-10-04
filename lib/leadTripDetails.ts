// Legacy and API-created leads may contain only part of the nested trip object.
export function normalizeLeadTripDetails(data: any) {
  const trip = data.trip_details && typeof data.trip_details === 'object' ? data.trip_details : {};
  const pax = trip.paxConfig && typeof trip.paxConfig === 'object' ? trip.paxConfig : {};
  return {
    ...trip,
    destination: trip.destination ?? data.destination ?? '',
    budget: Number(trip.budget ?? data.budget) || 0,
    startDate: trip.startDate ?? data.travel_date ?? '',
    paxConfig: {
      ...pax,
      adults: Number(pax.adults ?? data.pax ?? 2) || 0,
      children: Number(pax.children) || 0,
      childAges: Array.isArray(pax.childAges) ? pax.childAges : [],
    },
  };
}
