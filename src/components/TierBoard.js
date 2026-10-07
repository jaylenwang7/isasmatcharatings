import { TIERS } from '../tiers';
import MatchaCup from './MatchaCup';
import './TierBoard.css';

// The tier list: one row per tier, best first. Each row's colored label holds the tier's
// letter and what Isa means by it, and a photo tile for each review follows
export default function TierBoard({ places, selectedSlug, hrefFor, onOpen, showCity, hideEmpty }) {
  return (
    <div className="board">
      {TIERS.map((tier) => {
        const tierPlaces = places.filter((place) => place.tier === tier.letter);
        if (hideEmpty && !tierPlaces.length) return null;
        return (
          <TierRow key={tier.letter} tier={tier}>
            {tierPlaces.length ? (
              <ul className="tier__places">
                {tierPlaces.map((place) => (
                  <li key={place.slug}>
                    <PlaceTile
                      place={place}
                      href={hrefFor(place)}
                      selected={place.slug === selectedSlug}
                      showCity={showCity}
                      onOpen={onOpen}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tier__empty">Nothing here yet</p>
            )}
          </TierRow>
        );
      })}
    </div>
  );
}

function TierRow({ tier, children }) {
  return (
    <section className="tier" data-tier={tier.letter} aria-labelledby={`tier-${tier.letter}`}>
      <div className="tier__label">
        <div className="tier__label-inner">
          <h2 className="tier__letter" id={`tier-${tier.letter}`}>
            <span className="visually-hidden">Tier </span>
            {tier.letter}
          </h2>
          <p className="tier__description">{tier.description}</p>
        </div>
      </div>
      <div className="tier__body">{children}</div>
    </section>
  );
}

function PlaceTile({ place, href, selected, showCity, onOpen }) {
  const handleClick = (event) => {
    // Let modified clicks open the review in a new tab
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onOpen(place);
  };

  return (
    <a className="tile" href={href} onClick={handleClick} aria-current={selected ? 'true' : undefined}>
      <span className="tile__photo">
        {place.thumb ? (
          <img src={place.thumb} alt="" loading="lazy" decoding="async" />
        ) : (
          <MatchaCup className="tile__no-photo" />
        )}
        {place.plus && (
          <span className="tile__grade" title={`${place.grade}: top of the ${place.tier} tier`}>
            {place.grade}
            <span className="visually-hidden">, top of the {place.tier} tier</span>
          </span>
        )}
      </span>
      <span className="tile__name">{place.name}</span>
      {showCity && place.city && <span className="tile__city">{place.city}</span>}
    </a>
  );
}

export function TierBoardSkeleton() {
  return (
    <div className="board" aria-busy="true" aria-label="Loading reviews">
      {TIERS.map((tier, index) => (
        <TierRow key={tier.letter} tier={tier}>
          <ul className="tier__places">
            {Array.from({ length: Math.max(1, 5 - index) }, (_, i) => (
              <li key={i}>
                <span className="tile tile--placeholder">
                  <span className="tile__photo" />
                </span>
              </li>
            ))}
          </ul>
        </TierRow>
      ))}
    </div>
  );
}
