"""
Check that the live site is up and complete: the page loads, the reviews load, and every photo,
thumbnail, and icon they point to is there. Exits non-zero on any problem, so the daily
.github/workflows/check-live-site.yml run fails and GitHub emails about it.

Usage: python scripts/check_live_site.py [site URL]   (defaults to "homepage" in package.json)
"""
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

USER_AGENT = 'IsasMatchaTierList-check/1.0'
ICONS = ['og-image.png', 'favicon.ico', 'icon.svg', 'apple-touch-icon.png']


def site_url() -> str:
    if len(sys.argv) > 1:
        return sys.argv[1].rstrip('/') + '/'
    package = json.loads((Path(__file__).parent.parent / 'package.json').read_text())
    return package['homepage'].rstrip('/') + '/'


def fetch(url: str, method: str = 'GET'):
    # A query string skips the 10-minute GitHub Pages cache, so this sees what's actually deployed
    busted = f"{url}{'&' if '?' in url else '?'}check={int(time.time())}"
    request = urllib.request.Request(busted, method=method, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.status, response.read() if method == 'GET' else b''


def status_of(url: str) -> int:
    try:
        return fetch(url, 'HEAD')[0]
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def main() -> int:
    base = site_url()
    problems = []

    try:
        status, html = fetch(base)
        if b'<div id="root">' not in html:
            problems.append(f"{base} loaded ({status}) but isn't the app")
    except Exception as e:
        print(f"::error title=Site down::{base} didn't load: {e}")
        return 1

    try:
        _, body = fetch(base + 'data/places.json')
        places = json.loads(body)
        if not isinstance(places, list) or not places:
            problems.append('places.json has no reviews')
            places = []
    except Exception as e:
        problems.append(f"places.json didn't load: {e}")
        places = []

    files = sorted({p[key] for p in places for key in ('imagePath', 'thumbPath') if p.get(key)} | set(ICONS))
    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses = dict(zip(files, pool.map(lambda path: status_of(base + path), files)))
    problems += [f"{path} returned {status or 'no response'}" for path, status in statuses.items() if status != 200]

    photos = sum(1 for p in places if p.get('imagePath'))
    print(f"{base}: {len(places)} reviews, {photos} with photos, {len(files)} files checked")
    for problem in problems:
        print(f"::error title=Live site problem::{problem}")
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
