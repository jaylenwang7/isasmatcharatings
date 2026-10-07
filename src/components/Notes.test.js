import { renderToStaticMarkup } from 'react-dom/server';
import Notes from './Notes';

const render = (text) => renderToStaticMarkup(<Notes text={text} />).replace(/^<div class="notes">|<\/div>$/g, '');

it('puts each line in its own paragraph', () => {
  expect(render('Matcha quality mid.\nCould have been mixed better.')).toBe(
    '<p>Matcha quality mid.</p><p>Could have been mixed better.</p>'
  );
});

it('skips blank lines', () => {
  expect(render('First\n\n\nSecond')).toBe('<p>First</p><p>Second</p>');
});

it('turns "* " and "- " lines into one list', () => {
  expect(render('* Light, floral tea\n- Pretty green')).toBe('<ul><li>Light, floral tea</li><li>Pretty green</li></ul>');
});

it('splits bullets run together on one line', () => {
  expect(render('*Oat milk tasted fire *The matcha was subtle *Color was light')).toBe(
    '<ul><li>Oat milk tasted fire</li><li>The matcha was subtle</li><li>Color was light</li></ul>'
  );
});

it('keeps lists and paragraphs in order', () => {
  expect(render('Intro\n* One\n* Two\nOutro')).toBe('<p>Intro</p><ul><li>One</li><li>Two</li></ul><p>Outro</p>');
});

it('renders *emphasis*', () => {
  expect(render('Really *dark* green color.')).toBe('<p>Really <em>dark</em> green color.</p>');
});

it('leaves stray asterisks alone', () => {
  expect(render('** I think this location did a fantastic job')).toBe(
    '<p>** I think this location did a fantastic job</p>'
  );
  expect(render('5 * 3 scoops')).toBe('<p>5 * 3 scoops</p>');
});
