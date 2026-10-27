# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools>=4.50", "brotli"]
# ///
"""
Rune Serif as the site serves it. src/fonts/full/ holds the Latin subset of Source Serif 4 with
every OpenType layout feature (public/fonts/FONTLOG.txt); this keeps all of its characters and
both axes (weight and optical size) and drops the layout features the site never turns on,
writing src/fonts/. The features kept are src/fonts/subset.json's, which src/fonts/subset.test.ts
checks against the CSS.

    uv run scripts/fonts/subset.py
"""
import json
import pathlib

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
FONTS = ROOT / "src" / "fonts"
FACES = ["RuneSerif-Roman.var.woff2", "RuneSerif-Italic.var.woff2"]

features = json.loads((FONTS / "subset.json").read_text())["features"]
for name in FACES:
    source = FONTS / "full" / name
    # The source's own timestamp, so the same source and features always write the same bytes.
    font = TTFont(source, recalcTimestamp=False)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = features
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.glyph_names = False
    options.hinting = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=font.getBestCmap().keys())
    subsetter.subset(font)
    font.flavor = "woff2"
    out = FONTS / name
    font.save(out)
    print(f"{out.relative_to(ROOT)}: {source.stat().st_size} -> {out.stat().st_size} bytes, {len(font.getGlyphOrder())} glyphs")
