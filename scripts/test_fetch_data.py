"""
Unit tests for the pure parts of fetch_data.py: run with `pytest scripts`
"""
import pytest
from PIL import Image

import fetch_data as fd


@pytest.mark.parametrize('address, city', [
    ('4709 Liberty Ave, Pittsburgh, PA 15224', 'Pittsburgh'),
    ('Wean Hall, Hamerschlag Dr, Pittsburgh, PA 15213', 'Pittsburgh'),
    ('1600 Pennsylvania Avenue NW, Washington, DC 20500', 'Washington'),
    ('578 Driggs Ave, Brooklyn, NY 11211', 'New York'),
    ('27-53 Jackson Ave, Long Island City, NY 11101', 'New York'),
    ('767 Centre St, Jamaica Plain, MA 02130', 'Boston'),
    ('16051 Cleveland St, Redmond, WA 98052', 'Seattle'),
    ('1234 Main St, Austin, TX 78701-1234', 'Austin'),
    ('Sturegatan 8, 114 35 Stockholm, Sweden', 'Stockholm'),
    ('Japan, 〒104-0061 Tokyo, Chuo City, Ginza, 6 Chome−9−5 ギンザコマツ東館 12F', 'Tokyo'),
])
def test_parse_city(address, city):
    assert fd.parse_city(address) == city


@pytest.mark.parametrize('address', [
    '',
    'Pittsburgh',
    # UK postcodes follow the city, which the parser doesn't handle; these fall back to the country
    '221B Baker St, London NW1 6XE, UK',
])
def test_parse_city_gives_up(address):
    assert fd.parse_city(address) is None


@pytest.mark.parametrize('address, stripped', [
    ('3531 Washington St Suite 103, Jamaica Plain, MA 02130', '3531 Washington St, Jamaica Plain, MA 02130'),
    ('123 Main St #2, Pittsburgh, PA 15213', '123 Main St, Pittsburgh, PA 15213'),
    ('5 Elm St Unit B, Boston, MA 02115', '5 Elm St, Boston, MA 02115'),
    # FL is Florida and Ste is Sainte, not a floor or a suite
    ('1235 E Colonial Dr, Orlando, FL 32803', '1235 E Colonial Dr, Orlando, FL 32803'),
    ('100 Rue Ste-Catherine, Montreal, QC', '100 Rue Ste-Catherine, Montreal, QC'),
])
def test_strip_unit(address, stripped):
    assert fd.strip_unit(address) == stripped


@pytest.mark.parametrize('address, without_city', [
    ('101 Edgewood Ave, Pittsburgh, PA 15218', '101 Edgewood Ave, PA 15218'),
    ('Wean Hall, Hamerschlag Dr, Pittsburgh, PA 15213', 'Wean Hall, Hamerschlag Dr, PA 15213'),
    ('1234 Main St, Austin, TX 78701-1234', '1234 Main St, TX 78701-1234'),
    # Only US addresses with a state and ZIP
    ('Sturegatan 8, 114 35 Stockholm, Sweden', 'Sturegatan 8, 114 35 Stockholm, Sweden'),
    ('Pittsburgh, PA 15213', 'Pittsburgh, PA 15213'),
])
def test_drop_us_city(address, without_city):
    assert fd.drop_us_city(address) == without_city


@pytest.mark.parametrize('cells, grade', [
    (('A', ''), 'A'),
    (('a', ''), 'A'),
    ((' b ', '+'), 'B+'),
    (('C+', ''), 'C+'),
    (('C+', '+'), 'C+'),
    (('S', 'Add a plus +'), 'S+'),
])
def test_parse_tier(cells, grade):
    assert fd.parse_tier(*cells) == grade


@pytest.mark.parametrize('tier', ['', 'E', 'G', 'A-', 'AA'])
def test_parse_tier_rejects_unknown(tier):
    with pytest.raises(ValueError):
        fd.parse_tier(tier, '')


def test_parse_timestamp():
    assert fd.parse_timestamp('10/5/2026 14:03:22') == '2026-10-05'
    assert fd.parse_timestamp('1/9/2025 9:41:07') == '2025-01-09'
    assert fd.parse_timestamp('') is None
    assert fd.parse_timestamp('yesterday') is None


def test_parse_photo_date():
    assert fd.parse_photo_date('2024:11:18 14:03:22') == '2024-11-18'
    assert fd.parse_photo_date('2024-11-18T23:59:59Z') == '2024-11-18'
    assert fd.parse_photo_date('0000:00:00 00:00:00') is None
    assert fd.parse_photo_date('') is None
    assert fd.parse_photo_date(None) is None


def test_parse_entered_date():
    assert fd.parse_entered_date('10/5/2026') == '2026-10-05'
    assert fd.parse_entered_date('2026-10-05') == '2026-10-05'
    assert fd.parse_entered_date('10/5/26') == '2026-10-05'
    assert fd.parse_entered_date(' 1/9/2025 ') == '2025-01-09'
    assert fd.parse_entered_date('') is None
    assert fd.parse_entered_date('last Tuesday') is None


def test_visit_date():
    # A date Isa entered wins, then the photo's, since she often reviews days after going
    assert fd.visit_date('2025-01-01', '2025-01-02', '2025-01-09') == ('2025-01-01', 'entered')
    assert fd.visit_date(None, '2025-01-02', '2025-01-09') == ('2025-01-02', 'photo')
    assert fd.visit_date(None, '2025-01-09', '2025-01-09') == ('2025-01-09', 'photo')
    # A date after the review was submitted is a typo or a wrong camera clock
    assert fd.visit_date('2031-01-01', '2025-01-02', '2025-01-09') == ('2025-01-02', 'photo')
    assert fd.visit_date(None, '2031-01-01', '2025-01-09') == ('2025-01-09', 'review')
    assert fd.visit_date(None, None, '2025-01-09') == ('2025-01-09', 'review')
    assert fd.visit_date(None, '2025-01-02', None) == ('2025-01-02', 'photo')
    assert fd.visit_date(None, None, None) == (None, 'review')


def test_describe_photo_date():
    assert fd.describe_photo_date('2025-01-02', '2025-01-09') == 'taken 2025-01-02'
    assert 'no capture date' in fd.describe_photo_date(None, '2025-01-09')
    assert 'ignored' in fd.describe_photo_date('2031-01-01', '2025-01-09')


def test_get_field():
    record = {'Place Name': '  Haan Coffee ', 'Tier Rating': 5}
    assert fd.get_field(record, 'Place Name') == 'Haan Coffee'
    # gspread returns numbers for numeric-looking cells
    assert fd.get_field(record, 'Tier Rating') == '5'
    assert fd.get_field(record, 'Notes') == ''


@pytest.mark.parametrize('url, file_id', [
    ('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'),
    ('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'),
    ('1AbCdEfGhIjKlMnOpQrStUvWxYz012345', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'),
    ('https://example.com/photo.jpg', None),
    ('', None),
])
def test_extract_file_id(url, file_id):
    assert fd.extract_file_id(url) == file_id


def test_parse_coordinates():
    assert fd.parse_coordinates('40.4406, -79.9959') == (40.4406, -79.9959)
    lat, lng = fd.parse_coordinates('''37°46'29.7"N 122°25'09.9"W''')
    assert lat == pytest.approx(37.77492, abs=1e-4)
    assert lng == pytest.approx(-122.41942, abs=1e-4)
    assert fd.parse_coordinates('37.7749° N, 122.4194° W') == (37.7749, -122.4194)
    assert fd.parse_coordinates('') is None
    assert fd.parse_coordinates('somewhere nice') is None


def test_safe_filename_is_stable():
    name = fd.get_safe_filename("Nana's Green Tea", 'abc123')
    assert name == fd.get_safe_filename("Nana's Green Tea", 'abc123')
    assert name.startswith('nana-s-green-tea-') and name.endswith('.jpg')


def test_resize_image_applies_rotation_and_shrinks(tmp_path):
    # A landscape photo tagged "rotate 90°", the way phones save portrait shots
    source = tmp_path / 'phone.jpg'
    exif = Image.Exif()
    exif[0x0112] = 6
    Image.new('RGB', (2000, 1000), 'green').save(source, exif=exif)

    assert fd.resize_image(source, tmp_path / 'large.jpg') == (800, 1600)
    assert fd.resize_image(source, tmp_path / 'thumb.jpg', fd.THUMB_SIZE, quality=78) == (240, 480)
    with Image.open(tmp_path / 'thumb.jpg') as thumb:
        assert thumb.size == (240, 480)


def test_check_columns():
    headers = ['Timestamp', 'Place Name', 'Tier Rating', 'Notes']
    missing_required, missing_optional = fd.check_columns(headers)
    assert missing_required == []
    assert 'Upload a picture!' in missing_optional and 'Notes' not in missing_optional

    missing_required, _ = fd.check_columns(['Timestamp', 'Name of the place', 'Tier Rating'])
    assert missing_required == ['Place Name']


def test_find_empty_fields():
    filled = {'ordered': 'Iced matcha latte', 'notes': 'Yum', 'imagePath': 'images/a.jpg'}
    assert fd.find_empty_fields([filled] * 10) == []
    # A few reviews without photos is normal
    assert fd.find_empty_fields([filled] * 8 + [{**filled, 'imagePath': None}] * 2) == []
    # Every review losing its notes means the column was renamed
    problems = fd.find_empty_fields([{**filled, 'notes': ''}] * 10)
    assert len(problems) == 1 and "'Notes'" in problems[0]
    # Too few reviews to tell
    assert fd.find_empty_fields([{**filled, 'notes': ''}] * 3) == []
