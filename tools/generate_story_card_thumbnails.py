"""Generate the compact story-directory cover thumbnails.

The original artwork remains untouched for story pages.  Directory cards use a
center-cropped 1200x280 WebP, matching the largest 2x card display area.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
STORY_IMAGES = ROOT / "images" / "histoire"
OUTPUT_DIR = STORY_IMAGES / "cards"
DATA_FILE = ROOT / "json" / "histoire.json"
SIZE = (1200, 280)


def card_path(cover_image: str) -> Path:
    source = ROOT / cover_image.lstrip("/")
    relative = source.relative_to(STORY_IMAGES)
    return (OUTPUT_DIR / relative).with_suffix(".webp")


def covers() -> list[str]:
    entries = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return [entry["cover_image"] for entry in entries if entry.get("cover_image")]


def generate(cover_image: str) -> Path:
    source = ROOT / cover_image.lstrip("/")
    target = card_path(cover_image)
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        thumbnail = ImageOps.fit(
            image,
            SIZE,
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        thumbnail.save(target, "WEBP", quality=84, method=6)
    return target


def check(cover_image: str) -> str | None:
    target = card_path(cover_image)
    if not target.is_file():
        return f"missing: {target.relative_to(ROOT)}"
    with Image.open(target) as image:
        if image.size != SIZE:
            return f"wrong size {image.size}: {target.relative_to(ROOT)}"
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify generated files only")
    args = parser.parse_args()
    source_covers = covers()

    if args.check:
        problems = [problem for cover in source_covers if (problem := check(cover))]
        if problems:
            print("\n".join(problems))
            return 1
        print(f"OK: {len(source_covers)} story card thumbnails at {SIZE[0]}x{SIZE[1]}.")
        return 0

    generated = [generate(cover) for cover in source_covers]
    total_bytes = sum(path.stat().st_size for path in generated)
    print(f"Generated {len(generated)} story card thumbnails: {total_bytes / 1024:.1f} KiB.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
