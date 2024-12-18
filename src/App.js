import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Camera, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in production
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Create custom icons for each tier
const createTierIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 25px;
      height: 25px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
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
const TIER_ICONS = Object.fromEntries(
  Object.entries(TIERS).map(([tier, config]) => [
    tier,
    createTierIcon(config.markerColor)
  ])
);

const PlaceImage = ({ imagePath, name, size = "normal" }) => {
  // Helper component to handle image display with fallback
  const sizeClasses = {
    small: "w-10 h-10",
    normal: "h-56",
    large: "max-h-[600px]"
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

  // Filter out places without images but keep places with imagePath: null to show placeholder
  const validPlaces = places.filter(place => place.imagePath !== undefined);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1001] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-white">Photo Gallery</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {validPlaces.map((place) => (
            <div
              key={place.id}
              className="group relative bg-white rounded-xl overflow-hidden shadow-lg 
                transform transition-all duration-300 hover:scale-105 cursor-pointer"
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent 
                opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="font-semibold text-lg">{place.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 rounded-full text-sm 
                      ${TIERS[place.tier].color} ${TIERS[place.tier].textColor}`}>
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


const TierList = ({ places, onPlaceSelect }) => {
  const [expandedTier, setExpandedTier] = useState(null);
  
  return (
    <div className="space-y-6">
      {Object.keys(TIERS).map(tier => (
        <div key={tier} className="relative transform transition-all duration-200 hover:scale-[1.02]">
          <div 
            className={`absolute -top-2 left-0 right-0 transform -translate-y-full 
              bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-lg z-10 transition-all duration-300
              ${expandedTier === tier ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
          >
            <p className="text-gray-700 leading-relaxed">{TIERS[tier].description}</p>
          </div>
          
          <div 
            className={`rounded-xl p-5 shadow-md hover:shadow-xl transition-shadow duration-300 
              border-l-4 ${TIERS[tier].borderColor} bg-gradient-to-br from-white to-gray-50`}
            onClick={() => setExpandedTier(expandedTier === tier ? null : tier)}
            onMouseLeave={() => setExpandedTier(null)}
          >
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 flex items-center justify-center text-3xl font-bold 
                bg-gradient-to-br ${TIERS[tier].gradientFrom} ${TIERS[tier].gradientTo} 
                rounded-lg shadow-inner text-white transform transition-transform duration-200 
                hover:scale-110`}>
                {tier}
              </div>
              <div className="flex flex-wrap gap-3 flex-1">
                {places.filter(place => place.tier === tier).map(place => (
                  <div 
                    key={place.id}
                    className={`relative group p-3 rounded-lg cursor-pointer 
                      ${TIERS[tier].color} transform transition-all duration-200 
                      hover:scale-105 hover:shadow-md`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaceSelect(place);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden shadow-inner">
                        <PlaceImage imagePath={place.imagePath} name={place.name} size="small" />
                      </div>
                      <span className="font-medium">{place.name}</span>
                    </div>
                  </div>
                ))}
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
  
  const tierStyle = TIERS[place.tier];
  
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
            <p className="text-gray-700 leading-relaxed mt-1">{place.notes}</p>
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
  const [allPlaces, setAllPlaces] = useState([]); // Store all places separately

  useEffect(() => {
    setLoading(true);
    fetch(`${getBasePath()}/data/places.json`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Data is not in the expected format');
        setAllPlaces(data); // Store all places
        setPlaces(data);    // Initial places display
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

  // Filter places when toggle changes
  useEffect(() => {
    if (showPittsburghOnly) {
      // Define Pittsburgh's approximate boundaries
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
      
      // Recenter map on Pittsburgh
      if (mapRef) {
        mapRef.flyTo([40.4406, -79.9959], 12);
      }
    } else {
      setPlaces(allPlaces);
    }
  }, [showPittsburghOnly, allPlaces, mapRef]);

  const handlePlaceSelect = (place) => {
    setIsDetailsVisible(false);
    setTimeout(() => {
      setSelectedPlace(place);
      setIsDetailsVisible(true);
      if (mapRef) {
        mapRef.flyTo([place.lat, place.lng], 15, {
          duration: 1.5,
          easeLinearity: 0.25
        });
      }
    }, 300);
  };

  const handleCloseDetails = () => {
    setIsDetailsVisible(false);
    setTimeout(() => {
      setSelectedPlace(null);
    }, 300);
  };

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
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-[1000]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                Isa's Matcha Tier List 
                <span className="text-3xl transform hover:scale-125 transition-transform duration-300 cursor-default">
                  🍵
                </span>
              </h1>
              <p className="mt-3 text-gray-600 leading-relaxed max-w-2xl">
                This is Isa's definitive matcha tier list! Isa has visited all these places and 
                rated them based on their matcha quality and overall experience.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setShowPittsburghOnly(!showPittsburghOnly)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md ${
                  showPittsburghOnly 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                }`}
              >
                {showPittsburghOnly ? 'Show All' : 'Pittsburgh Only'}
              </button>
              <button
                onClick={() => setIsPhotoGridOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 
                  text-green-800 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
              >
                <Camera size={20} />
                <span>View Gallery</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="z-[900]">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
              Tier List 
              <span className="text-gray-500 font-normal">({places.length} places)</span>
            </h2>
            <TierList 
              places={places} 
              onPlaceSelect={handlePlaceSelect}
            />
          </div>
          
          <div className="space-y-10">
            <div className="relative z-[900] transition-all duration-300 ease-in-out"
                 style={{ 
                   opacity: isDetailsVisible ? 1 : 0,
                   transform: isDetailsVisible ? 'translateY(0)' : 'translateY(-20px)'
                 }}>
              {selectedPlace && (
                <PlaceDetails 
                  place={selectedPlace} 
                  onClose={handleCloseDetails}
                />
              )}
            </div>
            
            <div className="h-[500px] rounded-xl overflow-hidden shadow-lg relative z-[800]
                          transform transition-all duration-500 hover:shadow-2xl">
              <MapContainer 
                center={[40.443394552756146, -79.94169118980099]} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
                ref={setMapRef}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {places.map(place => (
                  <Marker 
                    key={place.id}
                    position={[place.lat, place.lng]}
                    icon={TIER_ICONS[place.tier]}
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