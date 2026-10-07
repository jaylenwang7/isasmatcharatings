import { act } from 'react';
import { createRoot } from 'react-dom/client';
import useHashRoute, { formatHash, parseHash } from './useHashRoute';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('parseHash and formatHash', () => {
  it.each([
    ['', { view: 'list', slug: null }],
    ['#/', { view: 'list', slug: null }],
    ['#/map', { view: 'map', slug: null }],
    ['#/list/haan-coffee', { view: 'list', slug: 'haan-coffee' }],
    ['#/map/haan-coffee', { view: 'map', slug: 'haan-coffee' }],
    ['#/somewhere-else', { view: 'list', slug: null }],
  ])('reads %p', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it.each([
    [{ view: 'list', slug: null }, '#/'],
    [{ view: 'map', slug: null }, '#/map'],
    [{ view: 'list', slug: 'haan-coffee' }, '#/list/haan-coffee'],
    [{ view: 'map', slug: 'café' }, '#/map/caf%C3%A9'],
  ])('writes %p', (route, hash) => {
    expect(formatHash(route)).toBe(hash);
    expect(parseHash(hash)).toEqual(route);
  });
});

// Render the hook in a tiny component and expose what it returns
function renderRoute() {
  const current = {};
  function Probe() {
    Object.assign(current, useHashRoute());
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(<Probe />));
  return { current, unmount: () => act(() => root.unmount()) };
}

describe('useHashRoute', () => {
  let rendered;
  let back;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    back = jest.spyOn(window.history, 'back').mockImplementation(() => {});
    rendered = renderRoute();
  });

  afterEach(() => {
    rendered.unmount();
    back.mockRestore();
  });

  it('pushes a history entry when a review opens', () => {
    const before = window.history.length;
    act(() => rendered.current.navigate({ view: 'list', slug: 'haan-coffee' }));
    expect(window.location.hash).toBe('#/list/haan-coffee');
    expect(window.history.length).toBe(before + 1);
    expect(rendered.current.route).toEqual({ view: 'list', slug: 'haan-coffee' });
  });

  it('steps back to close a review it opened, so Back does not reopen it', () => {
    act(() => rendered.current.navigate({ view: 'list', slug: 'haan-coffee' }));
    act(() => rendered.current.goBack({ view: 'list', slug: null }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('closes a review moved to the map in place, staying on the map', () => {
    act(() => rendered.current.navigate({ view: 'list', slug: 'haan-coffee' }));
    act(() => rendered.current.navigate({ view: 'map', slug: 'haan-coffee' }, { replace: true }));
    act(() => rendered.current.goBack({ view: 'map', slug: null }));
    expect(back).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/map');
    expect(rendered.current.route).toEqual({ view: 'map', slug: null });
  });

  it('closes a review opened from a shared link without leaving the site', () => {
    rendered.unmount();
    window.history.replaceState(null, '', '/#/list/haan-coffee');
    rendered = renderRoute();
    expect(rendered.current.route.slug).toBe('haan-coffee');
    act(() => rendered.current.goBack({ view: 'list', slug: null }));
    expect(back).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/');
  });

  it('follows the Back and Forward buttons', () => {
    window.history.replaceState(null, '', '/#/map/haan-coffee');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(rendered.current.route).toEqual({ view: 'map', slug: 'haan-coffee' });
  });
});
