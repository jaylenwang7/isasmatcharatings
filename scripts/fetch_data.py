import re
import pandas as pd
from typing import Tuple, Dict, Optional
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
import os
import json
from pathlib import Path
import hashlib
from datetime import datetime
import requests
import time

def get_safe_filename(name: str, file_id: str) -> str:
    """
    Create a safe filename from the place name and file ID
    """
    # Clean the name to be filesystem-safe
    safe_name = re.sub(r'[^a-zA-Z0-9]', '-', name.lower())
    # Add timestamp and partial hash for uniqueness
    timestamp = datetime.now().strftime('%Y%m%d')
    file_hash = hashlib.md5(file_id.encode()).hexdigest()[:6]
    return f"{safe_name}-{timestamp}-{file_hash}.jpg"

def download_and_save_image(service, file_id: str, place_name: str) -> str:
    """
    Download image from Google Drive and save it to the repository
    Returns the path where the image was saved
    """
    try:
        # Create images directory if it doesn't exist
        images_dir = Path('public/images')
        images_dir.mkdir(parents=True, exist_ok=True)

        # Generate safe filename
        filename = get_safe_filename(place_name, file_id)
        file_path = images_dir / filename

        # Download file
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                print(f"Downloading {filename}: {int(status.progress() * 100)}%")

        # Save file
        fh.seek(0)
        with open(file_path, 'wb') as f:
            f.write(fh.read())

        return f"images/{filename}"

    except Exception as e:
        raise Exception(f"Error downloading image: {str(e)}")

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

        # Case 2: Decimal degrees with directions (37.7749° N, 122.4194° W)
        decimal_pattern = r'(-?\d+\.?\d*)\s*°?\s*([NS])?[\s,]*(-?\d+\.?\d*)\s*°?\s*([WE])?'
        match = re.search(decimal_pattern, coord_string)
        if match:
            lat, ns, lng, ew = match.groups()
            lat = float(lat) * (-1 if ns == 'S' else 1)
            lng = float(lng) * (-1 if ew == 'W' else 1)
            return lat, lng

        # Case 3: Degrees, minutes, seconds (37°46'29.7"N 122°25'09.9"W)
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
    except:
        return None
    
    return None

def geocode_address(address: str, cache: Dict) -> Optional[Tuple[float, float]]:
    """
    Geocode an address using Nominatim, with caching
    """
    print(f"Geocoding address: {address}")
    if address in cache:
        return cache[address]['lat'], cache[address]['lng']
    
    try:
        # Respect Nominatim's usage policy with a 1-second delay
        time.sleep(1.2)
        
        response = requests.get(
            'https://nominatim.openstreetmap.org/search',
            params={
                'q': address,
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
            print(f"No results found for address: {address}")
    except Exception as e:
        print(f"Geocoding error for {address}: {str(e)}")
    
    return None

def load_coordinates_cache() -> Dict:
    """
    Load the coordinates cache from file
    """
    cache_path = Path('public/data/coordinates-cache.json')
    if cache_path.exists():
        try:
            with cache_path.open('r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_coordinates_cache(cache: Dict):
    """
    Save the coordinates cache to file
    """
    cache_path = Path('public/data/coordinates-cache.json')
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with cache_path.open('w', encoding='utf-8') as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

def fetch_and_process_data():
    """
    Fetch data from Google Sheets and process coordinates and images
    """
    # Load the coordinates cache
    coordinates_cache = load_coordinates_cache()
    
    # Set up Google Sheets and Drive authentication
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive.readonly'
    ]
    
    credentials = ServiceAccountCredentials.from_json_keyfile_name(
        'credentials.json', scope)
    
    # Initialize Google Sheets client
    sheets_client = gspread.authorize(credentials)
    
    # Initialize Google Drive service
    drive_service = build('drive', 'v3', credentials=credentials)

    # Open the spreadsheet
    sheet = sheets_client.open_by_key(os.getenv('SHEET_ID')).sheet1
    
    # Get all records
    records = sheet.get_all_records()
    processed_places = []
    errors = []
    
    # Track which images we've already downloaded
    processed_images = set()
    address_column = 'Address (copied from Google Maps)'
    
    for idx, record in enumerate(records):
        try:
            # Skip empty rows
            if not record['Place Name'].strip():
                continue

            # Try to parse coordinates first
            coordinates = parse_coordinates(record['Lat/Long from Google Maps'])

            # If address column, override coordinates with geocoding
            if address_column in record and record[address_column].strip():
                coordinates = geocode_address(record[address_column], coordinates_cache)
            
            # If we still don't have coordinates, log an error and skip
            if not coordinates:
                raise ValueError("Could not determine coordinates from input")
                
            lat, lng = coordinates
            
            # Extract file ID from the image URL/ID
            image_url = record['Upload a picture!']
            file_id = image_url.split('=')[-1] if '=' in image_url else image_url
            
            # Download image if we haven't already
            if file_id not in processed_images:
                image_path = download_and_save_image(
                    drive_service, 
                    file_id,
                    record['Place Name']
                )
                processed_images.add(file_id)
            
            processed_place = {
                'id': idx,
                'name': record['Place Name'].strip(),
                'tier': record['Tier Rating'].strip().upper(),
                'ordered': record['What did you order?'].strip(),
                'notes': record['Notes'].strip(),
                'imagePath': image_path,
                'lat': lat,
                'lng': lng,
                'lastUpdated': pd.Timestamp.now().isoformat()
            }
            
            # Add address if available
            if address_column in record:
                processed_place['address'] = record[address_column].strip()
            
            processed_places.append(processed_place)
            print(f"Successfully processed {record['Place Name']}")
            
        except Exception as e:
            error_msg = f"Error in row {idx + 2}: {str(e)}"
            errors.append(error_msg)
            print(error_msg)
            continue
    
    # Save the updated coordinates cache
    save_coordinates_cache(coordinates_cache)
    
    if errors:
        print("\nProcessing completed with errors:")
        for error in errors:
            print(f"- {error}")
    
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
    print(f"Downloaded {len(processed_images)} images")
    print(f"Cached {len(coordinates_cache)} coordinates")
    print(f"Skipped {len(errors)} places due to errors")

if __name__ == "__main__":
    try:
        fetch_and_process_data()
    except Exception as e:
        print(f"Fatal error: {e}")
        raise