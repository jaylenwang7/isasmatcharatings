import { newestPlace } from '../lib/places';
import MatchaCup from './MatchaCup';
import './Masthead.css';

export default function Masthead({ places, hrefFor, onOpen }) {
  const newest = places?.length ? newestPlace(places) : null;
  const cityCount = new Set(places?.map((place) => place.city).filter(Boolean)).size;

  return (
    <header className="masthead">
      <MatchaCup className="masthead__art" />
      <h1 className="masthead__title">Isa’s matcha tier list</h1>
      <p className="masthead__intro">
        Ranked on the matcha itself and the whole experience.
        {newest && (
          <>
            {' '}
            {places.length} so far{cityCount > 1 && `, across ${cityCount} cities`}. Newest:{' '}
            <a
              href={hrefFor(newest)}
              onClick={(event) => {
                event.preventDefault();
                onOpen(newest);
              }}
            >
              {newest.name}
            </a>
            {newest.city && ` in ${newest.city}`}.
          </>
        )}
      </p>
    </header>
  );
}
