"""将封面居中裁切并压缩为 1200×280 WebP 卡片图。"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

from spica_core import SpicaError, configure_console, parse_input_path


CARD_SIZE = (1200, 280)
WEBP_QUALITY = 82
WEBP_METHOD = 6


def create_card_bytes(source: Path) -> bytes:
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise SpicaError(
            "缺少 Pillow。请运行：python -m pip install -r tools/requirements.txt"
        ) from exc
    try:
        with Image.open(source) as image:
            image.load()
            normalized = ImageOps.exif_transpose(image)
            if normalized.mode not in {"RGB", "RGBA"}:
                normalized = normalized.convert("RGBA" if "A" in normalized.getbands() else "RGB")
            card = ImageOps.fit(
                normalized,
                CARD_SIZE,
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            output = io.BytesIO()
            card.save(output, format="WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
            data = output.getvalue()
        with Image.open(io.BytesIO(data)) as verification:
            if verification.size != CARD_SIZE or verification.format != "WEBP":
                raise SpicaError("生成的卡片图片未通过尺寸或格式验证。")
        return data
    except SpicaError:
        raise
    except Exception as exc:
        raise SpicaError(f"无法读取或处理图像 {source}：{exc}") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="居中裁切为 1200×280 并输出 WebP。")
    parser.add_argument("input", help="输入图像")
    parser.add_argument("output", help="输出 .webp 文件")
    parser.add_argument("--overwrite", action="store_true", help="允许覆盖已有输出文件")
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_console()
    args = build_parser().parse_args(argv)
    try:
        source = parse_input_path(args.input)
        output = parse_input_path(args.output, must_exist=False)
        if output.suffix.casefold() != ".webp":
            raise SpicaError("输出文件必须使用 .webp 扩展名。")
        if output.exists() and not args.overwrite:
            raise SpicaError(f"输出文件已经存在：{output}（使用 --overwrite 才可覆盖）")
        data = create_card_bytes(source)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
        print(f"处理完成：{output}（1200×280 WebP）")
        return 0
    except SpicaError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

