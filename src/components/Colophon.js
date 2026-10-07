import { formatReviewed } from '../lib/places';
import './Colophon.css';

// A short note at the bottom of the page about who made the site and how to read it
export default function Colophon({ places }) {
  const updated = places?.reduce((latest, place) => (place.lastUpdated > latest ? place.lastUpdated : latest), '');
  return (
    <footer className="colophon">
      <p>
        Every rating, photo, and note is Isa’s. Made by Jaylen for Isa.
        <br />
        The tier colors run from fresh, ceremonial-grade green at S to oxidized brown at F, the way matcha fades.
      </p>
      {updated && <p className="colophon__updated">Updated {formatReviewed(updated.slice(0, 10))}</p>}
    </footer>
  );
}
