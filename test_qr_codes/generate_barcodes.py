import os
from datetime import date
from pathlib import Path

from PIL import Image

import barcode
from barcode.writer import ImageWriter

import segno

# DataMatrix
from pylibdmtx.pylibdmtx import encode as dmtx_encode


OUTPUT_DIR = Path("barcode_test_outputs")


def ensure_outdir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def save_pil(img: Image.Image, filename: str) -> None:
    path = OUTPUT_DIR / filename
    img.save(path, format="PNG")


def gen_ean13(ean13_12_digits: str, filename_prefix: str) -> None:
    """
    EAN-13 requires 12 digits; the 13th is checksum (auto-calculated).
    """
    ensure_outdir()
    ean = barcode.get("ean13", ean13_12_digits, writer=ImageWriter())
    # python-barcode appends extension automatically
    out_path = OUTPUT_DIR / filename_prefix
    ean.save(str(out_path))


def gen_code128(data: str, filename_prefix: str) -> None:
    """
    Generic Code128. Useful for testing 1D barcode scanning.
    """
    ensure_outdir()
    code = barcode.get("code128", data, writer=ImageWriter())
    out_path = OUTPUT_DIR / filename_prefix
    code.save(str(out_path))


# def gen_qr(data: str, filename: str) -> None:
#     """
#     QR code generator using segno.
#     """
#     ensure_outdir()
#     qr = segno.make(data, error="m")  # medium error correction
#     qr.save(str(OUTPUT_DIR / filename), scale=8, border=2, kind="png")

def gen_qr(data: str, filename: str) -> None:
    """
    Generate a QR code optimized for real-world scanning:
    - Lower error correction to reduce density
    - Larger scale so each module has more pixels
    - Bigger quiet zone (border)
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    qr = segno.make(
        data,
        error="l",     # L = lowest EC -> least dense -> easiest to scan
        micro=False,   # ensure it's a normal QR (not Micro QR)
    )

    qr.save(
        str(OUTPUT_DIR / filename),
        scale=14,      # bigger = easier scanning from screens/camera
        border=6,      # quiet zone; many scanners want >= 4 modules
        kind="png"
    )


def gen_datamatrix(data: str, filename: str) -> None:
    """
    DataMatrix generator using pylibdmtx.
    Very common for marking codes / GS1 DataMatrix.
    """
    ensure_outdir()
    encoded = dmtx_encode(data.encode("utf-8"))
    img = Image.frombytes("RGB", (encoded.width, encoded.height), encoded.pixels)
    # enlarge for easier scanning-from-screen tests
    img = img.resize((img.width * 6, img.height * 6), Image.NEAREST)
    save_pil(img, filename)


def build_gs1_ai_string(gtin14: str, exp_yymmdd: str, lot: str, serial: str) -> str:
    """
    Human-readable GS1 AI string commonly printed as:
      (01)GTIN(17)EXP(10)LOT(21)SERIAL

    NOTE:
    - This is NOT the same as true GS1-128 encoding (which uses FNC1 and group separators).
    - Still useful as payload for QR/DataMatrix tests, and as "visual" string tests.
    """
    return f"(01){gtin14}(17){exp_yymmdd}(10){lot}(21){serial}"


def try_gen_true_gs1_128_with_zint(gs1_ai_string: str, filename: str) -> bool:
    """
    OPTIONAL: generate true GS1-128 using Zint if installed.

    This uses the `zint` CLI (recommended for correct GS1-128/FNC1 encoding).
    Install:
      - Linux: sudo apt-get install zint
      - Windows: install Zint and ensure zint.exe is in PATH
      - macOS: brew install zint

    Returns True if generated, else False.
    """
    import shutil
    import subprocess

    if shutil.which("zint") is None:
        return False

    out_path = OUTPUT_DIR / filename

    # Zint supports GS1-128 via symbology 128 with --gs1
    # --height can be increased for easier camera scanning
    cmd = [
        "zint",
        "--barcode=128",
        "--gs1",
        "--data", gs1_ai_string,
        "--output", str(out_path),
        "--scale=2",
        "--height=80",
    ]

    subprocess.run(cmd, check=True)
    return True


def main():
    ensure_outdir()

    # -------------------------
    # 1) EAN-13 (retail barcode)
    # -------------------------
    # Must be 12 digits. The 13th checksum is computed automatically.
    gen_ean13("460049469954", "ean13_460049469954")  # similar to your sample family

    # -------------------------
    # 2) Code128 basic samples
    # -------------------------
    gen_code128("4610044163836", "code128_13digits_like_ean")  # 13-digit string in Code128
    gen_code128("TEST-CODE128-ABC-123", "code128_text")

    # ---------------------------------------------------------
    # 3) GS1 AI payloads (good for QR/DataMatrix testing)
    # ---------------------------------------------------------
    gs1_payload_1 = build_gs1_ai_string(
        gtin14="04610044163836",  # 14 digits (leading 0 + EAN13)
        exp_yymmdd="251012",
        lot="271012",
        serial="601542709"
    )

    gs1_payload_2 = build_gs1_ai_string(
        gtin14="04600494699542",
        exp_yymmdd="260101",
        lot="BATCH-99",
        serial="000123456789"
    )

    # Generate Code128 containing GS1-like AI text (NOT true GS1-128 but useful baseline)
    gen_code128(gs1_payload_1, "code128_gs1_ai_like_1")
    gen_code128(gs1_payload_2, "code128_gs1_ai_like_2")

    # Generate QR from GS1 AI text
    gen_qr(gs1_payload_1, "qr_gs1_ai_like_1.png")
    gen_qr(gs1_payload_2, "qr_gs1_ai_like_2.png")

    # Generate DataMatrix from GS1 AI text (very relevant to your use case)
    gen_datamatrix(gs1_payload_1, "datamatrix_gs1_ai_like_1.png")
    gen_datamatrix(gs1_payload_2, "datamatrix_gs1_ai_like_2.png")

    # ---------------------------------------------------------
    # 4) OPTIONAL: True GS1-128 (FNC1) using Zint if available
    # ---------------------------------------------------------
    try:
        ok = try_gen_true_gs1_128_with_zint(gs1_payload_1, "gs1_128_true_1.png")
        if ok:
            print("Generated true GS1-128 via Zint: gs1_128_true_1.png")
        else:
            print("Zint not found. Skipped true GS1-128 generation. (Install zint to enable.)")
    except Exception as e:
        print("Tried Zint but failed:", str(e))

    print(f"Done. Files saved in: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()


# mkdir -p barcode_test_outputs

# zint --barcode=128 --gs1 \
#   --data "(01)04610044163836(17)251012(10)271012(21)601542709" \
#   --output barcode_test_outputs/gs1_128_true_cli.png \
#   --scale=3 --height=80