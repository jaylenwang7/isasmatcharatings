import { useEffect, useMemo, useRef, useState } from 'react';
import { AttributionControl, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { countCities, sortPlaces } from '../lib/places';
import { FitAllIcon, MinusIcon, PlusIcon } from './Icons';
import './MatchaMap.css';

// The map loads in its own chunk (see React.lazy in App.js), so Leaflet doesn't slow the first paint

const WORLD = L.latLngBounds([-85, -180], [85, 180]);
const MAX_ZOOM = 18;
// Pins closer together than this, in pixels, merge into one bubble
const CLUSTER_RADIUS = 40;
// Zoomed out past this, every marker names its city; zoomed in to this, pins name their place
const CITY_ZOOM = 9;
const NAME_ZOOM = 16;
const NAME_LENGTH = 24;
// Extra room at the sides when fitting pins in view, since city labels stick out past their points
const FIT_OPTIONS = { padding: [110, 56], maxZoom: 14 };
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// homePlaces, when given, is where the map opens (Isa's home city) instead of fitting every pin
export default function MatchaMap({ places, homePlaces, selected, active, coverFraction, onSelect, onBackgroundClick }) {
  return (
    <MapContainer
      className="map"
      bounds={boundsOf(homePlaces || []) || boundsOf(places) || WORLD}
      boundsOptions={FIT_OPTIONS}
      maxBounds={WORLD}
      maxBoundsViscosity={1}
      maxZoom={MAX_ZOOM}
      zoomSnap={0.25}
      zoomControl={false}
      attributionControl={false}
    >
      {/* Standard OpenStreetMap tiles, softened in MatchaMap.css so the pins stand out */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        noWrap
        bounds={WORLD}
        maxZoom={MAX_ZOOM}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapControls places={places} selected={selected} />
      <AttributionControl position="bottomleft" prefix={false} />
      <KeepWorldFilled />
      <FitToPlaces places={places} homePlaces={homePlaces} active={active} hasSelection={!!selected} />
      <FollowSelection selected={selected} active={active} coverFraction={coverFraction} />
      <BackgroundClicks onClick={onBackgroundClick} />
      <PlaceMarkers places={places} selected={selected} onSelect={onSelect} />
    </MapContainer>
  );
}

function boundsOf(places) {
  return places.length ? L.latLngBounds(places.map((place) => [place.lat, place.lng])) : null;
}

// Never zoom out past one world's width, so the map doesn't repeat (without its pins) to the sides,
// and refit whenever the map's box changes size (switching views, rotating a phone)
function KeepWorldFilled() {
  const map = useMap();
  useEffect(() => {
    const update = () => {
      const width = map.getSize().x;
      if (width) map.setMinZoom(Math.log2(width / 256));
    };
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      update();
    });
    observer.observe(map.getContainer());
    update();
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// Open on the home city, then show every pin whenever the filters change
function FitToPlaces({ places, homePlaces, active, hasSelection }) {
  const map = useMap();
  // The set of places last fitted, so each set is fitted once (React runs effects twice in development)
  const fittedKey = useRef(null);
  const key = places.map((place) => place.id).join(',');
  useEffect(() => {
    if (!active || hasSelection || fittedKey.current === key) return;
    const opening = fittedKey.current === null;
    const bounds = boundsOf(opening && homePlaces?.length ? homePlaces : places);
    if (!bounds) return;
    fittedKey.current = key;
    map.invalidateSize();
    map.fitBounds(bounds, { ...FIT_OPTIONS, animate: !opening && !prefersReducedMotion() });
    // Only refit for a new set of places, not when a review closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, active]);
  return null;
}

// Fly to the open review, keeping its pin in the part of the map the note doesn't cover
function FollowSelection({ selected, active, coverFraction }) {
  const map = useMap();
  useEffect(() => {
    if (!selected || !active) return;
    map.invalidateSize();
    const size = map.getSize();
    if (!size.x) return;
    // Close enough that neighbors across the street get their own pins
    const zoom = Math.max(map.getZoom(), 15.5);
    const pin = map.project([selected.lat, selected.lng], zoom);
    const center = map.unproject(pin.add([0, (size.y * coverFraction) / 2]), zoom);
    map.flyTo(center, zoom, { duration: prefersReducedMotion() ? 0 : 0.9 });
  }, [map, selected, active, coverFraction]);
  return null;
}

// Zoom buttons, plus one to step back and see every pin
function MapControls({ places, selected }) {
  const map = useMap();
  const ref = useRef(null);
  useEffect(() => {
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);

  // With a review open, zoom around its pin so it stays in view above the note
  const zoomBy = (delta) => {
    if (selected) map.setZoomAround([selected.lat, selected.lng], map.getZoom() + delta);
    else map.setZoom(map.getZoom() + delta);
  };

  const showAll = () => {
    const bounds = boundsOf(places);
    if (bounds) map.flyToBounds(bounds, { ...FIT_OPTIONS, duration: prefersReducedMotion() ? 0 : 0.8 });
  };

  return (
    <div className="map-controls" ref={ref}>
      <div className="map-controls__group">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">
          <PlusIcon size={18} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          <MinusIcon size={18} />
        </button>
      </div>
      <button type="button" className="map-controls__all" onClick={showAll} aria-label="Show every review" title="Show every review">
        <FitAllIcon size={18} />
      </button>
    </div>
  );
}

function BackgroundClicks({ onClick }) {
  useMapEvents({ click: () => onClick() });
  return null;
}

function PlaceMarkers({ places, selected, onSelect }) {
  const map = useMap();
  // Read the zoom from the map on every render; the state only asks React to re-render when it
  // changes. The effect catches zooms that happened before this registered its handler
  const [, setZoomed] = useState(0);
  const handlers = useMemo(() => ({ zoomend: () => setZoomed((count) => count + 1) }), []);
  useMapEvents(handlers);
  useEffect(() => setZoomed((count) => count + 1), []);
  const zoom = map.getZoom();

  // The open review always gets its own pin, outside any bubble
  const clusters = useMemo(() => {
    const nearby = clusterPlaces(map, places.filter((place) => place !== selected), zoom);
    return zoom < CITY_ZOOM ? mergeOverlappingLabels(map, nearby, zoom) : nearby;
  }, [map, places, selected, zoom]);

  return (
    <>
      {clusters.map((cluster) =>
        cluster.places.length === 1 && zoom >= CITY_ZOOM ? (
          <PlacePin key={cluster.places[0].slug} place={cluster.places[0]} showName={zoom >= NAME_ZOOM} onSelect={onSelect} />
        ) : (
          <ClusterBubble key={cluster.places.map((place) => place.slug).join()} cluster={cluster} zoom={zoom} onSelect={onSelect} />
        )
      )}
      {selected && <PlacePin place={selected} selected showName onSelect={onSelect} />}
    </>
  );
}

// Greedy clustering in screen space: each place joins the first bubble within reach. Places
// arrive best tier first, so a bubble's first place is its best one
function clusterPlaces(map, places, zoom) {
  const clusters = [];
  places.forEach((place) => {
    const point = map.project([place.lat, place.lng], zoom);
    const near = clusters.find((cluster) => cluster.point.distanceTo(point) < CLUSTER_RADIUS);
    if (near) near.places.push(place);
    else clusters.push({ point, places: [place] });
  });
  return clusters.map(({ places }) => withPosition(places));
}

const withPosition = (places) => ({
  places,
  position: [average(places.map((place) => place.lat)), average(places.map((place) => place.lng))],
});

// Zoomed out, bubbles carry city names and grow wide, so merge any whose labels would overlap
function mergeOverlappingLabels(map, clusters, zoom) {
  const box = (cluster) => {
    const { x, y } = map.project(cluster.position, zoom);
    // Roughly the bubble's size: a 22px count, padding, and about 7px per character of label
    const halfWidth = (40 + 7 * cityLabel(cluster.places).length) / 2 + 4;
    return { left: x - halfWidth, right: x + halfWidth, top: y - 19, bottom: y + 19 };
  };
  const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  const merged = [...clusters];
  for (let i = 0; i < merged.length; i++) {
    for (let j = i + 1; j < merged.length; j++) {
      if (overlap(box(merged[i]), box(merged[j]))) {
        merged[i] = withPosition(sortPlaces([...merged[i].places, ...merged[j].places]));
        merged.splice(j, 1);
        // The merged bubble is wider, so check it against everything again
        j = i;
      }
    }
  }
  return merged;
}

const average = (numbers) => numbers.reduce((sum, n) => sum + n, 0) / numbers.length;

function PlacePin({ place, selected = false, showName = false, onSelect }) {
  const icon = useMemo(() => pinIcon(place, { selected, showName }), [place, selected, showName]);
  return (
    <Marker
      position={[place.lat, place.lng]}
      icon={icon}
      title={`${place.name}, ${place.grade} tier`}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{ click: () => onSelect(place) }}
    />
  );
}

function ClusterBubble({ cluster, zoom, onSelect }) {
  const map = useMap();
  const { places, position } = cluster;
  const bounds = boundsOf(places);
  // Places at the same address can't be pulled apart by zooming, so list them instead
  const inseparable = places.length > 1 && map.getBoundsZoom(bounds) >= MAX_ZOOM;
  const icon = useMemo(() => bubbleIcon(places, zoom < CITY_ZOOM), [places, zoom]);

  return (
    <Marker
      position={position}
      icon={icon}
      title={places.length > 1 ? `${places.length} reviews` : `${places[0].name}, ${places[0].grade} tier`}
      eventHandlers={{
        click: () => {
          if (places.length === 1) onSelect(places[0]);
          else if (!inseparable) map.flyToBounds(bounds, { padding: [64, 64], maxZoom: 16, duration: 0.7 });
        },
      }}
    >
      {inseparable && (
        <Popup className="map-popup" closeButton={false}>
          <ul>
            {places.map((place) => (
              <li key={place.slug}>
                <button type="button" data-tier={place.tier} onClick={() => onSelect(place)}>
                  <span className="map-popup__tier">{place.grade}</span> {place.name}
                </button>
              </li>
            ))}
          </ul>
        </Popup>
      )}
    </Marker>
  );
}

const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const truncate = (text, length) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

// Pins and bubbles are sized by CSS and centered on their point with a transform, so no iconSize
// The same pen stroke as PenUnderline, for marker HTML
const PEN_UNDERLINE =
  '<svg class="pen-mark pin__underline" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">' +
  '<path pathLength="1" vector-effect="non-scaling-stroke" d="M3 7c22-3 44-4 66-3s34 2 48-1"/></svg>';

// A pin shows the grade; a plus grade ("A+") stretches the circle into a pill
function pinIcon(place, { selected, showName }) {
  const classes = ['pin', place.plus && 'pin--plus', selected && 'pin--selected'].filter(Boolean).join(' ');
  const name = showName
    ? `<span class="pin__name${selected ? ' pin__name--selected' : ''}">${escapeHtml(truncate(place.name, NAME_LENGTH))}${
        selected ? PEN_UNDERLINE : ''
      }</span>`
    : '';
  return L.divIcon({
    className: 'map-marker',
    iconSize: null,
    html: `<span class="${classes}" data-tier="${place.tier}">${place.grade}</span>${name}`,
  });
}

// The city with the most of these reviews, noting when there are others too
function cityLabel(places) {
  const cities = countCities(places);
  if (!cities.length) return '';
  return cities.length > 1 ? `${cities[0].name} & more` : cities[0].name;
}

// A bubble counts the reviews it holds. Zoomed out, it also names their city, and a lone
// review shows its tier instead of a count of one
function bubbleIcon(places, nameCity) {
  const label = nameCity ? cityLabel(places) : '';
  const lead =
    places.length === 1
      ? `<b class="bubble__tier">${places[0].grade}</b>`
      : `<b class="bubble__count">${places.length}</b>`;
  return L.divIcon({
    className: 'map-marker',
    iconSize: null,
    html: `<span class="bubble${label ? '' : ' bubble--bare'}" data-tier="${places[0].tier}">${lead}${
      label ? `<span class="bubble__label">${escapeHtml(label)}</span>` : ''
    }</span>`,
  });
}
