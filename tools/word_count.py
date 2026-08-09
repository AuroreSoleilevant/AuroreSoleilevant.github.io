"""按照 js/mots.js 的规则统计页面汉字数，并更新内容 JSON。"""

from __future__ import annotations

import argparse
import sys
from html.parser import HTMLParser
from pathlib import Path

from spica_core import (
    ChangeSet,
    ProjectPaths,
    SpicaError,
    configure_console,
    load_json,
    normalized_key,
    stage_json,
)
from spica_transaction import commit_changes, print_plan


IMPLEMENTED = True
FULL_SITE_INPUTS = {"all", "full", "site", "全站"}
NON_TEXT_ELEMENTS = {"script", "style", "template", "noscript"}


class MainTextParser(HTMLParser):
    """提取第一个 main 的文本，等价于当前页面静态 DOM 的 main.innerText。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.inside_main = False
        self.found_main = False
        self.ignored_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.casefold()
        if tag == "main" and not self.found_main:
            self.found_main = True
            self.inside_main = True
            return
        if self.inside_main and tag in NON_TEXT_ELEMENTS:
            self.ignored_depth += 1

    def handle_startendtag(self, tag: str, attrs) -> None:
        return None

    def handle_endtag(self, tag: str) -> None:
        tag = tag.casefold()
        if not self.inside_main:
            return
        if tag in NON_TEXT_ELEMENTS and self.ignored_depth:
            self.ignored_depth -= 1
        elif tag == "main" and not self.ignored_depth:
            self.inside_main = False

    def handle_data(self, data: str) -> None:
        if self.inside_main and not self.ignored_depth:
            self.parts.append(data)


def is_counted_character(character: str) -> bool:
    codepoint = ord(character)
    return (
        0x4E00 <= codepoint <= 0x9FFF
        or 0x3400 <= codepoint <= 0x4DBF
        or 0xF900 <= codepoint <= 0xFAFF
        or 0x20000 <= codepoint <= 0x2EBEF
    )


def count_html_text(page: str, label: str = "HTML") -> int:
    parser = MainTextParser()
    try:
        parser.feed(page)
        parser.close()
    except Exception as exc:
        raise SpicaError(f"无法解析 {label}：{exc}") from exc
    if not parser.found_main:
        raise SpicaError(f"页面没有 <main>，无法按 mots.js 规则统计：{label}")
    return sum(1 for character in "".join(parser.parts).strip() if is_counted_character(character))


def count_page(changes: ChangeSet, page: Path) -> int:
    if not changes.exists(page):
        raise SpicaError(f"需要统计的页面不存在：{page}")
    return count_html_text(changes.read_text(page), str(page))


def _story_pages(changes: ChangeSet, paths: ProjectPaths, story_id: str) -> list[Path]:
    story_root = (paths.root / "histoire" / story_id).resolve()
    chapter_json = paths.root / "json" / "histoire" / f"{story_id}.json"
    if changes.exists(chapter_json):
        data = load_json(changes, chapter_json, dict)
        chapters = data.get("chapters")
        if not isinstance(chapters, list) or not chapters:
            raise SpicaError(f"章节 JSON 缺少非空 chapters 数组：{chapter_json}")
        pages: list[Path] = []
        seen: set[int] = set()
        for index, row in enumerate(chapters):
            if not isinstance(row, dict) or not isinstance(row.get("id"), int):
                raise SpicaError(f"章节 JSON 第 {index + 1} 项缺少整数 id：{chapter_json}")
            chapter_id = row["id"]
            if chapter_id in seen or chapter_id < 0:
                raise SpicaError(f"章节 JSON 含重复或负数 id：{chapter_json}")
            seen.add(chapter_id)
            pages.append(
                story_root / "index.html"
                if chapter_id == 0
                else story_root / str(chapter_id) / "index.html"
            )
        return pages

    pages = {page.resolve() for page in story_root.rglob("index.html")} if story_root.is_dir() else set()
    for pending in changes.writes:
        try:
            relative = pending.relative_to(story_root)
        except ValueError:
            continue
        if relative.name.casefold() == "index.html":
            pages.add(pending)
    if not pages:
        raise SpicaError(f"故事目录下没有 index.html：{story_root}")
    return sorted(pages, key=lambda page: str(page.relative_to(story_root)).casefold())


def _find_entry(changes: ChangeSet, content_id: str) -> tuple[str, list[dict], dict]:
    wanted = normalized_key(content_id)
    matches: list[tuple[str, list[dict], dict]] = []
    for section in ("article", "histoire"):
        entries = load_json(changes, f"json/{section}.json", list)
        for entry in entries:
            if normalized_key(str(entry.get("id", ""))) == wanted:
                matches.append((section, entries, entry))
    if not matches:
        raise SpicaError(f"article.json 和 histoire.json 中均未登记 ID：{content_id}")
    if len(matches) != 1:
        raise SpicaError(f"ID 在多个主 JSON 中重复，无法确定目标：{content_id}")
    return matches[0]


def count_content(changes: ChangeSet, paths: ProjectPaths, content_id: str) -> tuple[str, int]:
    section, _, entry = _find_entry(changes, content_id)
    actual_id = str(entry["id"])
    if section == "article":
        pages = [paths.root / "article" / actual_id / "index.html"]
    else:
        pages = _story_pages(changes, paths, actual_id)
    return section, sum(count_page(changes, page) for page in pages)


def update_one(changes: ChangeSet, paths: ProjectPaths, content_id: str) -> None:
    section, count = count_content(changes, paths, content_id)
    database = f"json/{section}.json"
    entries = load_json(changes, database, list)
    wanted = normalized_key(content_id)
    entry = next(row for row in entries if normalized_key(str(row.get("id", ""))) == wanted)
    entry["word_count"] = count
    stage_json(changes, database, entries, f"更新 {entry['id']} 的字数")


def update_all(changes: ChangeSet, paths: ProjectPaths) -> None:
    for section in ("article", "histoire"):
        database = f"json/{section}.json"
        entries = load_json(changes, database, list)
        for entry in entries:
            actual_section, count = count_content(changes, paths, str(entry.get("id", "")))
            if actual_section != section:
                raise SpicaError(f"内容分区异常：{entry.get('id')}")
            entry["word_count"] = count
        stage_json(changes, database, entries, f"更新全站 {section} 字数")


def process(changes: ChangeSet, context: dict | None = None) -> None:
    """创建器后处理接口：只重算本次创建或更新的内容。"""
    context = context or {}
    if context.get("operation") == "create_tag":
        return
    content_id = context.get("content_id") or context.get("story_id")
    if not content_id:
        raise SpicaError("字数统计后处理缺少 content_id/story_id。")
    update_one(changes, ProjectPaths(changes.root), str(content_id))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="按 js/mots.js 规则更新指定 ID 或全站的 JSON 字数。"
    )
    parser.add_argument("id", help="文章/故事 ID；输入 ALL 或 全站可统计全部已登记内容")
    parser.add_argument("--dry-run", action="store_true", help="只检查和显示修改文件，不写入")
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_console()
    args = build_parser().parse_args(argv)
    try:
        paths = ProjectPaths.discover()
        changes = ChangeSet(paths.root)
        if args.id.strip().casefold() in FULL_SITE_INPUTS:
            update_all(changes, paths)
        else:
            update_one(changes, paths, args.id.strip())
        print_plan(changes)
        if args.dry_run:
            print("检查完成：dry-run 未修改任何文件。")
        else:
            commit_changes(changes)
            print("字数统计完成，JSON 已更新。")
        return 0
    except SpicaError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
