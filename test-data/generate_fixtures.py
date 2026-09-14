"""
Generates deterministic local test fixtures for file-upload testing.
Every "valid" fixture embeds a distinctive, made-up marker string/number so
extraction accuracy can be checked against a known ground truth (not
something a model could plausibly guess or already know).
"""
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import openpyxl
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter

BASE = os.path.dirname(os.path.abspath(__file__))
VALID = os.path.join(BASE, 'valid')
INVALID = os.path.join(BASE, 'invalid')
BOUNDARY = os.path.join(BASE, 'boundary')

PDF_MARKER = "QA-DOC-MARKER-71934"
XLSX_MARKER = "QA-CELL-MARKER-58201"
IMG_MARKER = "QA-IMG-MARKER-30457"

# --- valid/sample.pdf ---
pdf_path = os.path.join(VALID, 'sample.pdf')
c = canvas.Canvas(pdf_path, pagesize=letter)
c.setFont("Helvetica", 14)
c.drawString(72, 700, "Thaura QA Assessment - Test Document")
c.drawString(72, 670, f"Verification marker: {PDF_MARKER}")
c.drawString(72, 640, "This is a deterministic fixture for extraction-accuracy testing.")
c.drawString(72, 610, "Line item total: $4,217.63")
c.save()
print("Created", pdf_path)

# --- valid/sample.xlsx ---
xlsx_path = os.path.join(VALID, 'sample.xlsx')
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "QA Data"
ws.append(["Name", "Score", "Marker"])
ws.append(["Alice", 91, XLSX_MARKER])
ws.append(["Bob", 77, ""])
ws.append(["Carol", 88, ""])
wb.save(xlsx_path)
print("Created", xlsx_path)

# --- valid/sample.png ---
png_path = os.path.join(VALID, 'sample.png')
img = Image.new('RGB', (600, 200), color=(255, 255, 255))
d = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
except Exception:
    font = ImageFont.load_default()
d.text((20, 80), f"Marker: {IMG_MARKER}", fill=(0, 0, 0), font=font)
img.save(png_path)
print("Created", png_path)

# --- invalid/empty.* ---
for ext in ['pdf', 'png', 'xlsx']:
    p = os.path.join(INVALID, f'empty.{ext}')
    open(p, 'wb').close()
    print("Created", p)

# --- invalid/corrupted.pdf (truncated valid PDF) ---
with open(pdf_path, 'rb') as f:
    data = f.read()
corrupted_pdf = os.path.join(INVALID, 'corrupted.pdf')
with open(corrupted_pdf, 'wb') as f:
    f.write(data[:len(data)//4])  # truncate to 25%, breaks internal xref/structure
print("Created", corrupted_pdf)

# --- invalid/corrupted.png (truncated valid PNG) ---
with open(png_path, 'rb') as f:
    data = f.read()
corrupted_png = os.path.join(INVALID, 'corrupted.png')
with open(corrupted_png, 'wb') as f:
    f.write(data[:len(data)//3])
print("Created", corrupted_png)

# --- invalid/password-protected.pdf ---
reader = PdfReader(pdf_path)
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)
FIXTURE_PASSWORD = "QaTestFixture123"  # test fixture only, not a real credential
writer.encrypt(FIXTURE_PASSWORD)
pw_pdf = os.path.join(INVALID, 'password-protected.pdf')
with open(pw_pdf, 'wb') as f:
    writer.write(f)
print("Created", pw_pdf, "(password:", FIXTURE_PASSWORD, ")")

# --- boundary: oversized files (valid PDF prefix + padding after %%EOF) ---
def make_oversized_pdf(target_mb, filename):
    target_bytes = target_mb * 1024 * 1024
    with open(pdf_path, 'rb') as f:
        base_data = f.read()
    pad_needed = max(0, target_bytes - len(base_data))
    path = os.path.join(BOUNDARY, filename)
    with open(path, 'wb') as f:
        f.write(base_data)
        f.write(b'\n%PADDING-FOR-SIZE-TEST-' + os.urandom(pad_needed))
    print("Created", path, f"~{os.path.getsize(path) / (1024*1024):.1f}MB")

make_oversized_pdf(8, 'oversized_8mb.pdf')
make_oversized_pdf(60, 'oversized_60mb.pdf')

print("\nDone. Markers for later verification:")
print("  PDF marker:", PDF_MARKER)
print("  XLSX marker:", XLSX_MARKER)
print("  IMG marker:", IMG_MARKER)
