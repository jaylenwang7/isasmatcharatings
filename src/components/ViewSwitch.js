import { ListIcon, MapIcon } from './Icons';
import { PenUnderline } from './PenMarks';
import './ViewSwitch.css';

// Phones show the tier list or the map, switched from a bar within thumb reach. The view
// showing is underlined in Isa's pen, like the city filter
export default function ViewSwitch({ view, onChange }) {
  return (
    <nav className="view-switch" aria-label="View">
      <ViewButton label="Tier list" icon={<ListIcon size={18} />} pressed={view === 'list'} onClick={() => onChange('list')} />
      <ViewButton label="Map" icon={<MapIcon size={18} />} pressed={view === 'map'} onClick={() => onChange('map')} />
    </nav>
  );
}

function ViewButton({ label, icon, pressed, onClick }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick}>
      {icon}
      {label}
      {pressed && <PenUnderline className="view-switch__mark" />}
    </button>
  );
}
