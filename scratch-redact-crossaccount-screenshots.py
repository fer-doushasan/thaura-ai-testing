from PIL import Image, ImageDraw

jobs = [
    ("discovery-evidence/crossaccount-otp-screen.png", [(790, 316, 1020, 344)]),
    ("discovery-evidence/crossaccount-after-otp.png", [
        (578, 172, 1036, 212),   # "Back at it, Ferdous Hasan" heading
        (60, 660, 188, 682),     # sidebar profile name
    ]),
]

for path, boxes in jobs:
    im = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(im)
    for box in boxes:
        draw.rectangle(box, fill=(0, 0, 0))
    im.save(path)
    print(f"Redacted {path} with boxes {boxes}")
