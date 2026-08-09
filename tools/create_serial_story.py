"""创建多章节故事首页与初始章节 JSON。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from creator_common import (
    add_requested_tags,
    append_metadata,
    parse_new_tag_specs,
    prepare_cover,
    split_tags,
    validate_content_identity,
)
from spica_core import (
    ChangeSet,
    OperationClock,
    ProjectPaths,
    SpicaError,
    configure_console,
    inject_body,
    parse_input_path,
    render_template,
    run_postprocessors,
)
from spica_transaction import commit_changes, print_plan


def build_serial_story(
    changes: ChangeSet,
    paths: ProjectPaths,
    *,
    content_id: str,
    title: str,
    description: str,
    image: Path,
    color: str,
    tags: list[str],
    allow_nonstandard_id: bool,
    clock: OperationClock,
) -> None:
    content_id, title = validate_content_identity(
        changes, paths, "histoire", content_id, title, allow_nonstandard_id
    )
    cover_url = prepare_cover(changes, paths, "histoire", image)
    page = render_template(
        paths,
        "histoire.j2",
        page_title=title,
        serialized_date=clock.display_date,
        end_date=clock.display_date,
        year=clock.year,
        create_date=clock.display_date,
        updated_date=clock.display_date,
    )
    page = inject_body(page, "")
    changes.set_text(
        paths.root / "histoire" / content_id / "index.html",
        page,
        f"多章故事首页 {title}",
    )
    chapter_template = paths.templates / "chapter.json"
    if not chapter_template.is_file():
        raise SpicaError(f"缺少章节 JSON 模板：{chapter_template}")
    changes.set_bytes(
        paths.root / "json" / "histoire" / f"{content_id}.json",
        chapter_template.read_bytes(),
        "复制初始章节目录",
    )
    append_metadata(
        changes,
        "histoire",
        content_id=content_id,
        title=title,
        description=description,
        cover_image=cover_url,
        color=color,
        tags=tags,
        clock=clock,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="创建多章节故事。")
    parser.add_argument("--id", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--description", required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--color", required=True)
    parser.add_argument("--tags", default="")
    parser.add_argument("--new-tag", action="append", default=[], help="中文=法语slug，可重复")
    parser.add_argument("--allow-nonstandard-id", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_console()
    args = build_parser().parse_args(argv)
    try:
        paths = ProjectPaths.discover()
        clock = OperationClock.capture()
        changes = ChangeSet(paths.root)
        add_requested_tags(changes, paths, parse_new_tag_specs(args.new_tag), clock)
        build_serial_story(
            changes,
            paths,
            content_id=args.id,
            title=args.title,
            description=args.description,
            image=parse_input_path(args.image),
            color=args.color,
            tags=split_tags(args.tags),
            allow_nonstandard_id=args.allow_nonstandard_id,
            clock=clock,
        )
        run_postprocessors(
            changes, {"operation": "create_serial_story", "content_id": args.id}
        )
        print_plan(changes)
        if args.dry_run:
            print("检查完成：dry-run 未修改任何文件。")
        else:
            commit_changes(changes)
            print("多章故事创建完成。")
        return 0
    except SpicaError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
