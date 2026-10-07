import { PenCircle, PenHanamaru } from './PenMarks';
import './Grade.css';

// The tier written in Isa's pen and circled, like a mark on a graded paper. S grades get a
// hanamaru, the flower a teacher draws on a perfect paper
export default function Grade({ grade }) {
  const perfect = grade.startsWith('S');
  return (
    <span className={`grade${perfect ? ' grade--perfect' : ''}`} aria-label={`Tier ${grade}`}>
      <span className="grade__mark" aria-hidden="true">
        {grade}
      </span>
      {perfect ? <PenHanamaru className="grade__circle" /> : <PenCircle className="grade__circle" />}
    </span>
  );
}
