
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateId, useRoomCalculator, formatDate, formatCurrency } from '../utils/helpers';
import { PageLoader } from './ui/PageLoader';
import { Hotel, ItineraryPackage, RoomType, Vehicle, Sightseeing } from '../types';
import { DestinationGallery } from './DestinationGallery';
import { useItineraryData } from '../hooks/useItineraryData';

// Modular Imports
import { ItineraryHeader } from './itinerary/ItineraryHeader';
import { GalleryView } from './itinerary/GalleryView';
import { PricingControlDeck } from './itinerary/PricingControlDeck';
import { TimelineView } from './itinerary/TimelineView';
import { CustomBuilder } from './itinerary/CustomBuilder';
import { FleetManager } from './itinerary/FleetManager';
import { HotelSwapModal } from './itinerary/HotelSwapModal';
import { FleetItem, CustomDay } from './itinerary/types';
import { FALLBACK_IMG, getMealPlanLabel, getSmartDate } from './itinerary/utils';

// --- SUB-COMPONENT: WRAPPER FOR KUTCH SPECIFIC FLOW ---

const KutchFlow: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { hotelData, sightseeingData, vehicleData, packages, loading, error } = useItineraryData('kutch');

    if (loading) return <PageLoader />;
    if (error) return <div className="p-10 text-center text-red-500">Error loading Kutch data: {error}</div>;

    return (
        <KutchBuilder
            onBack={onBack}
            hotelData={hotelData}
            sightseeingData={sightseeingData}
            vehicleData={vehicleData}
            packages={packages}
        />
    );
};

// --- KUTCH BUILDER COMPONENT ---

const KutchBuilder: React.FC<{ 
    onBack: () => void;
    hotelData: Record<string, Hotel[]>;
    sightseeingData: Record<string, Sightseeing[]>;
    vehicleData: Vehicle[];
    packages: ItineraryPackage[];
}> = ({ onBack, hotelData, sightseeingData, vehicleData, packages }) => {
  
  // --- STATE ---
  const [view, setView] = useState<'gallery' | 'editor' | 'custom_builder'>('gallery');
  const [pax, setPax] = useState(2);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [guestName, setGuestName] = useState('Guest');
  const [gallerySharingMode, setGallerySharingMode] = useState<'Double' | 'Quad'>('Double');
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [baseTier, setBaseTier] = useState<'Budget' | 'Premium'>('Budget');
  const [hotelOverrides, setHotelOverrides] = useState<Record<number, { hotel: Hotel, roomType: RoomType }>>({}); 
  const [sightseeingOverrides, setSightseeingOverrides] = useState<Record<number, string[]>>({}); 
  const [customPackage, setCustomPackage] = useState<ItineraryPackage | null>(null);
  const [fleet, setFleet] = useState<FleetItem[]>([]);
  const [isManualFleet, setIsManualFleet] = useState(false); 
  const [isFleetModalOpen, setIsFleetModalOpen] = useState(false);
  const [markupType, setMarkupType] = useState<'percent' | 'fixed'>('percent');
  const [markupValue, setMarkupValue] = useState<number>(0);
  const [swapModal, setSwapModal] = useState<{ dayIndex: number; city: string } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // PDF Generation State
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  // --- FLEET AUTO-CALCULATION ---
  useEffect(() => {
      if (!isManualFleet) {
          const autoFleet: FleetItem[] = [];
          const id = generateId();
          if (pax <= 4) { autoFleet.push({ id, name: 'Sedan (Dzire)', count: 1 }); } 
          else if (pax <= 6) { autoFleet.push({ id, name: 'Innova', count: 1 }); } 
          else if (pax <= 12) { autoFleet.push({ id, name: 'Tempo Traveller', count: 1 }); } 
          else { autoFleet.push({ id, name: 'Tempo Traveller', count: Math.ceil(pax / 12) }); }
          setFleet(autoFleet);
      }
  }, [pax, isManualFleet]);

  // --- PRICING LOGIC ---
  const calculatePrice = (pkg: ItineraryPackage, tier: 'Budget' | 'Premium', overrides: Record<number, { hotel: Hotel, roomType: RoomType }> = {}) => {
      let transportCost = 0;
      fleet.forEach(item => {
          const vData = vehicleData.find(v => v.name === item.name);
          if (vData) transportCost += (vData.rate * item.count * pkg.days);
      });
      let hotelCost = 0;
      pkg.route.forEach((city, index) => {
          let override = overrides[index];
          let rate = 0;
          let capacity = 2; 
          if (override) {
              rate = override.roomType.rate;
              capacity = override.roomType.capacity;
          } else {
              const cityHotels = hotelData[city] || [];
              const hotel = cityHotels.find(h => h.tier === tier) || cityHotels[0];
              if (hotel) {
                  rate = hotel.roomTypes[0]?.rate || 0;
                  capacity = hotel.roomTypes[0]?.capacity || 2;
              }
          }
          const roomsNeeded = useRoomCalculator(pax, capacity);
          hotelCost += (rate * roomsNeeded);
      });
      const netTotal = transportCost + hotelCost;
      return { netTotal, perPerson: pax > 0 ? Math.round(netTotal / pax) : 0 };
  };

  const activePackage = selectedPkgId === 'custom' ? customPackage : packages.find(p => p.id === selectedPkgId);

  const editorPricing = useMemo(() => {
      if (!activePackage) return null;
      const { netTotal } = calculatePrice(activePackage, baseTier, hotelOverrides);
      let finalTotal = netTotal;
      if (markupType === 'percent') finalTotal = netTotal * (1 + markupValue / 100);
      else finalTotal = netTotal + markupValue;
      return { netTotal, finalTotal, perPerson: pax > 0 ? Math.round(finalTotal / pax) : 0 };
  }, [activePackage, baseTier, hotelOverrides, fleet, pax, markupType, markupValue, vehicleData]);

  // --- HANDLERS ---
  const handleAddVehicle = () => { setIsManualFleet(true); setFleet([...fleet, { id: generateId(), name: 'Sedan (Dzire)', count: 1 }]); };
  const handleRemoveVehicle = (id: string) => { setIsManualFleet(true); setFleet(fleet.filter(f => f.id !== id)); };
  const handleUpdateVehicle = (id: string, field: 'name' | 'count', value: any) => { setIsManualFleet(true); setFleet(fleet.map(f => f.id === id ? { ...f, [field]: value } : f)); };
  
  const handleSelectPackage = (pkgId: string, tier: 'Budget' | 'Premium') => { 
      setSelectedPkgId(pkgId); 
      setBaseTier(tier); 
      setHotelOverrides({}); 
      setSightseeingOverrides({}); 
      setMarkupValue(0); 
      setView('editor'); 
  };
  
  const handleUpdateRoomType = (dayIndex: number, hotel: Hotel, roomType: RoomType) => { 
      setHotelOverrides(prev => ({ ...prev, [dayIndex]: { hotel, roomType } })); 
  };
  
  const handleCustomComplete = (days: CustomDay[]) => {
      const newCustomPkg: ItineraryPackage = {
          id: 'custom',
          name: 'Your Custom Journey',
          img: FALLBACK_IMG,
          days: days.length,
          route: days.map(d => d.city)
      };
      const newHotelOverrides: Record<number, { hotel: Hotel, roomType: RoomType }> = {};
      const newSightseeingOverrides: Record<number, string[]> = {};
      days.forEach((day, idx) => {
          if (day.hotel && day.selectedRoomType) newHotelOverrides[idx] = { hotel: day.hotel, roomType: day.selectedRoomType };
          newSightseeingOverrides[idx] = day.sightseeing || [];
      });
      setCustomPackage(newCustomPkg); 
      setHotelOverrides(newHotelOverrides); 
      setSightseeingOverrides(newSightseeingOverrides); 
      setSelectedPkgId('custom'); 
      setView('editor');
  };

  // --- TEXT GENERATION & COPY LOGIC ---

  const generateItineraryText = () => {
      if (!activePackage || !editorPricing) return '';

      // Calculate End Date
      const endD = new Date(startDate);
      endD.setDate(endD.getDate() + activePackage.days - 1);
      const endDateStr = formatDate(endD.toISOString());
      
      const vehicleStr = fleet.map(f => `${f.count}x ${f.name}`).join(', ');

      let text = `🌟 *Quotation by THE TOURISM EXPERTS* 🌟\n\n`;
      text += `📅 *Trip Summary*\n`;
      text += `👤 *Guest:* ${guestName}\n`;
      text += `👥 *Pax:* ${pax} Adults\n`;
      text += `⏳ *Duration:* ${activePackage.days - 1} Nights / ${activePackage.days} Days\n`;
      text += `🗓 *Dates:* ${formatDate(startDate)} - ${endDateStr}\n`;
      text += `🚗 *Transport:* ${vehicleStr}\n\n`;

      text += `--- *Daily Itinerary* ---\n\n`;

      activePackage.route.forEach((city, index) => {
          const date = getSmartDate(startDate, index);
          
          // Resolve Hotel & Room
          const override = hotelOverrides[index];
          let hotelName = 'No Hotel Selected';
          let roomName = '';
          let mealPlan = '';

          if (override) {
              hotelName = override.hotel.name;
              roomName = override.roomType.name;
              mealPlan = getMealPlanLabel(override.hotel.type);
          } else {
              const cityHotels = hotelData[city] || [];
              const hotel = cityHotels.find(h => h.tier === baseTier) || cityHotels[0];
              if (hotel) {
                  hotelName = hotel.name;
                  roomName = hotel.roomTypes[0]?.name || '';
                  mealPlan = getMealPlanLabel(hotel.type);
              }
          }

          // Resolve Sightseeing
          const daySightseeingOverrides = sightseeingOverrides[index];
          const allSights = sightseeingData[city] || [];
          const sights = daySightseeingOverrides
              ? allSights.filter(s => daySightseeingOverrides.includes(s.name))
              : allSights; 
          
          const sightNames = sights.map(s => s.name).join(', ');

          text += `📍 *Day ${index + 1}: ${city}* (${date})\n`;
          text += `🏨 Stay: ${hotelName} (${roomName})\n`;
          text += `🍽 Plan: ${mealPlan}\n`;
          if (sightNames) text += `📸 Visits: ${sightNames}\n`;
          text += `\n`;
      });

      text += `💰 *Total Cost:* ${formatCurrency(editorPricing.finalTotal)}\n`;
      text += `   (Includes Hotels, Transport, & Taxes)\n`;

      return text;
  };

  const handleCopyQuotation = async () => {
      const text = generateItineraryText();
      if (!text) return;

      try {
          await navigator.clipboard.writeText(text);
          setCopyFeedback(true);
          setTimeout(() => setCopyFeedback(false), 2000);
      } catch (err) {
          console.warn("Clipboard API failed, falling back to execCommand", err);
          try {
              const textArea = document.createElement("textarea");
              textArea.value = text;
              textArea.style.position = "fixed";
              textArea.style.left = "-9999px";
              textArea.style.top = "0";
              document.body.appendChild(textArea);
              textArea.focus();
              textArea.select();
              const successful = document.execCommand('copy');
              document.body.removeChild(textArea);
              if (successful) {
                  setCopyFeedback(true);
                  setTimeout(() => setCopyFeedback(false), 2000);
              } else {
                  alert("Failed to copy. Please manually copy the text.");
              }
          } catch (fallbackErr) {
              console.error("Copy failed", fallbackErr);
              alert("Clipboard access denied.");
          }
      }
  };
  
  return (
    <div className="fixed top-0 bottom-0 right-0 left-0 md:left-64 z-30 bg-slate-50 flex flex-col overflow-hidden transition-all duration-300 animate-in fade-in">
        
        {/* --- VIEW 1: GALLERY --- */}
        {view === 'gallery' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    <ItineraryHeader 
                        startDate={startDate} setStartDate={setStartDate}
                        pax={pax} setPax={setPax}
                        fleet={fleet} onOpenFleetModal={() => setIsFleetModalOpen(true)}
                        guestName={guestName} setGuestName={setGuestName}
                        onBack={onBack}
                        onUpdateRates={() => {}}
                    />

                    <GalleryView 
                        packages={packages}
                        pax={pax}
                        gallerySharingMode={gallerySharingMode}
                        setGallerySharingMode={setGallerySharingMode}
                        onSelectPackage={handleSelectPackage}
                        onOpenCustomBuilder={() => setView('custom_builder')}
                        hotelData={hotelData}
                    />
                </div>
            </div>
        )}

        {/* --- VIEW 3: CUSTOM BUILDER (ABSOLUTE OVERLAY) --- */}
        {view === 'custom_builder' && (
            <CustomBuilder 
                onCancel={() => setView('gallery')}
                onComplete={handleCustomComplete}
                guestName={guestName} setGuestName={setGuestName}
                pax={pax} setPax={setPax}
                startDate={startDate} setStartDate={setStartDate}
                fleet={fleet} onOpenFleetModal={() => setIsFleetModalOpen(true)}
                hotelData={hotelData}
                sightseeingData={sightseeingData}
                vehicleData={vehicleData}
            />
        )}

        {/* --- VIEW 2: EDITOR --- */}
        {view === 'editor' && activePackage && editorPricing && (
            <div className="flex flex-col h-full">
                <div className="shrink-0 z-30 shadow-sm relative bg-slate-50">
                    <PricingControlDeck 
                        pricing={editorPricing}
                        markupType={markupType} setMarkupType={setMarkupType}
                        markupValue={markupValue} setMarkupValue={setMarkupValue}
                        onBack={() => setView('gallery')}
                        onOpenFleetModal={() => setIsFleetModalOpen(true)}
                        onGeneratePDF={() => {}} 
                        onCopyQuote={handleCopyQuotation}
                        isPdfLoading={isPdfLoading}
                        copyFeedback={copyFeedback}
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-32 bg-slate-50/50">
                    <div className="max-w-5xl mx-auto">
                        <TimelineView 
                            activePackage={activePackage}
                            startDate={startDate}
                            pax={pax}
                            fleet={fleet}
                            hotelOverrides={hotelOverrides}
                            sightseeingOverrides={sightseeingOverrides}
                            baseTier={baseTier}
                            onSwapHotel={(dayIndex, city) => setSwapModal({ dayIndex, city })}
                            onUpdateRoomType={handleUpdateRoomType}
                            onOpenFleetModal={() => setIsFleetModalOpen(true)}
                            hotelData={hotelData}
                            sightseeingData={sightseeingData}
                            vehicleData={vehicleData}
                        />
                    </div>
                </div>
            </div>
        )}

        <FleetManager 
            isOpen={isFleetModalOpen} 
            onClose={() => setIsFleetModalOpen(false)}
            fleet={fleet}
            onAddVehicle={handleAddVehicle}
            onRemoveVehicle={handleRemoveVehicle}
            onUpdateVehicle={handleUpdateVehicle}
            vehicleData={vehicleData}
        />

        {swapModal && (
            <HotelSwapModal 
                isOpen={!!swapModal} 
                onClose={() => setSwapModal(null)} 
                city={swapModal.city}
                dayIndex={swapModal.dayIndex}
                hotels={hotelData[swapModal.city] || []}
                onSelect={handleUpdateRoomType}
            />
        )}
    </div>
  );
};

export const KutchItineraryBuilder = () => {
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!selectedDest) {
    return <DestinationGallery onSelect={(dest) => {
        if (dest === 'group-tours') {
            navigate('/group-tours');
        } else if (dest === 'direct-packages') {
            navigate('/direct-packages');
        } else {
            setSelectedDest(dest);
        }
    }} />;
  }

  return (
    <KutchFlow
      onBack={() => setSelectedDest(null)}
    />
  );
};
