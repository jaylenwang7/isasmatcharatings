import { useCallback, useEffect, useState } from 'react';

// The view and the open review live in the URL hash (#/map/haan-coffee), so a review
// can be shared as a link and the Back button closes it

export function parseHash(hash) {
  const [view, slug] = hash.replace(/^#\/?/, '').split('/');
  return { view: view === 'map' ? 'map' : 'list', slug: slug ? decodeURIComponent(slug) : null };
}

export function formatHash({ view, slug }) {
  if (slug) return `#/${view}/${encodeURIComponent(slug)}`;
  return view === 'map' ? '#/map' : '#/';
}

export default function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const navigate = useCallback((next, { replace = false } = {}) => {
    const hash = formatHash(next);
    if (replace) {
      window.history.replaceState(window.history.state, '', hash);
    } else {
      window.history.pushState({ pushedByApp: true, view: next.view }, '', hash);
    }
    setRoute(parseHash(hash));
  }, []);

  // Step back if this page pushed the current entry from the same view, so Back doesn't reopen
  // what was just closed. A review moved to the map ("Show on map") closes in place instead
  const goBack = useCallback(
    (fallback) => {
      const { state } = window.history;
      if (state?.pushedByApp && state.view === fallback.view) window.history.back();
      else navigate(fallback, { replace: true });
    },
    [navigate]
  );

  return { route, navigate, goBack };
}
