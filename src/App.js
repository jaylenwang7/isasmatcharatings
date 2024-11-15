import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in production
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

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
    description: 'Exceptional matcha spots that I absolutely love and highly recommend!'
  },
  A: {
    color: 'bg-green-100 hover:bg-green-200',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    gradientFrom: 'from-green-500',
    gradientTo: 'to-green-300',
    description: 'Great places with consistently high-quality matcha'
  },
  B: {
    color: 'bg-blue-100 hover:bg-blue-200',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-300',
    description: 'Solid choices for your matcha fix'
  },
  C: {
    color: 'bg-yellow-100 hover:bg-yellow-200',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    gradientFrom: 'from-yellow-500',
    gradientTo: 'to-yellow-300',
    description: 'Decent matcha, but nothing special'
  },
  D: {
    color: 'bg-orange-100 hover:bg-orange-200',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-300',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-orange-300',
    description: 'Below average - would not recommend'
  },
  F: {
    color: 'bg-red-100 hover:bg-red-200',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-red-300',
    description: 'Disappointing experiences - avoid these places'
  }
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
                      {place.imagePath && (
                        <div 
                          className="w-10 h-10 rounded-full overflow-hidden bg-center bg-cover 
                            shadow-inner transition-opacity duration-200 opacity-75 group-hover:opacity-100"
                          style={{
                            backgroundImage: `url(${getBasePath()}/${place.imagePath})`
                          }}
                        />
                      )}
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
    <div className="bg-white rounded-xl p-6 shadow-lg relative transform transition-all duration-300 hover:shadow-xl">
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
          <button
            onClick={() => setIsImageExpanded(!isImageExpanded)}
            className="absolute bottom-4 right-4 bg-white/90 hover:bg-white px-4 py-2 
              rounded-full text-sm text-gray-700 shadow-md hover:shadow-lg 
              transition-all duration-200 backdrop-blur-sm"
          >
            {isImageExpanded ? 'Show less' : 'Show more'}
          </button>
        </div>
      </div>
      
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{place.name}</h2>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    setLoading(true);
    fetch(`${getBasePath()}/data/places.json`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Data is not in the expected format');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="text-xl font-semibold">Loading places...</div>
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
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
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
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="z-20"> {/* Increased z-index for tier list */}
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
              Tier List 
              <span className="text-gray-500 font-normal">({places.length} places)</span>
            </h2>
            <TierList 
              places={places} 
              onPlaceSelect={setSelectedPlace}
            />
          </div>
          
          <div className="space-y-10">
            <div className="relative z-20">
              {selectedPlace && (
                <PlaceDetails 
                  place={selectedPlace} 
                  onClose={() => setSelectedPlace(null)}
                />
              )}
            </div>
            
            <div className="h-[500px] rounded-xl overflow-hidden shadow-lg z-10"> {/* Lowered z-index for map */}
              <MapContainer 
                center={[40.443394552756146, -79.94169118980099]} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {places.map(place => (
                  <Marker 
                    key={place.id}
                    position={[place.lat, place.lng]}
                    eventHandlers={{
                      click: () => setSelectedPlace(place),
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
    </div>
  );
};

export default App;