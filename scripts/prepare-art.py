from pathlib import Path
from PIL import Image

GENERATED = Path(r"C:\Users\dinie\.codex\generated_images\019f9cf1-b807-76e3-8b27-62edaa7c7e99")
OUTPUT = Path("assets")

SHEETS = {
    "ember": (
        GENERATED / "call_TB8V4o1tNyCFniRrd7bSDGKF.png",
        ["sizzle-mittens", "candle-pounce", "toastie-toe-beans", "comet-claw", "teapot-tabby"],
    ),
    "gust": (
        GENERATED / "call_fh4tkGgefCO7eKz3rlW2Y2Pd.png",
        # This legacy source sheet still contains the retired Breeze Biscuit art.
        ["breeze-biscuit", "leafy-loaf", "whisker-whirl", "gale-groomer", "dandelion-dash"],
    ),
    "tide": (
        GENERATED / "call_cKRoMfgCR7xOnlRiZ8YdH885.png",
        # This legacy source sheet still contains retired Captain Catfish and
        # Drizzle Socks art.
        ["puddle-pouncer", "bubble-bengal", "moonpool-mouser", "captain-catfish", "drizzle-socks"],
    ),
}


def crop_grid(source: Path, names: list[str]) -> None:
    image = Image.open(source).convert("RGB")
    cell_width = image.width // 3
    cell_height = image.height // 2
    destination = OUTPUT / "cards"
    destination.mkdir(parents=True, exist_ok=True)

    for index, name in enumerate(names):
        column = index % 3
        row = index // 3
        padding = max(4, min(cell_width, cell_height) // 100)
        crop = image.crop(
            (
                column * cell_width + padding,
                row * cell_height + padding,
                (column + 1) * cell_width - padding,
                (row + 1) * cell_height - padding,
            )
        )
        crop.save(destination / f"{name}.webp", "WEBP", quality=88, method=6)


for _, (sheet, card_names) in SHEETS.items():
    crop_grid(sheet, card_names)

dandelion_dash = Image.open(
    GENERATED / "call_oP6u5ybyO5Z1BTsr5ai2KlPz.png"
).convert("RGB")
dandelion_dash.resize((768, 768), Image.Resampling.LANCZOS).save(
    OUTPUT / "cards" / "dandelion-dash.webp",
    "WEBP",
    quality=91,
    method=6,
)

empress_ebb = Image.open(
    GENERATED / "call_t9NcLcjys8bruCare3ARX6Kg.png"
).convert("RGB")
empress_ebb.resize((768, 768), Image.Resampling.LANCZOS).save(
    OUTPUT / "cards" / "empress-ebb.webp",
    "WEBP",
    quality=91,
    method=6,
)

portraits = Image.open(GENERATED / "call_gfmhK721DYsAVDk5d6xwcu8i.png").convert("RGB")
portrait_output = OUTPUT / "characters"
portrait_output.mkdir(parents=True, exist_ok=True)
midpoint = portraits.width // 2
portraits.crop((0, 0, midpoint, portraits.height)).save(
    portrait_output / "professor-paws.webp", "WEBP", quality=90, method=6
)
portraits.crop((midpoint, 0, portraits.width, portraits.height)).save(
    portrait_output / "rookie.webp", "WEBP", quality=90, method=6
)
