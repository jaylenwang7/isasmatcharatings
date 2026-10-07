import { countCities, directionsUrl, formatReviewed, loadPlaces, matchesQuery, newestPlace, sortPlaces } from './places';

const review = (fields) => ({
  ordered: 'Iced matcha latte',
  notes: '',
  imagePath: null,
  lat: 40.44,
  lng: -79.99,
  address: '',
  city: 'Pittsburgh',
  ...fields,
});

// In sheet order, as fetch_data.py writes them
const RAW = [
  review({ id: 0, name: 'Starbucks', tier: 'D', reviewed: '2024-12-01', imagePath: 'images/a.jpg', thumbPath: 'images/a-thumb.jpg' }),
  review({ id: 1, name: 'Café Kitsuné', tier: 'B', reviewed: '2025-06-01', imagePath: 'images/b.jpg', city: 'New York' }),
  review({ id: 2, name: 'Starbucks', tier: 'B+', reviewed: '2025-02-01' }),
  review({ id: 3, name: 'Haan Coffee', tier: 'S', reviewed: '2025-01-09', city: 'Orlando', address: '1235 E Colonial Dr, Orlando, FL 32803' }),
  review({ id: 4, name: 'Old B', tier: 'B', reviewed: '2024-01-01' }),
  review({ id: 5, name: 'New B', tier: 'B', reviewed: '2026-01-01', city: 'New York' }),
];

const mockFetch = (body, ok = true) => {
  global.fetch = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) });
};

afterEach(() => {
  delete global.fetch;
});

describe('loadPlaces', () => {
  it('sorts by tier, then pluses first, then newest first', async () => {
    mockFetch(RAW);
    const places = await loadPlaces();
    expect(places.map((place) => place.name)).toEqual([
      'Haan Coffee',
      'Starbucks', // B+
      'New B',
      'Café Kitsuné',
      'Old B',
      'Starbucks', // D
    ]);
  });

  it('gives duplicate names distinct slugs in sheet order, so re-rating one keeps both links', async () => {
    mockFetch(RAW);
    const places = await loadPlaces();
    const slugOf = (id) => places.find((place) => place.id === id).slug;
    expect(slugOf(0)).toBe('starbucks');
    expect(slugOf(2)).toBe('starbucks-2');
    expect(slugOf(1)).toBe('cafe-kitsune');
  });

  it('splits the grade into tier and plus', async () => {
    mockFetch(RAW);
    const plus = (await loadPlaces()).find((place) => place.id === 2);
    expect(plus).toMatchObject({ tier: 'B', plus: true, grade: 'B+' });
  });

  it('resolves photo paths and falls back to the full photo when there is no thumbnail', async () => {
    mockFetch(RAW);
    const places = await loadPlaces();
    const withThumb = places.find((place) => place.id === 0);
    const withoutThumb = places.find((place) => place.id === 1);
    const noPhoto = places.find((place) => place.id === 4);
    expect(withThumb.photo).toBe('http://localhost/images/a.jpg');
    expect(withThumb.thumb).toBe('http://localhost/images/a-thumb.jpg');
    expect(withoutThumb.thumb).toBe(withoutThumb.photo);
    expect(noPhoto.photo).toBeNull();
  });

  it('rejects a failed request or data that is not a list', async () => {
    mockFetch([], false);
    await expect(loadPlaces()).rejects.toThrow('404');
    mockFetch({ places: [] });
    await expect(loadPlaces()).rejects.toThrow('not a list');
  });
});

describe('matchesQuery', () => {
  let places;
  beforeAll(async () => {
    mockFetch(RAW);
    places = await loadPlaces();
  });
  const kitsune = () => places.find((place) => place.id === 1);

  it('ignores case and accents', () => {
    expect(matchesQuery(kitsune(), 'cafe kitsune')).toBe(true);
    expect(matchesQuery(kitsune(), 'CAFÉ')).toBe(true);
  });

  it('needs every word to match somewhere', () => {
    expect(matchesQuery(kitsune(), 'kitsune york')).toBe(true);
    expect(matchesQuery(kitsune(), 'kitsune pittsburgh')).toBe(false);
  });

  it('matches everything for an empty query', () => {
    expect(matchesQuery(kitsune(), '  ')).toBe(true);
  });
});

it('counts cities with the most reviews first, then by name', () => {
  expect(countCities(RAW)).toEqual([
    { name: 'Pittsburgh', count: 3 },
    { name: 'New York', count: 2 },
    { name: 'Orlando', count: 1 },
  ]);
});

it('finds the newest review, breaking ties by sheet order', () => {
  expect(newestPlace(RAW).name).toBe('New B');
  const tied = [review({ id: 7, name: 'Later row', reviewed: '2026-01-01' }), review({ id: 6, name: 'Earlier row', reviewed: '2026-01-01' })];
  expect(newestPlace(tied).name).toBe('Later row');
});

it('sorts without changing the original list', () => {
  const original = [...RAW];
  sortPlaces(RAW.map((place) => ({ ...place, tier: place.tier[0], plus: place.tier.endsWith('+') })));
  expect(RAW).toEqual(original);
});

it('links directions to the address when there is one, or else the coordinates', () => {
  expect(directionsUrl(RAW[3])).toBe(
    'https://www.google.com/maps/search/?api=1&query=Haan%20Coffee%2C%201235%20E%20Colonial%20Dr%2C%20Orlando%2C%20FL%2032803'
  );
  expect(directionsUrl(RAW[4])).toBe('https://www.google.com/maps/search/?api=1&query=40.44%2C-79.99');
});

it('formats review dates for people', () => {
  expect(formatReviewed('2025-01-09')).toBe('January 9, 2025');
  expect(formatReviewed(null)).toBeNull();
});
