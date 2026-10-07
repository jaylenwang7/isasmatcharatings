import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AttributionControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HOME_CITY } from '../lib/places';
import { TIERS } from '../tiers';
import { FitAllIcon, MinusIcon, PlusIcon } from './Icons';
import './MatchaMap.css';

// The map loads in its own chunk (see React.lazy in App.js), so Leaflet doesn't slow the first paint

const WORLD = L.latLngBounds([-85, -180], [85, 180]);
const MAX_ZOOM = 18;

// Every review is a bead in its tier's color, at every zoom. Where beads would overlap they pack
// side by side, best tier first, so each city becomes a cluster you can count. The bead grows with
// the zoom and becomes a lettered pin at street level; each scale's size is in pixels
const SCALES = [
  { name: 'world', below: 4, size: 7 },
  { name: 'region', below: 10, size: 8 },
  { name: 'city', below: 12, size: 12 },
  { name: 'street', below: Infinity, size: 26 },
];
// The white ring around each bead; packed beads' rings meet, so a cluster sits on one white backing
const RING = 2;
// Below this zoom, city names label the clusters. Clicking a name picks the city; clicking a bead
// always opens its review, the one its hover card names
const CITY_LABELS_BELOW = 12;
// At this zoom, pins name their place
const NAME_ZOOM = 16;
const NAME_LENGTH = 24;
// Extra room at the sides when fitting pins in view, since city labels stick out past their points
const FIT_OPTIONS = { padding: [110, 56], maxZoom: 14 };
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// places is every review, so the map can always show them all; visibleIds holds the ones the
// filters and search let through, and the rest turn gray. Clicking a city on the map sets the city
// filter (onCityChange). homePlaces, when given, is where the map opens instead of fitting every
// review. litSlug is the review hovered in the list, which lights up its bead
export default function MatchaMap({
  places,
  visibleIds,
  homePlaces,
  selected,
  active,
  coverFraction,
  city,
  onCityChange,
  litSlug,
  onSelect,
  onBackgroundClick,
}) {
  const visible = useMemo(() => places.filter((place) => visibleIds.has(place.slug)), [places, visibleIds]);
  return (
    <MapContainer
      className="map"
      bounds={boundsOf(homePlaces || []) || boundsOf(visible) || WORLD}
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
      <MapControls places={visible} selected={selected} coverFraction={coverFraction} city={city} onCityChange={onCityChange} />
      <AttributionControl position="bottomleft" prefix={false} />
      <KeepWorldFilled />
      <FitToPlaces places={visible} homePlaces={homePlaces} active={active} hasSelection={!!selected} />
      <FollowSelection selected={selected} active={active} coverFraction={coverFraction} />
      <BackgroundClicks onClick={onBackgroundClick} />
      <Beads
        places={places}
        visibleIds={visibleIds}
        selected={selected}
        city={city}
        litSlug={litSlug}
        coverFraction={coverFraction}
        onCityChange={onCityChange}
        onSelect={onSelect}
      />
      {selected && <SelectedPin place={selected} onSelect={onSelect} />}
      <HoverCard places={places} city={city} />
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

// Zoom buttons, plus one to step back and see every review (which also clears the city filter)
function MapControls({ places, selected, coverFraction, city, onCityChange }) {
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

  // Fit every pin into the part of the map an open note doesn't cover
  const showAll = () => {
    // Clearing the city lets more reviews through, and the map refits to them (FitToPlaces)
    if (city) return onCityChange(null);
    const bounds = boundsOf(places);
    if (!bounds) return;
    const [x, y] = FIT_OPTIONS.padding;
    map.flyToBounds(bounds, {
      maxZoom: FIT_OPTIONS.maxZoom,
      paddingTopLeft: [x, y],
      paddingBottomRight: [x, y + map.getSize().y * coverFraction],
      duration: prefersReducedMotion() ? 0 : 0.8,
    });
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

// Every review except the open one as a bead, packed by city, with city names placed beside the
// clusters while zoomed out. Layout runs after each zoom or move and changes the markers' existing
// elements (CSS variables and classes), never their icons, so nothing under the pointer is replaced
function Beads({ places, visibleIds, selected, city, litSlug, coverFraction, onCityChange, onSelect }) {
  const map = useMap();
  const markers = useRef(new Map());
  const labelMarkers = useRef(new Map());
  const [labels, setLabels] = useState([]);

  const beads = useMemo(() => places.filter((place) => place !== selected), [places, selected]);
  const cities = useMemo(() => groupByCity(places), [places]);
  // Pack city by city, biggest first and best tier first within each, so every city stays one
  // compact cluster instead of interleaving with its neighbors when zoomed out
  const packingOrder = useMemo(
    () => cities.flatMap((group) => group.places).filter((place) => place !== selected),
    [cities, selected]
  );

  // A city with several reviews becomes the city filter; one review just opens
  const pickCity = useCallback(
    (group) => {
      if (group.places.length === 1) return onSelect(group.places[0]);
      if (group.name === city) map.flyToBounds(boundsOf(group.places), { ...FIT_OPTIONS, duration: prefersReducedMotion() ? 0 : 0.8 });
      else onCityChange(group.name);
    },
    [map, city, onCityChange, onSelect]
  );

  const layout = useCallback(() => {
    const zoom = map.getZoom();
    const scale = SCALES.find((candidate) => zoom < candidate.below);
    const container = map.getContainer();
    container.dataset.scale = scale.name;
    container.dataset.names = String(zoom >= NAME_ZOOM);

    const positions = packBeads(map, packingOrder, scale, selected);
    positions.forEach(({ dx, dy, crowded }, slug) => {
      const element = markers.current.get(slug)?.getElement()?.firstElementChild;
      if (!element) return;
      element.style.setProperty('--dx', `${dx}px`);
      element.style.setProperty('--dy', `${dy}px`);
      element.classList.toggle('bead--crowded', crowded);
    });
    setLabels(zoom < CITY_LABELS_BELOW ? placeCityLabels(map, cities, positions, scale, coverFraction) : []);
  }, [map, packingOrder, selected, cities, coverFraction]);

  // Lay out again after every zoom, move, or resize, and once the label font has loaded (labels
  // are measured in it). The handler reads the latest layout through a ref, so it stays registered
  const latestLayout = useRef(layout);
  latestLayout.current = layout;
  const handlers = useMemo(() => ({ zoomend: () => latestLayout.current(), moveend: () => latestLayout.current() }), []);
  useMapEvents(handlers);
  useEffect(() => {
    layout();
  }, [layout]);
  useEffect(() => {
    document.fonts?.ready.then(() => latestLayout.current());
  }, []);

  // Filtered-out reviews turn gray, and the review hovered in the list lights up
  useEffect(() => {
    markers.current.forEach((marker, slug) => {
      const ghost = !visibleIds.has(slug);
      const lit = slug === litSlug;
      const element = marker.getElement()?.firstElementChild;
      element?.classList.toggle('bead--ghost', ghost);
      element?.classList.toggle('bead--lit', lit);
      marker.setZIndexOffset(lit ? 900 : ghost ? -500 : 0);
    });
  }, [visibleIds, litSlug, beads]);

  useEffect(() => {
    labelMarkers.current.forEach((marker, name) => {
      const group = cities.find((candidate) => candidate.name === name);
      const element = marker.getElement()?.firstElementChild;
      element?.classList.toggle('city-label--on', name === city);
      element?.classList.toggle('city-label--ghost', !group?.places.some((place) => visibleIds.has(place.slug)));
    });
  }, [labels, cities, city, visibleIds]);

  const register = (registry, key) => (marker) => {
    if (marker) registry.current.set(key, marker);
    else registry.current.delete(key);
  };

  return (
    <>
      {beads.map((place) => (
        <Marker
          key={place.slug}
          ref={register(markers, place.slug)}
          position={[place.lat, place.lng]}
          icon={beadIcon(place)}
          keyboard={false}
          eventHandlers={{ click: () => onSelect(place) }}
        />
      ))}
      {labels.map(({ group, position, showCount }) => (
        <Marker
          key={group.name}
          ref={register(labelMarkers, group.name)}
          position={position}
          icon={cityLabelIcon(group, showCount)}
          zIndexOffset={2000}
          eventHandlers={{ click: () => pickCity(group) }}
        />
      ))}
    </>
  );
}

// Reviews grouped by city, most reviews first
function groupByCity(places) {
  const groups = new Map();
  places.forEach((place) => {
    const name = place.city || place.name;
    if (!groups.has(name)) groups.set(name, { name, places: [] });
    groups.get(name).places.push(place);
  });
  return [...groups.values()].sort((a, b) => b.places.length - a.places.length || a.name.localeCompare(b.name));
}

// Find each bead a spot near its true position where it doesn't overlap another, spiraling
// outward from the true point. Earlier places keep their spots, so callers pass the order that
// matters. Returns each bead's container position and its offset from its true point, by slug
function packBeads(map, places, scale, selected) {
  const step = scale.size + RING + (scale.name === 'street' ? 2 : 0);
  const placed = [];
  // The open review's big pin is in the way too
  if (selected) placed.push({ ...map.latLngToContainerPoint([selected.lat, selected.lng]), clearance: 24 + step / 2 });
  const free = (x, y) => placed.every((other) => (other.x - x) ** 2 + (other.y - y) ** 2 >= (other.clearance - 0.01) ** 2);

  const positions = new Map();
  places.forEach((place) => {
    const point = map.latLngToContainerPoint([place.lat, place.lng]);
    let spot = free(point.x, point.y) ? point : null;
    for (let ring = 1; !spot && ring < 400; ring++) {
      const radius = ring * step * 0.2;
      const count = Math.max(6, Math.ceil((2 * Math.PI * radius) / (step * 0.2)));
      for (let i = 0; i < count && !spot; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
        const x = point.x + radius * Math.cos(angle);
        const y = point.y + radius * Math.sin(angle);
        if (free(x, y)) spot = { x, y };
      }
    }
    spot = spot || point;
    placed.push({ x: spot.x, y: spot.y, clearance: step });
    const dx = spot.x - point.x;
    const dy = spot.y - point.y;
    // A pin pushed far from its place would point at the wrong building, so it stays a bead
    // until there's room
    positions.set(place.slug, { x: spot.x, y: spot.y, dx, dy, crowded: scale.name === 'street' && Math.hypot(dx, dy) > step * 1.2 });
  });
  return positions;
}

// Put each city's name beside its beads, biggest city first. A label must fit inside the map and
// avoid every bead, the controls, the attribution, and an open note. It should sit nearer its own
// city's beads than any other city's, so it can't seem to name a neighbor. When cities run
// together (zoomed far out), the biggest city in each run-together group may instead label the
// group from its edge. Failing all that, a label is left out; its beads stay
function placeCityLabels(map, cities, positions, scale, coverFraction) {
  const { x: width, y: height } = map.getSize();
  const step = scale.size + RING;
  const half = step / 2;
  const box = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h });
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const fits = (b) => b.left >= 6 && b.top >= 6 && b.right <= width - 6 && b.bottom <= height - 6;
  const distance = (b, point) =>
    Math.hypot(Math.max(b.left - point.x, 0, point.x - b.right), Math.max(b.top - point.y, 0, point.y - b.bottom));
  const nearest = (b, beads) => Math.min(Infinity, ...beads.map((bead) => distance(b, bead)));
  const boundsOfBeads = (beads) => ({
    left: Math.min(...beads.map((b) => b.x)) - half,
    right: Math.max(...beads.map((b) => b.x)) + half,
    top: Math.min(...beads.map((b) => b.y)) - half,
    bottom: Math.max(...beads.map((b) => b.y)) + half,
  });

  const beads = [...positions.values()];
  const taken = [
    ...beads.map(({ x, y }) => box(x - half, y - half, step, step)),
    box(width - 60, 0, 60, 140), // zoom and show-everything buttons
    box(0, height - 22, 190, 22), // attribution
  ];
  if (coverFraction) taken.push(box(0, height * (1 - coverFraction) - 16, width, height * coverFraction + 16));

  // Beads that touch form one group (union-find)
  const parent = beads.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  beads.forEach((a, i) =>
    beads.forEach((b, j) => {
      if (j > i && Math.hypot(a.x - b.x, a.y - b.y) <= step * 1.08) parent[find(i)] = find(j);
    })
  );
  const groupOf = new Map(beads.map((bead, i) => [bead, find(i)]));

  // The eight spots around a box, best first: right, left, above, below, then the corners
  const spotsAround = ({ left, right, top, bottom }, w) => {
    const h = 17;
    const gap = 5;
    return [
      box(right + gap, (top + bottom - h) / 2, w, h),
      box(left - gap - w, (top + bottom - h) / 2, w, h),
      box((left + right - w) / 2, top - gap - h, w, h),
      box((left + right - w) / 2, bottom + gap, w, h),
      box(right + 1, top - h + 3, w, h),
      box(right + 1, bottom - 3, w, h),
      box(left - 1 - w, top - h + 3, w, h),
      box(left - 1 - w, bottom - 3, w, h),
    ];
  };

  const claimedGroups = new Set();
  const labels = [];
  cities.forEach((city) => {
    const own = city.places.map((place) => positions.get(place.slug)).filter(Boolean);
    if (!own.length) return;
    const ownSet = new Set(own);
    const others = beads.filter((bead) => !ownSet.has(bead));
    const groups = new Set(own.map((bead) => groupOf.get(bead)));
    const groupBeads = beads.filter((bead) => groups.has(groupOf.get(bead)));
    const sharesGroup = groupBeads.length > own.length;

    const attempts = [
      { around: own, counted: true, ok: (b) => nearest(b, others) > nearest(b, own) + 2 },
      { around: own, counted: false, ok: (b) => nearest(b, others) > nearest(b, own) + 2 },
    ];
    if (sharesGroup && ![...groups].some((id) => claimedGroups.has(id))) {
      // Distances run from bead centers, and a group's edge is ragged, so allow a bead or so of slack
      const besideGroup = (b) => nearest(b, groupBeads) <= half + step + 6;
      attempts.push(
        { around: groupBeads, counted: true, ok: besideGroup, claims: true },
        { around: groupBeads, counted: false, ok: besideGroup, claims: true }
      );
    }
    for (const { around, counted, ok, claims } of attempts) {
      if (counted && city.places.length === 1) continue;
      const spot = spotsAround(boundsOfBeads(around), cityLabelWidth(city, counted)).find(
        (b) => fits(b) && !taken.some((t) => overlaps(b, t)) && ok(b)
      );
      if (!spot) continue;
      taken.push(spot);
      if (claims) groups.forEach((id) => claimedGroups.add(id));
      labels.push({ group: city, showCount: counted, position: map.containerPointToLatLng([spot.left, spot.top]) });
      return;
    }
  });
  return labels;
}

// "Pittsburgh, 17 reviews: 5 A, 7 B, 2 C, 3 D", for screen readers
function describeCity(group) {
  const count = group.places.length;
  const tiers = TIERS.map(({ letter }) => [letter, group.places.filter((place) => place.tier === letter).length])
    .filter(([, n]) => n)
    .map(([letter, n]) => `${n} ${letter}`)
    .join(', ');
  return `${group.name}, ${count} ${count === 1 ? 'review' : 'reviews'}: ${tiers}`;
}

// Measure label text in the page's own fonts, so labels pack tightly without overlapping
const measureContext = document.createElement('canvas').getContext('2d');
function textWidth(text, font) {
  measureContext.font = font;
  return measureContext.measureText(text).width;
}
const cityLabelWidth = (group, showCount) =>
  (group.name === HOME_CITY ? 19 : 0) +
  textWidth(group.name, '700 13px "Zen Kaku Gothic New"') +
  (showCount ? 5 + textWidth(String(group.places.length), '500 11.5px "Zen Kaku Gothic New"') : 0) +
  2;

// Hovering a bead with a mouse shows a small card with its photo, name, city, and grade; hovering or
// focusing a city name shows the city's tiers and photos. One card, driven by listeners on the
// marker pane: it never replaces a marker, and it clears whenever the pointer leaves, the map
// starts moving, or Escape is pressed, so it can't get stuck
const CARD_WIDTH = { place: 212, city: 252 };
// Heights are estimates, used only to decide where a card fits
const CARD_HEIGHT = { place: 76, city: 176 };

function HoverCard({ places, city }) {
  const map = useMap();
  const [card, setCard] = useState(null);
  const bySlug = useMemo(() => new Map(places.map((place) => [place.slug, place])), [places]);
  const byCity = useMemo(() => new Map(groupByCity(places).map((group) => [group.name, group])), [places]);

  useEffect(() => {
    const pane = map.getPane('markerPane');
    const container = map.getContainer();
    const clear = () => setCard(null);
    const relative = (box) => {
      const mapBox = container.getBoundingClientRect();
      return { left: box.left - mapBox.left, right: box.right - mapBox.left, top: box.top - mapBox.top, bottom: box.bottom - mapBox.top };
    };
    // The box around a set of elements, relative to the map
    const around = (elements) =>
      relative(
        elements
          .map((element) => element.getBoundingClientRect())
          .reduce((a, b) => ({
            left: Math.min(a.left, b.left),
            right: Math.max(a.right, b.right),
            top: Math.min(a.top, b.top),
            bottom: Math.max(a.bottom, b.bottom),
          }))
      );

    const show = (element) => {
      if (element.classList.contains('bead')) {
        const place = bySlug.get(element.dataset.slug);
        if (place) setCard({ kind: 'place', place, anchor: around([element]) });
        return;
      }
      const group = byCity.get(element.dataset.city);
      if (!group) return;
      // A city with one review shows that review, since clicking its name opens it
      if (group.places.length === 1) return setCard({ kind: 'place', place: group.places[0], anchor: around([element]) });
      // Keep the card off the city's own beads as well as its name
      const beads = [...pane.querySelectorAll('.bead')].filter((bead) => bead.dataset.city === group.name);
      setCard({ kind: 'city', group, anchor: around([element, ...beads]) });
    };
    const target = (event) => event.target.closest?.('.bead, .city-label') || event.target.querySelector?.('.bead, .city-label');

    const onOver = (event) => {
      const element = target(event);
      if (event.pointerType === 'mouse' && element) show(element);
    };
    const onOut = (event) => {
      const element = target(event);
      if (element && !element.contains(event.relatedTarget)) clear();
    };
    const onFocus = (event) => {
      const element = target(event);
      if (element?.classList.contains('city-label')) show(element);
    };
    const onKeyDown = (event) => event.key === 'Escape' && clear();
    pane.addEventListener('pointerover', onOver);
    pane.addEventListener('pointerout', onOut);
    pane.addEventListener('focusin', onFocus);
    pane.addEventListener('focusout', clear);
    container.addEventListener('pointerleave', clear);
    container.addEventListener('keydown', onKeyDown);
    map.on('movestart zoomstart', clear);
    window.addEventListener('blur', clear);
    return () => {
      pane.removeEventListener('pointerover', onOver);
      pane.removeEventListener('pointerout', onOut);
      pane.removeEventListener('focusin', onFocus);
      pane.removeEventListener('focusout', clear);
      container.removeEventListener('pointerleave', clear);
      container.removeEventListener('keydown', onKeyDown);
      map.off('movestart zoomstart', clear);
      window.removeEventListener('blur', clear);
    };
  }, [map, bySlug, byCity]);

  // A review that's filtered away or opened shouldn't leave its card behind
  useEffect(() => {
    if (card?.kind === 'place' && !bySlug.has(card.place.slug)) setCard(null);
  }, [card, bySlug]);

  if (!card) return null;
  const { x: mapWidth, y: mapHeight } = map.getSize();
  const width = CARD_WIDTH[card.kind];
  const height = CARD_HEIGHT[card.kind];
  const { anchor } = card;
  // A review's card sits above its bead; a city's goes below the city, else above, else beside it
  const fitsAbove = anchor.top - 8 - height >= 6;
  const fitsBelow = anchor.bottom + 8 + height <= mapHeight - 6;
  const order = card.kind === 'place' ? ['above', 'below'] : ['below', 'above'];
  const side = order.find((s) => (s === 'above' ? fitsAbove : fitsBelow)) || 'beside';
  const centerX = (anchor.left + anchor.right) / 2;
  // A card above is pinned by its bottom edge, so it sits just above the anchor whatever its real height
  const style = { width, left: Math.min(Math.max(centerX - width / 2, 8), mapWidth - width - 8) };
  if (side === 'above') style.bottom = mapHeight - anchor.top + 8;
  else if (side === 'below') style.top = anchor.bottom + 8;
  else {
    style.left = anchor.right + 8 + width <= mapWidth - 8 ? anchor.right + 8 : Math.max(8, anchor.left - 8 - width);
    style.top = Math.min(Math.max((anchor.top + anchor.bottom) / 2 - height / 2, 8), mapHeight - height - 8);
  }

  return createPortal(
    card.kind === 'place' ? (
      <PlaceCard place={card.place} style={style} />
    ) : (
      <CityCard group={card.group} selected={card.group.name === city} style={style} />
    ),
    map.getContainer()
  );
}

function PlaceCard({ place, style }) {
  return (
    <div className="peek" data-tier={place.tier} style={style} aria-hidden="true">
      {place.thumb ? <img className="peek__photo" src={place.thumb} alt="" /> : <span className="peek__photo peek__photo--none" />}
      <span className="peek__text">
        <span className="peek__name">{place.name}</span>
        {place.city && <span className="peek__city">{place.city}</span>}
      </span>
      <span className="peek__grade">{place.grade}</span>
    </div>
  );
}

// A city at a glance: how many reviews, how they split across tiers, and the best few photos
function CityCard({ group, selected, style }) {
  const shown = group.places.slice(0, 4);
  const more = group.places.length - shown.length;
  return (
    <div className="city-card" style={style} aria-hidden="true">
      <div className="city-card__head">
        <span className="city-card__name">{group.name}</span>
        <span className="city-card__count">{group.places.length} reviews</span>
      </div>
      <ul className="city-card__tiers">
        {TIERS.map(({ letter }) => {
          const count = group.places.filter((place) => place.tier === letter).length;
          return (
            count > 0 && (
              <li key={letter}>
                <b data-tier={letter}>{letter}</b>
                {count}
              </li>
            )
          );
        })}
      </ul>
      <div className="city-card__photos">
        {shown.map((place) =>
          place.thumb ? (
            <img key={place.slug} src={place.thumb} alt="" />
          ) : (
            <span key={place.slug} className="city-card__no-photo" data-tier={place.tier} />
          )
        )}
        {more > 0 && <span className="city-card__more">+{more}</span>}
      </div>
      <p className="city-card__hint">{selected ? 'Showing these in the list' : 'Click to show them in the list'}</p>
    </div>
  );
}

// The open review: a big pin with its name, underlined in Isa's pen
function SelectedPin({ place, onSelect }) {
  const icon = useMemo(() => pinIcon(place), [place]);
  return (
    <Marker
      position={[place.lat, place.lng]}
      icon={icon}
      title={`${place.name}, ${place.grade} tier`}
      zIndexOffset={1000}
      eventHandlers={{ click: () => onSelect(place) }}
    />
  );
}

const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const truncate = (text, length) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

// Markers are sized by CSS and centered on their point with a transform, so icons have no iconSize.
// The same pen stroke as PenUnderline, for marker HTML
const penUnderline = (className) =>
  `<svg class="pen-mark ${className}" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">` +
  '<path pathLength="1" vector-effect="non-scaling-stroke" d="M3 7c22-3 44-4 66-3s34 2 48-1"/></svg>';

// The open review's pin shows its grade (a plus grade stretches it into a pill) and its name
function pinIcon(place) {
  return L.divIcon({
    className: 'map-marker',
    iconSize: null,
    html:
      `<span class="pin pin--selected${place.plus ? ' pin--plus' : ''}" data-tier="${place.tier}">${place.grade}</span>` +
      `<span class="pin__name pin__name--selected">${escapeHtml(truncate(place.name, NAME_LENGTH))}${penUnderline('pin__underline')}</span>`,
  });
}

// One icon per review, made once: a bead holding its grade and name, which CSS shows at street zoom
const beadIcons = new Map();
function beadIcon(place) {
  const key = `${place.slug}|${place.grade}|${place.name}`;
  if (!beadIcons.has(key)) {
    beadIcons.set(
      key,
      L.divIcon({
        className: 'map-marker',
        iconSize: null,
        html:
          `<span class="bead${place.plus ? ' bead--plus' : ''}" data-tier="${place.tier}" data-slug="${escapeHtml(place.slug)}" data-city="${escapeHtml(place.city || place.name)}">` +
          `<span class="bead__grade">${place.grade}</span>` +
          `<span class="bead__name">${escapeHtml(truncate(place.name, NAME_LENGTH))}</span></span>`,
      })
    );
  }
  return beadIcons.get(key);
}

// City labels sit with their top left corner on their point (see placeCityLabels). Icons are
// cached, and the selected city's pen underline is always there for a class to show
const BRIDGE =
  '<svg class="city-label__bridge" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 16h20M6 7v9M18 7v9M2 9c2 0 3 0 4-2 2 5 10 5 12 0 1 2 2 2 4 2M10 10.6V16M14 10.6V16"/></svg>';
const cityLabelIcons = new Map();
function cityLabelIcon(group, showCount) {
  const html =
    `<span class="city-label" data-city="${escapeHtml(group.name)}">${group.name === HOME_CITY ? BRIDGE : ''}${escapeHtml(group.name)}` +
    `${showCount ? `<span class="city-label__count" aria-hidden="true">${group.places.length}</span>` : ''}` +
    `<span class="visually-hidden">${escapeHtml(describeCity(group).slice(group.name.length))}</span>${penUnderline('city-label__pen')}</span>`;
  if (!cityLabelIcons.has(html)) cityLabelIcons.set(html, L.divIcon({ className: 'map-marker', iconSize: null, html }));
  return cityLabelIcons.get(html);
}
