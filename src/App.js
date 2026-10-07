import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { countCities, HOME_CITY, loadPlaces, matchesQuery } from './lib/places';
import useHashRoute, { formatHash } from './lib/useHashRoute';
import useMediaQuery from './lib/useMediaQuery';
import Masthead from './components/Masthead';
import Toolbar from './components/Toolbar';
import TierBoard, { TierBoardSkeleton } from './components/TierBoard';
import PlaceNote from './components/PlaceNote';
import ViewSwitch from './components/ViewSwitch';
import Colophon from './components/Colophon';
import './App.css';

const loadMap = () => import('./components/MatchaMap');
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MatchaMap = lazy(loadMap);

// How much of the map each kind of note covers, so the map can keep the pin above it
const NOTE_COVER = { panel: 0.64, 'sheet-half': 0.56, sheet: 0 };

export default function App() {
  const [places, setPlaces] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [city, setCity] = useState(null);
  const [query, setQuery] = useState('');
  // The review under the mouse in the list, which the map lights up
  const [hoveredSlug, setHoveredSlug] = useState(null);
  const { route, navigate, goBack } = useHashRoute();
  const isWide = useMediaQuery('(min-width: 960px)');

  useEffect(() => {
    loadPlaces().then(setPlaces, setLoadError);
  }, []);

  // Fetch the map's code once the list is showing, so the map is ready when it's wanted
  useEffect(() => {
    if (places) (window.requestIdleCallback || setTimeout)(loadMap);
  }, [places]);

  const cities = useMemo(() => countCities(places || []), [places]);
  const visible = useMemo(
    () => (places || []).filter((place) => (!city || place.city === city) && matchesQuery(place, query)),
    [places, city, query]
  );
  const visibleIds = useMemo(() => new Set(visible.map((place) => place.slug)), [visible]);
  const selected = places?.find((place) => place.slug === route.slug) || null;
  // With nothing filtered, the map opens on the home city rather than the whole world
  // (the map only uses this for its first view)
  const homePlaces = useMemo(
    () => (!city && !query ? visible.filter((place) => place.city === HOME_CITY) : null),
    [visible, city, query]
  );

  // Previous and next follow the board's order, among the reviews showing
  const index = visible.indexOf(selected);
  const prev = index > 0 ? visible[index - 1] : null;
  const next = index >= 0 && index < visible.length - 1 ? visible[index + 1] : null;

  const noteVariant = isWide ? 'panel' : route.view === 'map' ? 'sheet-half' : 'sheet';
  const mapShowing = isWide || route.view === 'map';
  // Keep the map mounted once it has been shown, so switching back is instant
  const [mapMounted, setMapMounted] = useState(mapShowing);
  useEffect(() => {
    if (mapShowing) setMapMounted(true);
  }, [mapShowing]);

  const hrefFor = useCallback((place) => formatHash({ view: route.view, slug: place.slug }), [route.view]);
  const open = useCallback(
    // Switching between reviews replaces the history entry, so Back closes the note
    (place) => navigate({ view: route.view, slug: place.slug }, { replace: !!route.slug }),
    [navigate, route.view, route.slug]
  );
  const close = useCallback(() => goBack({ view: route.view, slug: null }), [goBack, route.view]);

  // The list keeps its scroll position on phones while the map is showing
  const listScroll = useRef(0);
  const changeView = (view) => {
    if (view === route.view) return;
    if (route.view === 'list') listScroll.current = window.scrollY;
    navigate({ view, slug: route.slug }, { replace: true });
  };
  useLayoutEffect(() => {
    if (isWide) return;
    window.scrollTo(0, route.view === 'map' ? 0 : listScroll.current);
  }, [route.view, isWide]);

  // The list follows the map: a review opened from the map scrolls its photo into view, and a new
  // city filter brings the top of the list back into view. Both skip a list that isn't showing
  const boardRef = useRef(null);
  useEffect(() => {
    const tile = boardRef.current?.querySelector('.tile[aria-current]');
    if (!tile?.offsetParent) return;
    const box = tile.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= window.innerHeight) return;
    tile.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [route.slug]);
  const firstCity = useRef(true);
  useEffect(() => {
    if (firstCity.current) {
      firstCity.current = false;
      return;
    }
    const board = boardRef.current;
    if (!board?.offsetParent) return;
    // On phones the toolbar sticks to the top, so stop just below it
    const stuck = isWide ? 0 : document.querySelector('.toolbar')?.offsetHeight || 0;
    const target = board.getBoundingClientRect().top + window.scrollY - stuck - 12;
    if (window.scrollY > target) window.scrollTo({ top: target, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // Only for a new city, not for a resize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // The phone sheet covers the page, so the page shouldn't scroll behind it
  useEffect(() => {
    if (!selected || noteVariant !== 'sheet') return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selected, noteVariant]);

  const note = selected && (
    <PlaceNote
      key={selected.slug}
      place={selected}
      variant={noteVariant}
      prev={prev}
      next={next}
      onNavigate={open}
      onClose={close}
      onShowOnMap={noteVariant === 'sheet' ? () => navigate({ view: 'map', slug: selected.slug }, { replace: true }) : null}
    />
  );

  return (
    <>
      <div className={`page page--${route.view}`}>
        <div className="page__masthead">
          <Masthead places={places} hrefFor={hrefFor} onOpen={open} />
        </div>
        <Toolbar
          cities={cities}
          total={places?.length || 0}
          city={city}
          onCityChange={setCity}
          query={query}
          onQueryChange={setQuery}
        />

        <main className="page__board" ref={boardRef}>
          {loadError ? (
            <div className="message">
              <p>The reviews didn’t load ({loadError.message}). Check your connection, then reload the page.</p>
              <button type="button" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          ) : !places ? (
            <TierBoardSkeleton />
          ) : visible.length ? (
            <TierBoard
              places={visible}
              selectedSlug={route.slug}
              hrefFor={hrefFor}
              onOpen={open}
              showCity={!city}
              hideEmpty={!!query || !!city}
              onHoverPlace={setHoveredSlug}
            />
          ) : (
            <div className="message">
              <p>
                No reviews match “{query}”{city && ` in ${city}`}.
              </p>
              <div className="message__actions">
                {city && (
                  <button type="button" onClick={() => setCity(null)}>
                    Search everywhere
                  </button>
                )}
                <button type="button" className={city ? 'message__secondary' : ''} onClick={() => setQuery('')}>
                  Clear search
                </button>
              </div>
            </div>
          )}
          {places && <Colophon places={places} />}
        </main>

        <aside className="page__panel" aria-label="Map">
          <div className="page__map">
            {mapMounted && places && (
              <Suspense fallback={null}>
                <MatchaMap
                  places={places}
                  visibleIds={visibleIds}
                  homePlaces={homePlaces}
                  selected={selected}
                  active={mapShowing}
                  coverFraction={selected ? NOTE_COVER[noteVariant] : 0}
                  city={city}
                  onCityChange={setCity}
                  litSlug={hoveredSlug}
                  onSelect={open}
                  onBackgroundClick={() => selected && close()}
                />
              </Suspense>
            )}
            {noteVariant === 'panel' && note}
          </div>
        </aside>
      </div>

      {noteVariant !== 'panel' && note}
      {noteVariant === 'sheet' && selected && <div className="sheet-backdrop" onClick={close} />}
      {!(selected && noteVariant === 'sheet') && <ViewSwitch view={route.view} onChange={changeView} />}
    </>
  );
}
