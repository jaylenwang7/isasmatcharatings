// App.js
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

const TierList = ({ places, onPlaceSelect }) => {
  const tiers = ['S', 'A', 'B', 'C', 'D', 'F'];
  
  return (
    <div className="space-y-4">
      {tiers.map(tier => (
        <div key={tier} className="bg-white rounded-lg p-4 shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center text-2xl font-bold bg-green-100 rounded">
              {tier}
            </div>
            <div className="flex flex-wrap gap-2">
              {places.filter(place => place.tier === tier).map(place => (
                <div 
                  key={place.id}
                  className="p-2 bg-green-50 rounded cursor-pointer hover:bg-green-100"
                  onClick={() => onPlaceSelect(place)}
                >
                  {place.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const PlaceDetails = ({ place }) => {
  if (!place) return null;
  
  return (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      <img 
        src={`/images/${place.imagePath}`} 
        alt={place.name}
        className="w-full h-48 object-cover rounded-lg mb-4"
      />
      <h2 className="text-2xl font-bold mb-2">{place.name}</h2>
      <div className="bg-green-100 inline-block px-3 py-1 rounded-full mb-4">
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
    
    // Load places data
    useEffect(() => {
      setLoading(true);
      fetch('/data/places.json')
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (!Array.isArray(data)) {
            throw new Error('Data is not in the expected format');
          }
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
            <h1 className="text-3xl font-bold text-gray-900">Matcha Adventures 🍵</h1>
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
              {selectedPlace && <PlaceDetails place={selectedPlace} />}
              
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