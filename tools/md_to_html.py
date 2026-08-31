"""把 Markdown/TXT 的每个非空文本行加工成基础 HTML 段落。"""

from __future__ import annotations

import argparse
import html
import sys
from pathlib import Path

from spica_core import SpicaError, configure_console, parse_input_path, read_source_text


def convert_text(text: str, *, allow_html: bool = False) -> str:
    paragraphs: list[str] = []
    for line in text.splitlines():
        if not line.strip():
            continue
        content = line if allow_html else html.escape(line, quote=False)
        paragraphs.append(f"<p>　　{content}</p>")
    return "\n".join(paragraphs)


def convert_file(path: Path, *, allow_html: bool = False) -> str:
    return convert_text(read_source_text(path), allow_html=allow_html)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="把 .md/.txt 中每个非空行包裹为 <p>...</p>。"
    )
    parser.add_argument("input", help="输入的 .md 或 .txt 文件")
    parser.add_argument("-o", "--output", help="输出 HTML；省略时输出到终端")
    parser.add_argument(
        "--allow-html",
        action="store_true",
        help="保留输入中的原始 HTML；默认会转义可能破坏页面的符号",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_console()
    args = build_parser().parse_args(argv)
    try:
        source = parse_input_path(args.input)
        result = convert_file(source, allow_html=args.allow_html)
        if args.output:
            output = parse_input_path(args.output, must_exist=False)
            if output.exists() and output.is_dir():
                raise SpicaError(f"输出路径是文件夹：{output}")
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(result, encoding="utf-8")
            print(f"处理完成：{output}")
        else:
            print(result)
        return 0
    except SpicaError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
