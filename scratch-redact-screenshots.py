from PIL import Image, ImageDraw

jobs = [
    # (file, [(x0,y0,x1,y1), ...] boxes to black out)
    ("discovery-evidence/03-email-filled.png", [(700, 348, 1082, 392)]),
    ("discovery-evidence/12-otp-screen.png", [(697, 320, 1082, 342)]),
    ("discovery-evidence/10-settings.png", [(409, 388, 871, 421)]),
]

for path, boxes in jobs:
    im = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(im)
    for box in boxes:
        draw.rectangle(box, fill=(0, 0, 0))
    im.save(path)
    print(f"Redacted {path} with boxes {boxes}")
