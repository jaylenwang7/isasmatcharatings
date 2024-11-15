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
    description: 'Exceptional matcha spots that I absolutely love and highly recommend!'
  },
  A: {
    color: 'bg-green-100 hover:bg-green-200',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    description: 'Great places with consistently high-quality matcha'
  },
  B: {
    color: 'bg-blue-100 hover:bg-blue-200',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    description: 'Solid choices for your matcha fix'
  },
  C: {
    color: 'bg-yellow-100 hover:bg-yellow-200',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    description: 'Decent matcha, but nothing special'
  },
  D: {
    color: 'bg-orange-100 hover:bg-orange-200',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-300',
    description: 'Below average - would not recommend'
  },
  F: {
    color: 'bg-red-100 hover:bg-red-200',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    description: 'Disappointing experiences - avoid these places'
  }
};

const TierList = ({ places, onPlaceSelect }) => {
  const [expandedTier, setExpandedTier] = useState(null);
  
  return (
    <div className="space-y-4">
      {Object.keys(TIERS).map(tier => (
        <div key={tier} className="relative">
          {/* Tier description tooltip/expansion */}
          <div 
            className={`absolute -top-2 left-0 right-0 transform -translate-y-full 
              bg-white p-4 rounded-lg shadow-lg z-10 transition-opacity duration-200
              ${expandedTier === tier ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            {TIERS[tier].description}
          </div>
          
          <div 
            className={`rounded-lg p-4 shadow border ${TIERS[tier].borderColor} cursor-pointer`}
            onClick={() => setExpandedTier(expandedTier === tier ? null : tier)}
            onMouseLeave={() => setExpandedTier(null)}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 flex items-center justify-center text-2xl font-bold ${TIERS[tier].color} rounded ${TIERS[tier].textColor}`}>
                {tier}
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                {places.filter(place => place.tier === tier).map(place => (
                  <div 
                    key={place.id}
                    className={`relative group p-2 rounded cursor-pointer ${TIERS[tier].color}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaceSelect(place);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {place.imagePath && (
                        <div 
                          className="w-8 h-8 rounded overflow-hidden bg-center bg-cover opacity-50"
                          style={{
                            backgroundImage: `url(${getBasePath()}/${place.imagePath})`
                          }}
                        />
                      )}
                      <span>{place.name}</span>
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
    <div className="bg-white rounded-lg p-6 shadow-lg relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold p-2 z-10"
        aria-label="Close details"
      >
        ×
      </button>
      
      <div className="relative">
        <img 
          src={`${getBasePath()}/${place.imagePath}`} 
          alt={place.name}
          className={`w-full rounded-lg mb-4 cursor-pointer transition-all duration-300 ${
            isImageExpanded 
              ? 'h-auto object-contain' 
              : 'h-48 object-cover'
          }`}
          onClick={() => setIsImageExpanded(!isImageExpanded)}
        />
        <button
          onClick={() => setIsImageExpanded(!isImageExpanded)}
          className="absolute bottom-6 right-2 bg-white/90 hover:bg-white px-2 py-1 rounded-full text-sm text-gray-700 shadow"
        >
          {isImageExpanded ? 'Show less' : 'Show more'}
        </button>
      </div>
      
      <h2 className="text-2xl font-bold mb-2">{place.name}</h2>
      <div className={`inline-block px-3 py-1 rounded-full mb-4 ${tierStyle.color} ${tierStyle.textColor} font-medium`}>
        Tier {place.tier}
      </div>
      <h3 className="font-semibold mb-2">Ordered:</h3>
      <p className="text-gray-700 mb-4">{place.ordered}</p>
      <h3 className="font-semibold mb-2">Notes:</h3>
      <p className="text-gray-700">{place.notes}</p>
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
    <div className="min-h-screen bg-green-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Isa's Matcha Tier List 🍵</h1>
          <p className="mt-2 text-gray-600">
            My personal matcha journey through the city! Each place is rated based on 
            the quality of matcha, ambiance, and overall experience. These ratings help me 
            remember my favorites and track new places to try.
          </p>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold mb-6">Tier List ({places.length} places)</h2>
            <TierList 
              places={places} 
              onPlaceSelect={setSelectedPlace}
            />
          </div>
          
          <div className="space-y-8">
            {selectedPlace && (
              <PlaceDetails 
                place={selectedPlace} 
                onClose={() => setSelectedPlace(null)}
              />
            )}
            
            <div className="h-[400px] rounded-lg overflow-hidden">
              <MapContainer 
                center={[37.7749, -122.4194]} 
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
                    <Popup>{place.name}</Popup>
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