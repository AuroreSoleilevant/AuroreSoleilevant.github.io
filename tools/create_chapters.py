"""为多章节故事连续添加一个或多个章节。"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from md_to_html import convert_file
from spica_core import (
    ChangeSet,
    OperationClock,
    ProjectPaths,
    SpicaError,
    configure_console,
    load_json,
    normalized_key,
    parse_input_path,
    render_template,
    run_postprocessors,
    safe_segment,
    stage_json,
)
from spica_transaction import commit_changes, print_plan


NUMBERED_SOURCE_RE = re.compile(r"^(\d+)\.(md|txt)$", re.IGNORECASE)


def discover_sources(source: Path) -> list[Path]:
    if source.is_file():
        if source.suffix.casefold() not in {".md", ".txt"}:
            raise SpicaError("章节文件必须是 .md 或 .txt。")
        return [source]
    if not source.is_dir():
        raise SpicaError(f"章节来源既不是文件也不是目录：{source}")
    numbered: list[tuple[int, Path]] = []
    used_numbers: dict[int, Path] = {}
    for candidate in source.iterdir():
        if not candidate.is_file():
            continue
        match = NUMBERED_SOURCE_RE.fullmatch(candidate.name)
        if not match:
            continue
        number = int(match.group(1))
        if number in used_numbers:
            raise SpicaError(
                f"目录中存在相同数字编号的多个文件：{used_numbers[number].name} 与 {candidate.name}"
            )
        used_numbers[number] = candidate
        numbered.append((number, candidate))
    if not numbered:
        raise SpicaError("目录中没有找到以阿拉伯整数命名的 .md/.txt 文件。")
    return [path for _, path in sorted(numbered, key=lambda item: item[0])]


def _validate_chapters(value: object, path: Path) -> tuple[dict, list[dict]]:
    if not isinstance(value, dict) or not isinstance(value.get("chapters"), list):
        raise SpicaError(f"章节 JSON 必须是包含 chapters 数组的对象：{path}")
    chapters = value["chapters"]
    ids: list[int] = []
    for index, row in enumerate(chapters):
        if not isinstance(row, dict) or not isinstance(row.get("id"), int):
            raise SpicaError(f"章节 JSON 第 {index + 1} 项缺少整数 id。")
        if not isinstance(row.get("title"), str):
            raise SpicaError(f"章节 JSON 第 {index + 1} 项缺少字符串 title。")
        ids.append(row["id"])
    expected = list(range(len(ids)))
    if ids != expected:
        raise SpicaError(
            f"现有章节 ID 必须按 0 开始连续排列；当前为 {ids}。请先人工修复。"
        )
    return value, chapters


def _update_story_page_dates(page: str, created_date: str, current_date: str) -> str:
    date_line = re.compile(r'(<p\s+class="date-line">).*?(</p>)', re.DOTALL)
    page_dates = re.compile(
        r'(<div\s+class="page-dates">\s*)发布：.*?　修改：.*?(　字数：<span\s+id="count"></span>)',
        re.DOTALL,
    )
    page, first_count = date_line.subn(
        rf"\1连载开始：{created_date}　上次更新：{current_date}\2", page, count=1
    )
    page, second_count = page_dates.subn(
        rf"\1发布：{created_date}　修改：{current_date}\2", page, count=1
    )
    if first_count != 1 or second_count != 1:
        raise SpicaError("母故事首页的日期结构不符合模板，无法安全更新日期。")
    return page


def build_chapters(
    changes: ChangeSet,
    paths: ProjectPaths,
    *,
    story_id: str,
    sources: list[Path],
    titles: list[str],
    allow_html: bool,
    clock: OperationClock,
) -> None:
    story_id = safe_segment(story_id, "母故事 ID")
    if len(sources) != len(titles):
        raise SpicaError(f"章节文件有 {len(sources)} 个，但章节名有 {len(titles)} 个。")
    if not sources:
        raise SpicaError("至少需要一个章节文件。")
    cleaned_titles = [title.strip() for title in titles]
    if any(not title for title in cleaned_titles):
        raise SpicaError("章节名不能为空。")

    entries = load_json(changes, "json/histoire.json", list)
    matches = [entry for entry in entries if normalized_key(str(entry.get("id", ""))) == normalized_key(story_id)]
    if len(matches) != 1:
        raise SpicaError(f"histoire.json 中未找到唯一的母故事：{story_id}")
    story_entry = matches[0]
    chapter_path = paths.root / "json" / "histoire" / f"{story_id}.json"
    chapter_data, chapter_rows = _validate_chapters(
        load_json(changes, chapter_path, dict), chapter_path
    )
    first_id = len(chapter_rows)

    for offset, (source, title) in enumerate(zip(sources, cleaned_titles)):
        if not source.is_file() or source.suffix.casefold() not in {".md", ".txt"}:
            raise SpicaError(f"无效章节文件：{source}")
        chapter_id = first_id + offset
        chapter_dir = paths.root / "histoire" / story_id / str(chapter_id)
        output = chapter_dir / "index.html"
        if chapter_dir.exists() or changes.exists(output):
            raise SpicaError(f"章节目标目录已经存在：{chapter_dir}")
        body = convert_file(source, allow_html=allow_html)
        page = render_template(
            paths,
            "chapter.j2",
            chapter_title=title,
            open_date=clock.display_date,
            create_date=clock.display_date,
            updated_date=clock.display_date,
        )
        from spica_core import inject_body

        changes.set_text(output, inject_body(page, body), f"章节 {chapter_id}：{title}")
        chapter_rows.append({"id": chapter_id, "title": title})

    stage_json(changes, chapter_path, chapter_data, f"追加 {len(sources)} 个章节")
    story_entry["updated_at"] = clock.iso_utc
    stage_json(changes, "json/histoire.json", entries, f"更新 {story_entry.get('title', story_id)} 的日期")

    root_page = paths.root / "histoire" / story_id / "index.html"
    if not root_page.is_file():
        raise SpicaError(f"母故事首页不存在：{root_page}")
    from spica_core import display_date_from_iso

    created_date = display_date_from_iso(str(story_entry.get("created_at", "")))
    updated_page = _update_story_page_dates(
        changes.read_text(root_page), created_date, clock.display_date
    )
    changes.set_text(root_page, updated_page, "同步母故事首页日期")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="为多章故事连续添加章节。")
    parser.add_argument("--story", required=True, help="母故事 ID")
    parser.add_argument("--source", required=True, help="一个 .md/.txt 或批量目录")
    parser.add_argument("--title", action="append", required=True, help="章节名；批量时按顺序重复")
    parser.add_argument("--allow-html", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_console()
    args = build_parser().parse_args(argv)
    try:
        paths = ProjectPaths.discover()
        source = parse_input_path(args.source)
        sources = discover_sources(source)
        changes = ChangeSet(paths.root)
        build_chapters(
            changes,
            paths,
            story_id=args.story,
            sources=sources,
            titles=args.title,
            allow_html=args.allow_html,
            clock=OperationClock.capture(),
        )
        run_postprocessors(
            changes, {"operation": "create_chapters", "story_id": args.story}
        )
        print_plan(changes)
        if args.dry_run:
            print("检查完成：dry-run 未修改任何文件。")
        else:
            commit_changes(changes)
            print(f"章节创建完成，共添加 {len(sources)} 章。")
        return 0
    except SpicaError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
