import { TIER_RANK } from '../tiers';

// Isa's home city: the map opens here, and its city filter gets a little bridge
export const HOME_CITY = 'Pittsburgh';

// Set REACT_APP_DATA_URL to load another copy of the data during development, such as the
// live site's: https://jaylenwang.com/isasmatcharatings/data/places.json
const DATA_URL = process.env.REACT_APP_DATA_URL || `${process.env.PUBLIC_URL}/data/places.json`;

// Photo paths in places.json are relative to the folder above data/
const ASSET_BASE = new URL('..', new URL(DATA_URL, window.location.href));
const assetUrl = (path) => (path ? new URL(path, ASSET_BASE).href : null);

export async function loadPlaces() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`the server answered ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('places.json is not a list');
  // Slugs are assigned in sheet order, so a re-rated duplicate name keeps its link
  return sortPlaces(data.map(normalizePlace).map(withUniqueSlugs()));
}

function normalizePlace(raw) {
  return {
    ...raw,
    tier: raw.tier.replace('+', ''),
    plus: raw.tier.endsWith('+'),
    grade: raw.tier,
    photo: assetUrl(raw.imagePath),
    // Older builds have no thumbnails, so fall back to the full photo
    thumb: assetUrl(raw.thumbPath || raw.imagePath),
    searchText: fold([raw.name, raw.ordered, raw.notes, raw.city, raw.address].join(' ')),
  };
}

function withUniqueSlugs() {
  const seen = new Map();
  return (place) => {
    const base = slugify(place.name) || `review-${place.id}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return { ...place, slug: count === 1 ? base : `${base}-${count}` };
  };
}

const slugify = (text) => fold(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Lowercase and drop accents, so "cafe" finds "Café"
const fold = (text) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// Tier order, pluses first within a tier, then newest first
export function sortPlaces(places) {
  return [...places].sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      Number(b.plus) - Number(a.plus) ||
      (b.reviewed || '').localeCompare(a.reviewed || '') ||
      b.id - a.id
  );
}

export function matchesQuery(place, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return words.every((word) => place.searchText.includes(word));
}

// Cities with the most reviews first
export function countCities(places) {
  const counts = new Map();
  places.forEach((place) => place.city && counts.set(place.city, (counts.get(place.city) || 0) + 1));
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function newestPlace(places) {
  return places.reduce(
    (newest, place) =>
      !newest || (place.reviewed || '') > (newest.reviewed || '') || (place.reviewed === newest.reviewed && place.id > newest.id)
        ? place
        : newest,
    null
  );
}

export function directionsUrl(place) {
  const query = place.address ? `${place.name}, ${place.address}` : `${place.lat},${place.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function formatReviewed(isoDate) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
