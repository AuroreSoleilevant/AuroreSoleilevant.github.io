"""扫描网站可渲染字符，从离线母版重建 Core/Extra WOFF2 子集。"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable

from spica_core import ChangeSet, ProjectPaths, SpicaError, configure_console
from spica_transaction import commit_changes, print_plan


IMPLEMENTED = True
MASTER_NAME = "LXGWWenKai.ttf"
LATIN_NAME = "LXGWWenKai-latin-symbols.woff2"
CORE_NAME = "LXGWWenKai-cjk-core.woff2"
EXTRA_NAME = "LXGWWenKai-cjk-site-extra.woff2"
SCAN_EXTENSIONS = {".html", ".json", ".js", ".css", ".svg"}
SKIP_DIRECTORIES = {".git", "tools", "fonts", "doc", "__pycache__", ".spica-cache"}
VISIBLE_ATTRIBUTES = {"alt", "title", "placeholder", "aria-label", "value"}
NON_RENDERED_TAGS = {"template", "noscript"}
CORE_PRIORITY_FILES = {
    "index.html",
    "outil/header.inc/index.html",
    "outil/footer.inc/index.html",
    "js/common-head.js",
    "js/list.js",
    "js/catalogue.js",
    "js/tagflow.js",
    "js/random-page.js",
    "js/json-tiles.js",
    "js/fade.js",
    "js/img.js",
    "js/theme.js",
    "js/mots.js",
    "js/backtop.js",
    "js/blink.js",
    "js/headtran.js",
    "js/mascot.js",
    "js/mirror-notice.js",
    "js/skip-link.js",
    "css/style.css",
    "css/mascot.css",
    "css/tuile.css",
    "css/morceau.css",
    "css/tagflow.css",
    "css/index.css",
}


class RenderedHtmlScanner(HTMLParser):
    """收集 HTML/SVG 会渲染的文本，并分离内联 JS/CSS。"""

    VOID_TAGS = {
        "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.visible: list[str] = []
        self.javascript: list[str] = []
        self.styles: list[str] = []
        self.stack: list[tuple[str, bool]] = []
        self.hidden_depth = 0
        self.capture: str | None = None

    @staticmethod
    def _is_hidden(attrs: dict[str, str | None]) -> bool:
        style = (attrs.get("style") or "").replace(" ", "").casefold()
        return (
            "hidden" in attrs
            or (attrs.get("aria-hidden") or "").casefold() == "true"
            or "display:none" in style
            or "visibility:hidden" in style
        )

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.casefold()
        attributes = {name.casefold(): value for name, value in attrs}
        hidden_here = self._is_hidden(attributes) or tag in NON_RENDERED_TAGS
        if hidden_here and tag not in self.VOID_TAGS:
            self.hidden_depth += 1
        if tag == "script":
            self.capture = "javascript"
        elif tag == "style":
            self.capture = "styles"
        elif not self.hidden_depth and not hidden_here:
            for name in VISIBLE_ATTRIBUTES:
                value = attributes.get(name)
                if value:
                    self.visible.append(value)
        if tag not in self.VOID_TAGS:
            self.stack.append((tag, hidden_here))

    def handle_startendtag(self, tag: str, attrs) -> None:
        attributes = {name.casefold(): value for name, value in attrs}
        if not self.hidden_depth and not self._is_hidden(attributes):
            for name in VISIBLE_ATTRIBUTES:
                value = attributes.get(name)
                if value:
                    self.visible.append(value)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.casefold()
        if tag in {"script", "style"}:
            self.capture = None
        for index in range(len(self.stack) - 1, -1, -1):
            opened, hidden_here = self.stack[index]
            if opened == tag:
                del self.stack[index:]
                if hidden_here and self.hidden_depth:
                    self.hidden_depth -= 1
                break

    def handle_data(self, data: str) -> None:
        if self.capture == "javascript":
            self.javascript.append(data)
        elif self.capture == "styles":
            self.styles.append(data)
        elif not self.hidden_depth:
            self.visible.append(data)


def _decode_escapes(value: str) -> str:
    value = re.sub(
        r"\\u\{([0-9A-Fa-f]{1,6})\}",
        lambda match: chr(int(match.group(1), 16)),
        value,
    )
    value = re.sub(
        r"\\u([0-9A-Fa-f]{4})",
        lambda match: chr(int(match.group(1), 16)),
        value,
    )
    value = re.sub(
        r"\\x([0-9A-Fa-f]{2})",
        lambda match: chr(int(match.group(1), 16)),
        value,
    )
    return value.replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t")


def extract_code_strings(source: str, *, javascript: bool) -> list[str]:
    """提取 JS/CSS 字符串，跳过 // 与 /* */ 注释。"""
    strings: list[str] = []
    index = 0
    length = len(source)
    while index < length:
        char = source[index]
        following = source[index + 1] if index + 1 < length else ""
        if char == "/" and following == "*":
            end = source.find("*/", index + 2)
            index = length if end < 0 else end + 2
            continue
        if javascript and char == "/" and following == "/":
            end = source.find("\n", index + 2)
            index = length if end < 0 else end + 1
            continue
        if char not in {"'", '"', "`"}:
            index += 1
            continue
        quote = char
        string_start = index
        index += 1
        buffer: list[str] = []
        while index < length:
            char = source[index]
            if char == "\\" and index + 1 < length:
                buffer.extend((char, source[index + 1]))
                index += 2
                continue
            if char == quote:
                index += 1
                break
            buffer.append(char)
            index += 1
        prefix = source[max(0, string_start - 100) : string_start]
        non_rendered_call = javascript and re.search(
            r"(?:console\.(?:log|warn|error|info|debug)|new\s+Error)\s*\(\s*$",
            prefix,
        )
        if not non_rendered_call:
            strings.append(_decode_escapes("".join(buffer)))
    return strings


def _json_strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from _json_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from _json_strings(child)


def _codepoints(strings: Iterable[str]) -> set[int]:
    return {ord(character) for text in strings for character in text}


def scan_file_text(relative: Path, text: str) -> tuple[set[int], set[int]]:
    """返回（全部可渲染字符，适合 Core 的字符）。"""
    suffix = relative.suffix.casefold()
    visible: list[str] = []
    global_ui: list[str] = []
    if suffix in {".html", ".svg"}:
        parser = RenderedHtmlScanner()
        try:
            parser.feed(text)
            parser.close()
        except Exception as exc:
            raise SpicaError(f"无法扫描可渲染文本：{relative}（{exc}）") from exc
        visible.extend(parser.visible)
        js_strings = extract_code_strings("\n".join(parser.javascript), javascript=True)
        css_strings = extract_code_strings("\n".join(parser.styles), javascript=False)
        visible.extend(js_strings)
        visible.extend(css_strings)
        if relative.as_posix() in CORE_PRIORITY_FILES:
            global_ui.extend(parser.visible)
            global_ui.extend(js_strings)
            global_ui.extend(css_strings)
    elif suffix == ".json":
        try:
            value = json.loads(text)
        except json.JSONDecodeError as exc:
            raise SpicaError(f"扫描字体时遇到无效 JSON：{relative}（第 {exc.lineno} 行）") from exc
        visible.extend(_json_strings(value))
    elif suffix == ".js":
        strings = extract_code_strings(text, javascript=True)
        visible.extend(strings)
        if relative.as_posix() in CORE_PRIORITY_FILES:
            global_ui.extend(strings)
    elif suffix == ".css":
        strings = extract_code_strings(text, javascript=False)
        visible.extend(strings)
        if relative.as_posix() in CORE_PRIORITY_FILES:
            global_ui.extend(strings)
    return _codepoints(visible), _codepoints(global_ui)


def _virtual_files(changes: ChangeSet, paths: ProjectPaths) -> list[Path]:
    root = paths.root.resolve()
    files: set[Path] = set()
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.casefold() not in SCAN_EXTENSIONS:
            continue
        relative = path.relative_to(root)
        if any(part in SKIP_DIRECTORIES for part in relative.parts):
            continue
        files.add(path.resolve())
    for path in changes.writes:
        if path.suffix.casefold() not in SCAN_EXTENSIONS:
            continue
        relative = path.relative_to(root)
        if any(part in SKIP_DIRECTORIES for part in relative.parts):
            continue
        files.add(path.resolve())
    return sorted(files, key=lambda item: str(item).casefold())


def _homepage_data_characters(changes: ChangeSet, paths: ProjectPaths) -> set[int]:
    """收集首页真正渲染的精选卡片、标签和朋友磁贴文字。"""
    def read_json(relative: str) -> Any:
        try:
            return json.loads(changes.read_text(relative))
        except (json.JSONDecodeError, SpicaError) as exc:
            raise SpicaError(f"无法读取首页字体数据：{relative}（{exc}）") from exc

    references = read_json("json/index.json")
    databases = {
        section: {str(row.get("id")): row for row in read_json(f"json/{section}.json")}
        for section in ("article", "histoire")
    }
    strings: list[str] = []
    for reference in references:
        entry = databases.get(str(reference.get("section")), {}).get(str(reference.get("id")))
        if not entry:
            continue
        for field in ("title", "description"):
            if isinstance(entry.get(field), str):
                strings.append(entry[field])
        strings.extend(tag for tag in entry.get("tags", []) if isinstance(tag, str))
    for friend in read_json("json/amis.json"):
        for field in ("name", "code"):
            if isinstance(friend.get(field), str):
                strings.append(friend[field])
    for tag in read_json("json/tag.json"):
        if isinstance(tag.get("zh"), str):
            strings.append(tag["zh"])
    return _codepoints(strings)


def collect_site_characters(
    changes: ChangeSet, paths: ProjectPaths
) -> tuple[set[int], set[int]]:
    root = paths.root.resolve()
    all_characters: set[int] = set()
    core_candidates: set[int] = set()
    for path in _virtual_files(changes, paths):
        relative = path.relative_to(root)
        text = changes.read_text(path)
        visible, core = scan_file_text(relative, text)
        all_characters.update(visible)
        core_candidates.update(core)
    core_candidates.update(_homepage_data_characters(changes, paths))
    all_characters.update(core_candidates)
    return all_characters, core_candidates


def _font_cmap(data: bytes, label: str) -> set[int]:
    try:
        from fontTools.ttLib import TTFont

        font = TTFont(io.BytesIO(data), lazy=False)
        result = set(font.getBestCmap() or {})
        font.close()
        return result
    except ImportError as exc:
        raise SpicaError(
            "缺少 FontTools。请运行：python -m pip install -r tools/requirements.txt"
        ) from exc
    except Exception as exc:
        raise SpicaError(f"无法读取字体 {label}：{exc}") from exc


def build_subset(master_data: bytes, codepoints: set[int]) -> bytes:
    if not codepoints:
        raise SpicaError("字体子集字符集为空，拒绝生成无效 WOFF2。")
    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont

        font = TTFont(io.BytesIO(master_data), lazy=False)
        options = subset.Options()
        options.recommended_glyphs = True
        options.notdef_outline = True
        options.glyph_names = True
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.name_legacy = True
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=codepoints)
        subsetter.subset(font)
        font.flavor = "woff2"
        output = io.BytesIO()
        font.save(output)
        font.close()
        data = output.getvalue()
        if _font_cmap(data, "新生成子集") != codepoints:
            raise SpicaError("新生成字体的 cmap 与目标字符集不一致。")
        return data
    except SpicaError:
        raise
    except ImportError as exc:
        raise SpicaError(
            "缺少 FontTools/Brotli。请运行：python -m pip install -r tools/requirements.txt"
        ) from exc
    except Exception as exc:
        raise SpicaError(f"WOFF2 子集生成失败：{exc}") from exc


def format_unicode_range(codepoints: set[int]) -> str:
    if not codepoints:
        raise SpicaError("无法为零字符生成 unicode-range。")
    ordered = sorted(codepoints)
    ranges: list[tuple[int, int]] = []
    start = previous = ordered[0]
    for codepoint in ordered[1:]:
        if codepoint == previous + 1:
            previous = codepoint
            continue
        ranges.append((start, previous))
        start = previous = codepoint
    ranges.append((start, previous))

    def point(value: int) -> str:
        return f"{value:04X}"

    return ", ".join(
        f"U+{point(start)}" if start == end else f"U+{point(start)}-{point(end)}"
        for start, end in ranges
    )


def _rewrite_font_face(css: str, filename: str, codepoints: set[int], version: str) -> str:
    block_pattern = re.compile(r"@font-face\s*\{[^{}]*\}", re.DOTALL)
    matches = [match for match in block_pattern.finditer(css) if filename in match.group(0)]
    if len(matches) != 1:
        raise SpicaError(f"style.css 中未找到字体声明：{filename}")
    match = matches[0]
    block = match.group(0)
    block, url_count = re.subn(
        re.escape(filename) + r"(?:\?v=[0-9A-Fa-f]+)?",
        f"{filename}?v={version}",
        block,
        count=1,
    )
    block, range_count = re.subn(
        r"(unicode-range\s*:\s*).*?(;)",
        lambda item: item.group(1) + format_unicode_range(codepoints) + item.group(2),
        block,
        count=1,
        flags=re.DOTALL,
    )
    if url_count != 1 or range_count != 1:
        raise SpicaError(f"style.css 的字体声明结构异常：{filename}")
    return css[: match.start()] + block + css[match.end() :]


def _ensure_master_is_offline(changes: ChangeSet, paths: ProjectPaths) -> None:
    """母版只能作为本地子集来源，绝不能出现在网站资源引用中。"""
    root = paths.root.resolve()
    offenders: list[str] = []
    for path in _virtual_files(changes, paths):
        relative = path.relative_to(root)
        if MASTER_NAME in changes.read_text(path):
            offenders.append(relative.as_posix())
    if offenders:
        raise SpicaError(
            f"检测到母版字体 {MASTER_NAME} 被网站文件引用：" + "、".join(offenders)
        )


def _rewrite_preload(script: str, filename: str, version: str, label: str) -> str:
    pattern = re.compile(re.escape(filename) + r"(?:\?v=[0-9A-Fa-f]+)?")
    updated, count = pattern.subn(f"{filename}?v={version}", script)
    if count != 1:
        raise SpicaError(f"{label} 中应当恰好有一个 {filename} 预加载引用，实际为 {count} 个。")
    return updated


def process(changes: ChangeSet, context: dict | None = None) -> None:
    """创建器后处理接口：按变更集中的新页面更新字体子集。"""
    paths = ProjectPaths(changes.root)
    font_dir = paths.root / "fonts"
    master_path = font_dir / MASTER_NAME
    latin_path = font_dir / LATIN_NAME
    core_path = font_dir / CORE_NAME
    extra_path = font_dir / EXTRA_NAME
    for path in (master_path, latin_path, core_path, extra_path):
        if not path.is_file():
            raise SpicaError(f"缺少字体文件：{path}")
    if master_path.resolve() in changes.writes:
        raise SpicaError("母版 TTF 不允许被修改或暂存。")
    _ensure_master_is_offline(changes, paths)

    master_data = master_path.read_bytes()
    latin_data = changes.read_bytes(latin_path)
    old_core_data = changes.read_bytes(core_path)
    old_extra_data = changes.read_bytes(extra_path)
    master_cmap = _font_cmap(master_data, MASTER_NAME)
    latin_cmap = _font_cmap(latin_data, LATIN_NAME)
    old_core_cmap = _font_cmap(old_core_data, CORE_NAME)

    all_characters, core_candidates = collect_site_characters(changes, paths)
    supported = all_characters & master_cmap
    new_core_cmap = old_core_cmap | ((core_candidates & master_cmap) - latin_cmap)
    new_extra_cmap = supported - latin_cmap - new_core_cmap

    new_core_data = (
        build_subset(master_data, new_core_cmap)
        if new_core_cmap != old_core_cmap
        else old_core_data
    )
    old_extra_cmap = _font_cmap(old_extra_data, EXTRA_NAME)
    new_extra_data = (
        build_subset(master_data, new_extra_cmap)
        if new_extra_cmap != old_extra_cmap
        else old_extra_data
    )
    core_hash = hashlib.sha256(new_core_data).hexdigest()[:12]
    extra_hash = hashlib.sha256(new_extra_data).hexdigest()[:12]

    if new_core_data != old_core_data:
        changes.set_bytes(core_path, new_core_data, "重建首页优先 Core 字体子集")
    if new_extra_data != old_extra_data:
        changes.set_bytes(extra_path, new_extra_data, "重建全站 Extra 字体子集")

    style_path = paths.root / "css" / "style.css"
    style = changes.read_text(style_path)
    updated_style = _rewrite_font_face(style, CORE_NAME, new_core_cmap, core_hash)
    updated_style = _rewrite_font_face(updated_style, EXTRA_NAME, new_extra_cmap, extra_hash)
    if updated_style != style:
        changes.set_text(style_path, updated_style, "同步字体 unicode-range 与缓存版本")

    for relative in ("js/common-head.js", "js/special/common-head-peur.js"):
        script = changes.read_text(relative)
        updated = _rewrite_preload(script, CORE_NAME, core_hash, relative)
        updated = _rewrite_preload(updated, EXTRA_NAME, extra_hash, relative)
        if updated != script:
            changes.set_text(relative, updated, "同步字体预加载缓存版本")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="扫描全站可渲染文字并修补 WOFF2 字体子集。")
    parser.add_argument("--dry-run", action="store_true", help="只扫描并显示文件计划，不写入")
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_console()
    args = build_parser().parse_args(argv)
    try:
        paths = ProjectPaths.discover()
        changes = ChangeSet(paths.root)
        process(changes, {"operation": "manual_font_patch"})
        if not changes.writes:
            print("字体覆盖已经完整，不需要修改。")
            return 0
        print_plan(changes)
        if args.dry_run:
            print("检查完成：dry-run 未修改任何文件。")
        else:
            commit_changes(changes)
            print("字体修补完成。")
        return 0
    except SpicaError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
