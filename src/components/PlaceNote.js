import { useEffect, useId, useRef, useState } from 'react';
import { directionsUrl, formatReviewed } from '../lib/places';
import Grade from './Grade';
import MatchaCup from './MatchaCup';
import Notes from './Notes';
import { MapIcon, NextIcon, PinIcon, PrevIcon } from './Icons';
import { PenCross } from './PenMarks';
import './PlaceNote.css';

// One review as a page in Isa's matcha journal: the photo taped in, the café's name, the
// receipt for what she ordered, and her handwritten notes. It lands on the map on wide screens,
// or slides up as a sheet on phones. Give it key={place.slug} so each review replays the landing
export default function PlaceNote({ place, variant, prev, next, onNavigate, onClose, onShowOnMap }) {
  const noteRef = useRef(null);
  const scrollRef = useRef(null);
  const hasMore = useHasMoreBelow(scrollRef);

  // Move focus into the note, so keyboard and screen reader users land on the review
  useEffect(() => {
    noteRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target.closest?.('input, textarea')) return;
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft' && prev) onNavigate(prev);
      else if (event.key === 'ArrowRight' && next) onNavigate(next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onNavigate, prev, next]);

  const reviewed = formatReviewed(place.reviewed);

  return (
    <article
      ref={noteRef}
      tabIndex={-1}
      className={`note note--${variant}`}
      data-tier={place.tier}
      role="dialog"
      aria-modal={variant === 'sheet' ? 'true' : undefined}
      aria-labelledby="note-title"
    >
      <div className="note__paper">
        <button type="button" className="note__close" onClick={onClose} aria-label="Close review">
          <PenCross />
        </button>

        <div className={`note__scroll${hasMore ? ' note__scroll--more' : ''}`} ref={scrollRef}>
          <div className="note__ticket">
            <figure className="note__photo">
              <span className="note__tape" aria-hidden="true" />
              {place.photo ? (
                <img
                  src={place.photo}
                  alt={`Isa with the matcha from ${place.name}`}
                  width={place.imageWidth}
                  height={place.imageHeight}
                />
              ) : (
                <span className="note__no-photo">
                  <MatchaCup />
                </span>
              )}
              <span className="note__grade">
                <Grade grade={place.grade} />
              </span>
            </figure>

            <div className="note__info">
              <h2 id="note-title" className="note__name">
                {place.name}
              </h2>
              {/* The address doubles as the link to directions */}
              <p className="note__where">
                <a href={directionsUrl(place)} target="_blank" rel="noreferrer" title="Directions in Google Maps">
                  <PinIcon size={14} />
                  <span>
                    <span className="visually-hidden">Directions to </span>
                    {place.address || place.city}
                  </span>
                </a>
                {onShowOnMap && (
                  <button type="button" onClick={onShowOnMap}>
                    <MapIcon size={14} />
                    Show on map
                  </button>
                )}
              </p>
              {(place.ordered || reviewed) && (
                <div className="note__receipt">
                  <span className="note__receipt-tape" aria-hidden="true" />
                  <div className="note__receipt-paper">
                    {place.ordered && (
                      <>
                        <p className="note__label">Ordered</p>
                        <p className="note__drink">{place.ordered}</p>
                      </>
                    )}
                    {reviewed && <p className="note__date">{reviewed}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {place.notes && (
            <div className="note__writing">
              <CupRing turn={(place.id * 47) % 360} />
              <Notes text={place.notes} />
            </div>
          )}

          {(prev || next) && (
            <nav className="note__nav" aria-label="Other reviews">
              {prev ? (
                <button type="button" onClick={() => onNavigate(prev)}>
                  <PrevIcon size={18} />
                  <span>
                    <span className="note__nav-hint">Previous</span>
                    <span className="note__nav-name">{prev.name}</span>
                  </span>
                </button>
              ) : (
                <span />
              )}
              {next && (
                <button type="button" className="note__nav-next" onClick={() => onNavigate(next)}>
                  <span>
                    <span className="note__nav-hint">Next</span>
                    <span className="note__nav-name">{next.name}</span>
                  </span>
                  <NextIcon size={18} />
                </button>
              )}
            </nav>
          )}
        </div>
      </div>
    </article>
  );
}

// The ring a matcha cup left when it was set down on the notes, turned differently on each review
function CupRing({ turn }) {
  const id = useId();
  return (
    <svg className="note__ring" style={{ rotate: `${turn}deg` }} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <filter id={`${id}-wobble`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="6" />
        </filter>
        <radialGradient id={`${id}-fill`}>
          <stop offset="0.72" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="0.93" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g filter={`url(#${id}-wobble)`} fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="78" fill={`url(#${id}-fill)`} stroke="none" />
        <circle cx="100" cy="100" r="77" strokeWidth="3.4" strokeOpacity="0.6" strokeDasharray="150 6 90 4 170 10" />
        <circle cx="103" cy="98" r="74" strokeWidth="1.4" strokeOpacity="0.3" strokeDasharray="60 20 140 30" />
      </g>
    </svg>
  );
}

// Whether a scroll box has more below its visible part, so the note can fade its bottom edge
// instead of cutting handwriting off mid-line
function useHasMoreBelow(ref) {
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const box = ref.current;
    const update = () => setHasMore(box.scrollTop + box.clientHeight < box.scrollHeight - 4);
    const observer = new ResizeObserver(update);
    // Watch the contents too: the photo loading in makes the note taller
    [box, ...box.children].forEach((element) => observer.observe(element));
    box.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      box.removeEventListener('scroll', update);
    };
  }, [ref]);
  return hasMore;
}
