import re
from typing import List, Tuple, Dict, Optional
import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from PIL import Image, ImageOps
import io
import os
import json
import shutil
from pathlib import Path
import hashlib
from datetime import datetime
import requests
import time

# Persisted between CI runs by actions/cache, so each build only fetches what's new
CACHE_DIR = Path('.cache')
IMAGE_CACHE_DIR = CACHE_DIR / 'images'
COORDINATES_CACHE_PATH = CACHE_DIR / 'coordinates.json'
COUNTRIES_CACHE_PATH = CACHE_DIR / 'countries.json'
PHOTO_DATES_CACHE_PATH = CACHE_DIR / 'photo_dates.json'

# Longest edge of published photos; enough for the largest (600px tall) view on 2x screens
MAX_IMAGE_SIZE = 1600
# Longest edge of the tier list thumbnails, which show about 110px wide; enough for 3x screens
THUMB_SIZE = 480

VALID_TIERS = {'S', 'A', 'B', 'C', 'D', 'F'}

# The sheet's columns, by exact header text. Renaming a form question renames its column, so
# check for them all: without the required ones no review can be read
REQUIRED_COLUMNS = ['Place Name', 'Tier Rating']
OPTIONAL_COLUMNS = [
    'Timestamp',
    'Add a plus (e.g., B+)',
    'What did you order?',
    'Notes',
    'Upload a picture!',
    'Lat/Long from Google Maps',
    'Address (copied from Google Maps)',
]

# Fields that are almost never empty, so a sudden run of empty ones means a renamed column
USUALLY_FILLED = {'ordered': 'What did you order?', 'notes': 'Notes', 'imagePath': 'Upload a picture!'}

# Neighborhoods and suburbs to file under their metro area in the site's city filter
METRO_AREAS = {
    'Brooklyn': 'New York',
    'Long Island City': 'New York',
    'Astoria': 'New York',
    'Flushing': 'New York',
    'Bronx': 'New York',
    'Jamaica Plain': 'Boston',
    'Bellevue': 'Seattle',
    'Redmond': 'Seattle',
}

def get_field(record: Dict, column: str) -> str:
    """
    Read a sheet cell as a stripped string (gspread returns numbers for numeric-looking cells)
    """
    return str(record.get(column, '')).strip()

def get_safe_filename(name: str, file_id: str) -> str:
    """
    Create a safe filename from the place name and file ID
    """
    # Clean the name to be filesystem-safe
    safe_name = re.sub(r'[^a-zA-Z0-9]', '-', name.lower())
    # Partial hash for uniqueness; no date, so the name stays stable and browsers can cache it
    file_hash = hashlib.md5(file_id.encode()).hexdigest()[:6]
    return f"{safe_name}-{file_hash}.jpg"

def extract_file_id(url: str) -> Optional[str]:
    """
    Extract Google Drive file ID from various URL formats
    Returns None if no valid file ID is found
    """
    if not url or not isinstance(url, str):
        return None
        
    url = url.strip()
    
    # If it's already just a file ID (no slashes or spaces), return it
    if len(url) > 25 and '/' not in url and ' ' not in url:
        return url
        
    # Common Google Drive URL patterns
    patterns = [
        r'/d/([a-zA-Z0-9_-]{25,})',  # /d/{fileId}/
        r'id=([a-zA-Z0-9_-]{25,})',  # id={fileId}
        r'/file/d/([a-zA-Z0-9_-]{25,})',  # /file/d/{fileId}
        r'drive\.google\.com/open\?id=([a-zA-Z0-9_-]{25,})'  # open?id={fileId}
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

def resize_image(source, dest: Path, max_size: int = MAX_IMAGE_SIZE, quality: int = 82) -> Tuple[int, int]:
    """
    Shrink a full-size phone photo to a web-friendly JPEG, returning its new (width, height)
    """
    with Image.open(source) as img:
        # Phone photos store their rotation in EXIF, which re-encoding drops, so apply it first
        img = ImageOps.exif_transpose(img)
        img.thumbnail((max_size, max_size))
        img.convert('RGB').save(dest, 'JPEG', quality=quality, optimize=True, progressive=True)
        return img.size

def download_and_save_image(service, file_id: str, place_name: str) -> Optional[Dict]:
    """
    Download image from Google Drive, resize it, and save it and a thumbnail to the repository
    Returns the image fields for places.json, or None if download fails
    """
    if not file_id or file_id.strip() == '':
        print(f"No image ID provided for {place_name}")
        return None

    try:
        # Create images directory if it doesn't exist
        images_dir = Path('public/images')
        images_dir.mkdir(parents=True, exist_ok=True)

        # Generate safe filename
        filename = get_safe_filename(place_name, file_id)
        file_path = images_dir / filename

        # Reuse the resized image from an earlier build if we have it (the size is in the
        # name so changing MAX_IMAGE_SIZE doesn't reuse stale images)
        cached_path = IMAGE_CACHE_DIR / f"{file_id}-{MAX_IMAGE_SIZE}.jpg"
        if cached_path.exists():
            print(f"Using cached image for {place_name}")
        else:
            request = service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)

            done = False
            while not done:
                status, done = downloader.next_chunk()
                if status:
                    print(f"Downloading {filename}: {int(status.progress() * 100)}%")

            fh.seek(0)
            IMAGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            resize_image(fh, cached_path)

        shutil.copyfile(cached_path, file_path)
        with Image.open(cached_path) as img:
            width, height = img.size

        # Made from the cached photo each run, since that's quick and needs no download
        thumb_filename = filename.replace('.jpg', '-thumb.jpg')
        resize_image(cached_path, images_dir / thumb_filename, THUMB_SIZE, quality=78)

        return {
            'imagePath': f"images/{filename}",
            'thumbPath': f"images/{thumb_filename}",
            'imageWidth': width,
            'imageHeight': height,
        }

    except Exception as e:
        print(f"Error downloading image for {place_name}: {str(e)}")
        return None

def parse_coordinates(coord_string: str) -> Optional[Tuple[float, float]]:
    """
    Parse coordinates from various Google Maps formats.
    Returns tuple of (latitude, longitude) or None if parsing fails
    """
    if not isinstance(coord_string, str) or not coord_string.strip():
        return None
    
    # Remove any extra whitespace
    coord_string = coord_string.strip()
    
    try:
        # Case 1: Simple decimal numbers (37.7749, -122.4194)
        if ',' in coord_string:
            try:
                lat, lng = map(float, coord_string.split(','))
                return lat, lng
            except ValueError:
                pass

        # Case 2: Degrees, minutes, seconds (37°46'29.7"N 122°25'09.9"W). Checked before
        # case 3, whose pattern would also match the degrees and minutes and misread them
        dms_pattern = r'''
            (\d+)°                   # Degrees
            (\d+)'                   # Minutes
            (\d+\.?\d*)"?           # Seconds
            \s*([NS])               # N/S
            \s*
            (\d+)°                   # Degrees
            (\d+)'                   # Minutes
            (\d+\.?\d*)"?           # Seconds
            \s*([WE])               # W/E
        '''
        match = re.search(dms_pattern, coord_string, re.VERBOSE)
        if match:
            lat_d, lat_m, lat_s, ns, lng_d, lng_m, lng_s, ew = match.groups()
            lat = float(lat_d) + float(lat_m)/60 + float(lat_s)/3600
            lng = float(lng_d) + float(lng_m)/60 + float(lng_s)/3600
            lat *= -1 if ns == 'S' else 1
            lng *= -1 if ew == 'W' else 1
            return lat, lng

        # Case 3: Decimal degrees with directions (37.7749° N, 122.4194° W)
        decimal_pattern = r'(-?\d+\.?\d*)\s*°?\s*([NS])?[\s,]*(-?\d+\.?\d*)\s*°?\s*([WE])?'
        match = re.search(decimal_pattern, coord_string)
        if match:
            lat, ns, lng, ew = match.groups()
            lat = float(lat) * (-1 if ns == 'S' else 1)
            lng = float(lng) * (-1 if ew == 'W' else 1)
            return lat, lng
    except:
        return None
    
    return None

def strip_unit(address: str) -> str:
    """
    Remove suite/unit/floor parts (e.g. "Suite 103", "#2") that Nominatim often can't match
    """
    return re.sub(
        r'\s*,?\s*(\b(suite|unit|apt|floor)\b\.?\s*#?|#)\s*[\w-]+',
        '',
        address,
        flags=re.IGNORECASE
    )

def geocode_address(address: str, cache: Dict) -> Optional[Tuple[float, float]]:
    """
    Geocode an address using Nominatim, with caching
    """
    print(f"Geocoding address: {address}")
    if address in cache:
        return cache[address]['lat'], cache[address]['lng']

    # If the full address finds nothing, retry without the suite/unit
    queries = [address]
    if strip_unit(address) != address:
        queries.append(strip_unit(address))

    for query in queries:
        try:
            # Respect Nominatim's usage policy with a 1-second delay
            time.sleep(1.2)

            response = requests.get(
                'https://nominatim.openstreetmap.org/search',
                params={
                    'q': query,
                    'format': 'json',
                    'limit': 1
                },
                headers={'User-Agent': 'IsasMatchaTierList/1.0'}
            )
            response.raise_for_status()
            data = response.json()

            if data:
                lat = float(data[0]['lat'])
                lng = float(data[0]['lon'])
                cache[address] = {'lat': lat, 'lng': lng}
                return lat, lng
            else:
                print(f"No results found for address: {query}")
        except Exception as e:
            print(f"Geocoding error for {query}: {str(e)}")

    return None

def load_cache(path: Path) -> Dict:
    """
    Load a JSON cache from file
    """
    if path.exists():
        try:
            with path.open('r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_cache(path: Path, cache: Dict):
    """
    Save a JSON cache to file
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

def parse_city(address: str) -> Optional[str]:
    """
    Read the city from a Google Maps address, e.g. 'Pittsburgh' from
    '4709 Liberty Ave, Pittsburgh, PA 15224' or 'Stockholm' from 'Sturegatan 8, 114 35 Stockholm, Sweden'
    """
    parts = [p.strip() for p in address.split(',')]
    if len(parts) < 2:
        return None

    if re.fullmatch(r'[A-Z]{2} \d{5}(-\d{4})?', parts[-1]):
        # US: "..., City, ST 12345"
        city = parts[-2]
    elif parts[0] == 'Japan':
        # Japan, largest unit first: "Japan, 〒104-0061 Tokyo, Chuo City, ..."
        city = re.sub(r'^〒[\d-]+\s*', '', parts[1])
    elif match := re.fullmatch(r'[\d -]*\d\s+(\D+)', parts[-2]):
        # Most of Europe: "..., 114 35 Stockholm, Sweden"
        city = match.group(1)
    else:
        return None

    return METRO_AREAS.get(city, city) or None

def lookup_country(lat: float, lng: float, cache: Dict) -> Optional[str]:
    """
    Name the country at a point with Nominatim, for places whose address doesn't give a city
    """
    key = f"{lat:.3f},{lng:.3f}"
    if key in cache:
        return cache[key]

    try:
        time.sleep(1.2)
        response = requests.get(
            'https://nominatim.openstreetmap.org/reverse',
            params={'lat': lat, 'lon': lng, 'format': 'json', 'zoom': 3, 'accept-language': 'en'},
            headers={'User-Agent': 'IsasMatchaTierList/1.0'}
        )
        response.raise_for_status()
        country = response.json().get('address', {}).get('country')
    except Exception as e:
        print(f"Country lookup error for {key}: {str(e)}")
        return None

    cache[key] = country
    return country

def parse_photo_date(value: str) -> Optional[str]:
    """
    Turn a photo's capture time as Drive reports it from EXIF ('2024:11:18 14:03:22', or ISO
    '2024-11-18T14:03:22Z') into an ISO date. Cameras record local time, so the date is the day
    it was taken where it was taken
    """
    match = re.match(r'(\d{4})[:-](\d{2})[:-](\d{2})', (value or '').strip())
    if not match:
        return None
    try:
        return datetime(*map(int, match.groups())).date().isoformat()
    except ValueError:
        # Cameras without a set clock write "0000:00:00"
        return None

def photo_taken_date(service, file_id: str, cache: Dict) -> Optional[str]:
    """
    Ask Drive when a photo was taken (from its EXIF), cached by file ID. Works for photos whose
    resized copy is cached too, since it reads Drive's metadata rather than the file
    """
    if file_id in cache:
        return cache[file_id]
    try:
        metadata = service.files().get(fileId=file_id, fields='imageMediaMetadata(time)').execute()
        taken = parse_photo_date(metadata.get('imageMediaMetadata', {}).get('time', ''))
    except Exception as e:
        print(f"Couldn't read when photo {file_id} was taken: {str(e)}")
        return None
    cache[file_id] = taken
    return taken

def visit_date(photo_date: Optional[str], reviewed: Optional[str]) -> Tuple[Optional[str], str]:
    """
    The day Isa went and where that came from: when the photo was taken ('photo'), unless that's
    after the review was submitted (a wrong camera clock), else the day she submitted it ('review')
    """
    if photo_date and (not reviewed or photo_date <= reviewed):
        return photo_date, 'photo'
    return reviewed, 'review'

def describe_photo_date(photo_date: Optional[str], reviewed: Optional[str]) -> str:
    """
    One line for the run log about a review's photo date, so each receipt's date can be checked
    """
    if not photo_date:
        return 'no capture date in its metadata, so the receipt shows the submission date'
    if reviewed and photo_date > reviewed:
        return f'taken {photo_date}, after the review was submitted ({reviewed}), so that date is ignored'
    return f'taken {photo_date}'

def report_undated_photos(names: List[str]):
    """
    List photos without a capture date in the run summary. Not a warning: it's normal for photos
    that went through a messaging app or a screenshot
    """
    summary_path = os.getenv('GITHUB_STEP_SUMMARY')
    if names and summary_path:
        with open(summary_path, 'a', encoding='utf-8') as f:
            f.write("### Photos without a capture date (their receipts show the submission date)\n\n")
            f.write(''.join(f"- {name}\n" for name in names))

def parse_timestamp(value: str) -> Optional[str]:
    """
    Turn the form's Timestamp cell (e.g. '10/5/2026 14:03:22') into an ISO date
    """
    try:
        return datetime.strptime(value, '%m/%d/%Y %H:%M:%S').date().isoformat()
    except ValueError:
        return None

def parse_tier(tier_cell: str, plus_cell: str) -> str:
    """
    Combine the tier and plus columns into a grade like 'A+'. Accepts 'A+' typed in the tier
    column too. The site only knows the six tiers, so anything else raises ValueError
    """
    tier = tier_cell.strip().upper()
    is_plus = tier.endswith('+') or '+' in plus_cell
    tier = tier.rstrip('+')
    if tier not in VALID_TIERS:
        raise ValueError(f"Unknown tier rating '{tier}'")
    return tier + '+' if is_plus else tier

def check_columns(headers: List[str]) -> Tuple[List[str], List[str]]:
    """
    Return the (required, optional) columns missing from the sheet's header row
    """
    present = {header.strip() for header in headers}
    return (
        [column for column in REQUIRED_COLUMNS if column not in present],
        [column for column in OPTIONAL_COLUMNS if column not in present],
    )

def find_empty_fields(places: List[Dict]) -> List[str]:
    """
    Describe fields that are empty on most reviews, which usually means their column was renamed
    """
    if len(places) < 5:
        return []
    problems = []
    for field, column in USUALLY_FILLED.items():
        empty = sum(1 for place in places if not place.get(field))
        if empty / len(places) >= 0.8:
            problems.append(f"{empty} of {len(places)} reviews have no '{column}'. Was that form question renamed?")
    return problems

def report_warnings(title: str, heading: str, messages: List[str]):
    """
    Surface problems in the GitHub Actions UI and run summary, so they aren't buried in the log
    """
    for message in messages:
        print(f"::warning title={title}::{message}")

    summary_path = os.getenv('GITHUB_STEP_SUMMARY')
    if summary_path:
        with open(summary_path, 'a', encoding='utf-8') as f:
            f.write(f"### {heading}\n\n")
            f.write(''.join(f"- {message}\n" for message in messages))

def report_skipped_rows(errors: List[str]):
    report_warnings('Skipped a review', 'Reviews skipped (not on the site)', errors)

def fetch_and_process_data():
    """
    Fetch data from Google Sheets and process coordinates and images
    """
    # Load the geocoding caches
    coordinates_cache = load_cache(COORDINATES_CACHE_PATH)
    countries_cache = load_cache(COUNTRIES_CACHE_PATH)
    photo_dates_cache = load_cache(PHOTO_DATES_CACHE_PATH)
    
    # Set up Google Sheets and Drive authentication
    scopes = [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
    ]

    credentials = Credentials.from_service_account_file(
        'credentials.json', scopes=scopes)
    
    # Initialize Google Sheets client
    sheets_client = gspread.authorize(credentials)
    
    # Initialize Google Drive service
    drive_service = build('drive', 'v3', credentials=credentials)

    # Open the spreadsheet
    sheet = sheets_client.open_by_key(os.getenv('SHEET_ID')).sheet1

    # Stop before publishing if a renamed form question took a required column with it; the
    # live site keeps its last good version
    missing_required, missing_optional = check_columns(sheet.row_values(1))
    if missing_required:
        raise ValueError(f"The sheet has no {', '.join(repr(c) for c in missing_required)} column. Was a form question renamed?")
    if missing_optional:
        report_warnings('Missing sheet column', 'Sheet columns not found (those fields are empty on the site)', [
            f"No '{column}' column. Was that form question renamed?" for column in missing_optional
        ])

    # Get all records
    records = sheet.get_all_records()
    processed_places = []
    errors = []
    
    # Track which images we've already downloaded
    processed_images = set()
    photos_dated = 0
    undated_photos = []
    address_column = 'Address (copied from Google Maps)'
    
    for idx, record in enumerate(records):
        place_name = get_field(record, 'Place Name')
        address = get_field(record, address_column)
        try:
            # Skip empty rows
            if not place_name:
                continue

            print(f"\nProcessing row {idx + 2}: {place_name}")

            # Try to parse coordinates first
            latlong_coordinates = parse_coordinates(get_field(record, 'Lat/Long from Google Maps'))

            # If address column, override coordinates with geocoding
            if address:
                address_coordinates = geocode_address(address, coordinates_cache)
            else:
                address_coordinates = None

            # Prefer address coordinates if available
            if address_coordinates:
                print(f"Using geocoded coordinates for {place_name} ({address}): {address_coordinates}")
                coordinates = address_coordinates
            elif latlong_coordinates:
                print(f"Using lat/long coordinates for {place_name}: {latlong_coordinates}")
                coordinates = latlong_coordinates
            else:
                coordinates = None
            
            # If we still don't have coordinates, log an error and skip
            if not coordinates:
                raise ValueError("Could not determine coordinates from input")

            lat, lng = coordinates

            tier_rating = parse_tier(get_field(record, 'Tier Rating'), get_field(record, 'Add a plus (e.g., B+)'))

            # Extract file ID from the image URL/ID
            image_fields = None
            photo_date = None
            image_url = get_field(record, 'Upload a picture!')

            if image_url:
                file_id = extract_file_id(image_url)
                if file_id:
                    if file_id not in processed_images:
                        image_fields = download_and_save_image(
                            drive_service,
                            file_id,
                            place_name
                        )
                        if image_fields:
                            processed_images.add(file_id)
                            photo_date = photo_taken_date(drive_service, file_id, photo_dates_cache)
                else:
                    print(f"Could not extract valid file ID from URL for {place_name}: {image_url}")

            city = (parse_city(address) if address else None) or lookup_country(lat, lng, countries_cache)
            reviewed = parse_timestamp(get_field(record, 'Timestamp'))
            visited, visited_from = visit_date(photo_date, reviewed)
            if image_fields:
                print(f"Photo for {place_name}: {describe_photo_date(photo_date, reviewed)}")
                if photo_date:
                    photos_dated += 1
                else:
                    undated_photos.append(place_name)

            processed_place = {
                'id': idx,
                'name': place_name,
                'tier': tier_rating,
                'ordered': get_field(record, 'What did you order?'),
                'notes': get_field(record, 'Notes'),
                'imagePath': None,  # Stays None if no image or download failed
                **(image_fields or {}),
                'lat': lat,
                'lng': lng,
                'city': city,
                'reviewed': reviewed,
                'visited': visited,
                # 'photo' when the date is when the photo was taken, 'review' when it's the submission date
                'visitedFrom': visited_from,
                'lastUpdated': datetime.now().isoformat(),
            }

            # Add address if available
            if address_column in record:
                processed_place['address'] = address

            processed_places.append(processed_place)
            print(f"Successfully processed {place_name}")

        except Exception as e:
            error_msg = f"Row {idx + 2} ({place_name}): {str(e)}"
            errors.append(error_msg)
            print(error_msg)
            continue

    # Save the updated geocoding caches
    save_cache(COORDINATES_CACHE_PATH, coordinates_cache)
    save_cache(COUNTRIES_CACHE_PATH, countries_cache)
    save_cache(PHOTO_DATES_CACHE_PATH, photo_dates_cache)

    if errors:
        print("\nProcessing completed with errors:")
        for error in errors:
            print(f"- {error}")
        report_skipped_rows(errors)

    report_undated_photos(undated_photos)

    empty_fields = find_empty_fields(processed_places)
    if empty_fields:
        report_warnings('Mostly empty field', 'Fields empty on most reviews', empty_fields)

    # Save to public folder instead of src
    output_path = Path('public/data/places.json')
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Add error handling for file writing
    try:
        with output_path.open('w', encoding='utf-8') as f:
            json.dump(processed_places, f, indent=2, ensure_ascii=False)
        print(f"\nSuccessfully saved data to {output_path}")
    except Exception as e:
        print(f"Error saving JSON file: {e}")
        raise
    
    print(f"\nProcessed {len(processed_places)} places successfully")
    print(f"Downloaded {len(processed_images)} images, {photos_dated} with the date they were taken")
    print(f"Cached {len(coordinates_cache)} coordinates")
    print(f"Skipped {len(errors)} places due to errors")

if __name__ == "__main__":
    try:
        fetch_and_process_data()
    except Exception as e:
        print(f"Fatal error: {e}")
        raise