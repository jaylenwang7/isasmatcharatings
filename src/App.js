import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Camera, X, Map, ListFilter, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Helper functions for tier parsing
const getBaseTier = (tier) => tier ? tier.replace('+', '') : '';
const isPlusTier = (tier) => tier ? tier.endsWith('+') : false;

// Improve touch detection
L.Browser.touch = true;
L.Browser.mobile = true;

// Fix for default marker icons in production
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Create custom icons for each tier
const createTierIcon = (color, isSelected = false) => {
  const size = isSelected ? 35 : 25;
  const borderWidth = isSelected ? 4 : 2;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: ${borderWidth}px solid white;
      border-radius: ${isSelected ? '4px' : '50%'};
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transform: ${isSelected ? 'rotate(45deg)' : 'none'};
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2],
  });
};

const getBasePath = () => {
  return process.env.PUBLIC_URL || '';
};

// Tier definitions with colors and descriptions
const TIERS = {
  S: {
    color: 'bg-purple-100 hover:bg-purple-200',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-300',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-purple-300',
    description: 'This matcha is good af - the best of the best, would go out of my way for it',
    markerColor: '#9333ea' // Purple
  },
  A: {
    color: 'bg-green-100 hover:bg-green-200',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    gradientFrom: 'from-green-500',
    gradientTo: 'to-green-300',
    description: 'Would be happy to have this matcha any day of the week',
    markerColor: '#22c55e' // Green
  },
  B: {
    color: 'bg-blue-100 hover:bg-blue-200',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-300',
    description: 'Solid choice, would be happy to get this at a cafe',
    markerColor: '#3b82f6' // Blue
  },
  C: {
    color: 'bg-yellow-100 hover:bg-yellow-200',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    gradientFrom: 'from-yellow-500',
    gradientTo: 'to-yellow-300',
    description: 'Decent matcha when you need to order something at a cafe',
    markerColor: '#eab308' // Yellow
  },
  D: {
    color: 'bg-orange-100 hover:bg-orange-200',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-300',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-orange-300',
    description: 'Bruh, lackluster, would not recommend',
    markerColor: '#f97316' // Orange
  },
  F: {
    color: 'bg-red-100 hover:bg-red-200',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-red-300',
    description: 'Would avoid and maybe not even finish',
    markerColor: '#ef4444' // Red
  }
};

// Create icons for each tier
const TIER_ICONS = {};
Object.entries(TIERS).forEach(([tier, config]) => {
  TIER_ICONS[tier] = {
    default: createTierIcon(config.markerColor),
    selected: createTierIcon(config.markerColor, true)
  };
});

const PlaceImage = ({ imagePath, name, size = "normal" }) => {
  // Helper component to handle image display with fallback
  const sizeClasses = {
    small: "w-10 h-10",
    normal: "h-40 sm:h-56",
    large: "max-h-[400px] sm:max-h-[600px]"
  };

  if (!imagePath) {
    return (
      <img 
        src={`${getBasePath()}/images/matcha.png`}
        alt="Matcha placeholder"
        className={`${sizeClasses[size]} object-cover bg-gray-100`}
      />
    );
  }

  return (
    <img 
      src={`${getBasePath()}/${imagePath}`}
      alt={name}
      className={`${sizeClasses[size]} ${size === 'normal' ? 'object-cover' : 'object-cover'}`}
    />
  );
};

const PhotoGrid = ({ places, onPlaceSelect, isOpen, onClose }) => {
  if (!isOpen) return null;

  // Filter out places without images
  const validPlaces = places.filter(place => place.imagePath);

  // Helper function to convert color class to RGB
  const getTierColor = (tier) => {
    switch (tier) {
      case 'S': return 'rgb(147, 51, 234)'; // Purple
      case 'A': return 'rgb(34, 197, 94)';  // Green
      case 'B': return 'rgb(59, 130, 246)'; // Blue
      case 'C': return 'rgb(234, 179, 8)';  // Yellow
      case 'D': return 'rgb(249, 115, 22)'; // Orange
      case 'F': return 'rgb(239, 68, 68)';  // Red
      default: return 'rgb(59, 130, 246)';  // Default blue
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1001] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="flex justify-between items-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Photo Gallery</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {validPlaces.map((place) => (
            <div
              key={place.id}
              className="group relative bg-white rounded-xl overflow-hidden shadow-lg 
                transform transition-all duration-300 hover:scale-105 cursor-pointer"
              style={{
                boxShadow: `0 0 0 4px ${getTierColor(getBaseTier(place.tier))}`
              }}
              onClick={() => {
                onPlaceSelect(place);
                onClose();
              }}
            >
              <div className="aspect-square">
                <img
                  src={`${getBasePath()}/${place.imagePath}`}
                  alt={place.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white">
                  <h3 className="font-semibold text-base sm:text-lg">{place.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs sm:text-sm 
                      ${TIERS[getBaseTier(place.tier)].color} ${TIERS[getBaseTier(place.tier)].textColor}`}>
                      Tier {place.tier}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TierList = ({ places, onPlaceSelect, setActiveView, countriesCount, usStatesCount }) => {
  const [expandedTier, setExpandedTier] = useState(null);
  
  return (
    <div className="space-y-3 sm:space-y-6">
      {Object.keys(TIERS).map(tier => (
        <div key={tier} className="relative transform transition-all duration-200 hover:scale-[1.01]">
          <div 
            className={`absolute -top-2 left-0 right-0 transform -translate-y-full 
              bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-lg z-10 transition-all duration-300
              ${expandedTier === tier ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
          >
            <p className="text-gray-700 leading-relaxed text-sm line-clamp-3">{TIERS[tier].description}</p>
          </div>
          
          <div 
            className={`rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-md hover:shadow-xl transition-shadow duration-300 
              border-l-4 ${TIERS[tier].borderColor} bg-gradient-to-br from-white to-gray-50`}
            onClick={() => setExpandedTier(expandedTier === tier ? null : tier)}
            onMouseLeave={() => setExpandedTier(null)}
          >
            <div className="flex items-center gap-3 sm:gap-6">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 flex items-center justify-center text-2xl sm:text-3xl font-bold 
                bg-gradient-to-br ${TIERS[tier].gradientFrom} ${TIERS[tier].gradientTo} 
                rounded-lg shadow-inner text-white`}>
                {tier}
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3 flex-1 min-w-0">
                {places.filter(place => getBaseTier(place.tier) === tier)
                  .sort((a, b) => {
                    const aIsPlus = isPlusTier(a.tier);
                    const bIsPlus = isPlusTier(b.tier);
                    if (aIsPlus === bIsPlus) return a.name.localeCompare(b.name);
                    return aIsPlus ? -1 : 1;
                  })
                  .map(place => {
                    const isPlus = isPlusTier(place.tier);
                    return (
                      <div 
                        key={place.id}
                        className={`relative group p-2 sm:p-3 rounded-lg cursor-pointer w-full sm:w-[calc(50%-0.75rem)]
                          ${TIERS[tier].color} transform transition-all duration-200 
                          hover:scale-102 hover:shadow-md active:scale-95
                          ${isPlus ? 'border-2 border-amber-400 shadow-lg' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlaceSelect(place);
                          // On mobile, switch to map view when place is selected
                          if (window.innerWidth < 640) {
                            setActiveView('map');
                          }
                        }}
                      >
                        {isPlus && (
                          <div className="absolute -top-2 -right-2 bg-amber-400 text-black rounded-full w-5 h-5 flex items-center justify-center shadow-lg z-10">
                            <Plus size={14} strokeWidth={3} />
                          </div>
                        )}
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-full overflow-hidden shadow-inner">
                            <PlaceImage imagePath={place.imagePath} name={place.name} size="small" />
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <span className="font-medium text-sm block truncate">{place.name}</span>
                            {place.address && (
                              <span className="text-xs text-gray-600 block truncate">
                                {place.address}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                })}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const PlaceDetails = ({ place, onClose }) => {
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  
  if (!place) return null;
  
  const tierStyle = TIERS[getBaseTier(place.tier)];
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg relative transform transition-all duration-500 
      ease-in-out origin-top hover:shadow-xl animate-slide-in">
      <button
        onClick={onClose}
        className="absolute -top-2 -right-2 text-gray-500 hover:text-gray-700 
          bg-white shadow-md hover:shadow-lg rounded-full w-8 h-8 flex items-center justify-center
          transition-all duration-200 hover:scale-110 z-20"
        aria-label="Close details"
      >
        ×
      </button>
      
      <div className="relative">
        <div className="relative overflow-hidden rounded-xl">
          {place.imagePath && (
            <img 
              src={`${getBasePath()}/${place.imagePath}`} 
              alt={place.name}
              className={`w-full transition-all duration-500 ease-in-out ${
                isImageExpanded 
                  ? 'h-auto max-h-[600px] object-contain' 
                  : 'h-56 object-cover'
              }`}
              onClick={() => setIsImageExpanded(!isImageExpanded)}
            />
          )}
          {place.imagePath && (
            <button
              onClick={() => setIsImageExpanded(!isImageExpanded)}
              className="absolute bottom-4 right-4 bg-white/90 hover:bg-white px-4 py-2 
                rounded-full text-sm text-gray-700 shadow-md hover:shadow-lg 
                transition-all duration-200 backdrop-blur-sm"
            >
              {isImageExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
      
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{place.name}</h2>
            {place.address ? (
              <p className="text-sm text-gray-600 mt-1">{place.address}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1 font-mono">
                {place.lat.toFixed(6)}, {place.lng.toFixed(6)}
              </p>
            )}
          </div>
          <div className={`px-4 py-2 rounded-full ${tierStyle.color} ${tierStyle.textColor} 
            font-medium transform transition-transform duration-200 hover:scale-105`}>
            Tier {place.tier}
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Ordered</h3>
            <p className="text-gray-700 leading-relaxed mt-1">{place.ordered}</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Notes</h3>
            <div className="text-gray-700 leading-relaxed mt-1 prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {place.notes}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [isPhotoGridOpen, setIsPhotoGridOpen] = useState(false);
  const [showPittsburghOnly, setShowPittsburghOnly] = useState(false);
  const [allPlaces, setAllPlaces] = useState([]);
  const [activeView, setActiveView] = useState('list');
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${getBasePath()}/data/places.json`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Data is not in the expected format');
        setAllPlaces(data);
        setPlaces(data);
        setError(null);
      })
      .catch(error => {
        console.error('Error loading places:', error);
        setError(`Failed to load places data: ${error.message}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (showPittsburghOnly) {
      const pghBounds = {
        minLat: 40.35,
        maxLat: 40.50,
        minLng: -80.10,
        maxLng: -79.85
      };
      
      const filteredPlaces = allPlaces.filter(place => 
        place.lat >= pghBounds.minLat &&
        place.lat <= pghBounds.maxLat &&
        place.lng >= pghBounds.minLng &&
        place.lng <= pghBounds.maxLng
      );
      setPlaces(filteredPlaces);
      
      if (mapRef && isMapReady) {
        mapRef.flyTo([40.4406, -79.9959], 12);
      }
    } else {
      setPlaces(allPlaces);
    }
  }, [showPittsburghOnly, allPlaces, mapRef, isMapReady]);

  // Updated place selection handler with fixed mobile behavior
  const handlePlaceSelect = (place) => {
    const isMobile = window.innerWidth < 640;
    
    if (isMobile) {
      // On mobile: First switch to map view
      setActiveView('map');
      setSelectedPlace(place);
      
      const attemptFly = () => {
        if (mapRef && isMapReady) {
          mapRef.invalidateSize(true);
          mapRef.flyTo([place.lat, place.lng], 15, { duration: 1 });
          setIsDetailsVisible(true);
        } else {
          setTimeout(attemptFly, 50);
        }
      };
      
      setTimeout(attemptFly, 100);
    } else {
      // Desktop behavior remains unchanged
      setSelectedPlace(place);
      if (mapRef) {
        mapRef.flyTo([place.lat, place.lng], 15, { duration: 1.2 });
        setIsDetailsVisible(false);
        setTimeout(() => setIsDetailsVisible(true), 1200);
      }
    }
  };

  const handleMapReady = (map) => {
    setMapRef(map);
    setIsMapReady(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsVisible(false);
    setTimeout(() => {
      setSelectedPlace(null);
    }, 300);
  };

  const handleViewChange = (view) => {
    const isMobile = window.innerWidth < 640;
    
    if (view === 'list') {
      setIsDetailsVisible(false);
      setTimeout(() => {
        setActiveView(view);
      }, 300);
    } else {
      setActiveView(view);
      // Force map resize when switching to map view
      if (mapRef) {
        setTimeout(() => {
          mapRef.invalidateSize(true);
        }, 50);
      }
      // If switching to map view and there's a selected place, ensure it's visible
      if (isMobile && selectedPlace && mapRef && isMapReady) {
        setTimeout(() => {
          mapRef.flyTo([selectedPlace.lat, selectedPlace.lng], 15, {
            duration: 1
          });
          setIsDetailsVisible(true);
        }, 100);
      }
    }
  };

  const countUnique = (arr) => [...new Set(arr.filter(Boolean))].length;

  const countryCount = countUnique(places.map(p => p.country));
  const usStateCount = countUnique(
    places
      .filter(p => p.country === 'USA')
      .map(p => p.state)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="text-xl font-semibold animate-pulse">Loading places...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-50">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 flex items-center gap-2">
                Isa's Matcha Tier List 
                <span className="text-2xl sm:text-3xl transform hover:scale-125 transition-transform duration-300 cursor-default">
                  🍵
                </span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed max-w-2xl">
                This is Isa's definitive matcha tier list! Isa has visited all these places and 
                rated them based on their matcha quality and overall experience.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4">
              <button
                onClick={() => setShowPittsburghOnly(!showPittsburghOnly)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-sm sm:text-base ${
                  showPittsburghOnly 
                    ? 'bg-black text-yellow-300 hover:bg-gray-800' 
                    : 'bg-yellow-300 text-black hover:bg-yellow-400'
                }`}
              >
                <img 
                  src={`${getBasePath()}/images/bridge.png`}
                  alt="Bridge icon" 
                  className={`w-4 sm:w-5 h-4 sm:h-5 object-contain ${
                    showPittsburghOnly ? 'brightness-0 invert' : 'brightness-100'
                  }`}
                />
                <span className="hidden sm:inline">{showPittsburghOnly ? 'Show All' : 'Pittsburgh Only'}</span>
                <span className="sm:hidden">{showPittsburghOnly ? 'Show All' : 'PGH'}</span>
              </button>
              <button
                onClick={() => setIsPhotoGridOpen(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-100 hover:bg-green-200 
                  text-green-800 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md text-sm sm:text-base"
              >
                <Camera size={16} className="sm:hidden" />
                <Camera size={20} className="hidden sm:block" />
                <span className="hidden sm:inline">View Gallery</span>
                <span className="sm:hidden">Photos</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Updated View Switcher */}
      <div className="sm:hidden sticky top-0 z-[999] bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="flex justify-center gap-2 p-2">
          <button
            onClick={() => handleViewChange('list')}
            className={`flex-1 max-w-[160px] flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200
              ${activeView === 'list' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
          >
            <ListFilter size={16} />
            <span>List</span>
          </button>
          <button
            onClick={() => handleViewChange('map')}
            className={`flex-1 max-w-[160px] flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200
              ${activeView === 'map' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
          >
            <Map size={16} />
            <span>Map & Info</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-10">
          {/* List View */}
          <div className={`z-[900] ${activeView === 'list' ? 'block' : 'hidden lg:block'}`}>
            <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-8 flex items-center gap-2">
              Tier List 
              <span className="text-gray-500 font-normal text-base">
                ({places.length} places)
              </span>
            </h2>
            <TierList 
              places={places} 
              onPlaceSelect={handlePlaceSelect}
              setActiveView={setActiveView}
              countriesCount={countryCount}
              usStatesCount={usStateCount}
            />
          </div>
          
          {/* Map and Details View */}
          <div className={`${activeView === 'map' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex flex-col gap-4 sm:gap-10">
              {/* Details Section */}
              <div className={`transition-all duration-300 ease-in-out overflow-hidden
                ${isDetailsVisible ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {selectedPlace && (
                  <PlaceDetails 
                    place={selectedPlace} 
                    onClose={handleCloseDetails}
                  />
                )}
              </div>
              
              {/* Map Section */}
              <div className="h-[400px] sm:h-[500px] rounded-xl overflow-hidden shadow-lg
                           transform transition-all duration-500 hover:shadow-2xl">
                <MapContainer 
                  center={[40.443394552756146, -79.94169118980099]} 
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                  ref={(map) => {
                    if (map) {
                      handleMapReady(map);
                      map.on('load', () => setIsMapReady(true));
                      // Check if already loaded (e.g., when created visible)
                      if (map._loaded) setIsMapReady(true);
                    }
                  }}
                  preferCanvas={true}
                  updateWhenZooming={false}
                  updateWhenIdle={true}
                  zoomDelta={1}
                  zoomSnap={1}
                >
                  <TileLayer 
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxNativeZoom={18}
                    maxZoom={18}
                  />
                  {places.map(place => (
                    <Marker 
                      key={place.id}
                      position={[place.lat, place.lng]}
                      icon={selectedPlace && selectedPlace.id === place.id 
                        ? TIER_ICONS[getBaseTier(place.tier)].selected 
                        : TIER_ICONS[getBaseTier(place.tier)].default}
                      eventHandlers={{
                        click: () => handlePlaceSelect(place),
                      }}
                    >
                      <Popup>
                        <div className="font-medium">{place.name}</div>
                        <div className="text-sm text-gray-600">Tier {place.tier}</div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PhotoGrid
        places={places}
        onPlaceSelect={handlePlaceSelect}
        isOpen={isPhotoGridOpen}
        onClose={() => setIsPhotoGridOpen(false)}
      />
    </div>
  );
};

export default App;