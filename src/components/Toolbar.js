import { HOME_CITY } from '../lib/places';
import { BridgeIcon, CloseIcon, SearchIcon } from './Icons';
import { PenUnderline } from './PenMarks';
import './Toolbar.css';

export default function Toolbar({ cities, total, city, onCityChange, query, onQueryChange }) {
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
        <div className="cities" role="group" aria-label="Filter by city">
          <CityButton label="Everywhere" count={total} pressed={!city} onClick={() => onCityChange(null)} />
          {cities.map(({ name, count }) => (
            <CityButton
              key={name}
              label={name}
              count={count}
              icon={name === HOME_CITY && <BridgeIcon size={17} />}
              pressed={city === name}
              onClick={() => onCityChange(city === name ? null : name)}
            />
          ))}
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
