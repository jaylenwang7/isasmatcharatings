import { useEffect, useRef, useState } from 'react';
import { HOME_CITY } from '../lib/places';
import { BridgeIcon, CloseIcon, SearchIcon } from './Icons';
import { PenUnderline } from './PenMarks';
import './Toolbar.css';

// Cities with fewer reviews than this wait behind a "more" button, so the filter stays short as
// Isa travels
const FEATURED_COUNT = 2;

export default function Toolbar({ cities, total, city, onCityChange, query, onQueryChange }) {
  const [expanded, setExpanded] = useState(false);
  const minor = cities.filter(({ count }) => count < FEATURED_COUNT);
  const collapse = !expanded && minor.length > 2 && minor.length < cities.length;
  const shown = collapse ? cities.filter(({ name, count }) => count >= FEATURED_COUNT || name === city) : cities;
  const hiddenCount = cities.length - shown.length;

  // On phones the cities scroll sideways; a city picked on the map should scroll into view
  const citiesRef = useRef(null);
  useEffect(() => {
    const row = citiesRef.current;
    const button = row?.querySelector('.city[aria-pressed="true"]');
    if (!row || !button || row.scrollWidth <= row.clientWidth) return;
    const rowBox = row.getBoundingClientRect();
    const box = button.getBoundingClientRect();
    if (box.left < rowBox.left || box.right > rowBox.right - 40) {
      row.scrollBy({ left: box.left - rowBox.left - 16, behavior: 'smooth' });
    }
  }, [city]);

  return (
    <div className="toolbar">
      <label className={`search${query ? ' search--filled' : ''}`}>
        <SearchIcon size={17} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search reviews"
          aria-label="Search reviews"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="search__clear" onClick={() => onQueryChange('')} aria-label="Clear search">
            <CloseIcon size={15} />
          </button>
        )}
      </label>
      {cities.length > 1 && (
        <div className="cities" role="group" aria-label="Filter by city" ref={citiesRef}>
          <CityButton label="Everywhere" count={total} pressed={!city} onClick={() => onCityChange(null)} />
          {shown.map(({ name, count }) => (
            <CityButton
              key={name}
              label={name}
              count={count}
              icon={name === HOME_CITY && <BridgeIcon size={17} />}
              pressed={city === name}
              onClick={() => onCityChange(city === name ? null : name)}
            />
          ))}
          {hiddenCount > 0 && (
            <button type="button" className="city city--more" onClick={() => setExpanded(true)}>
              {hiddenCount} more
            </button>
          )}
          {expanded && (
            <button type="button" className="city city--more" onClick={() => setExpanded(false)}>
              Fewer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CityButton({ label, count, icon, pressed, onClick }) {
  return (
    <button type="button" className="city" aria-pressed={pressed} onClick={onClick}>
      {icon}
      {label}
      <span className="city__count">{count}</span>
      {pressed && <PenUnderline className="city__mark" />}
    </button>
  );
}
