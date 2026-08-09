"""创建文章或单页故事。"""

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
from md_to_html import convert_file
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


def build_solo(
    changes: ChangeSet,
    paths: ProjectPaths,
    *,
    section: str,
    content_id: str,
    title: str,
    description: str,
    image: Path,
    color: str,
    tags: list[str],
    source: Path | None,
    allow_nonstandard_id: bool,
    allow_html: bool,
    clock: OperationClock,
) -> None:
    content_id, title = validate_content_identity(
        changes, paths, section, content_id, title, allow_nonstandard_id
    )
    cover_url = prepare_cover(changes, paths, section, image)
    body = convert_file(source, allow_html=allow_html) if source else ""
    page = render_template(
        paths,
        "solo.j2",
        page_title=title,
        open_date=clock.display_date,
        year=clock.year,
        create_date=clock.display_date,
        updated_date=clock.display_date,
    )
    page = inject_body(page, body)
    output = paths.root / section / content_id / "index.html"
    changes.set_text(output, page, f"{title} 的完整页面")
    append_metadata(
        changes,
        section,
        content_id=content_id,
        title=title,
        description=description,
        cover_image=cover_url,
        color=color,
        tags=tags,
        clock=clock,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="创建文章或单页故事。")
    parser.add_argument("--type", choices=("article", "story"), required=True)
    parser.add_argument("--id", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--description", required=True)
    parser.add_argument("--image", required=True, help="本地封面图像路径")
    parser.add_argument("--color", required=True, help="例如 rgba(48, 167, 255, 0.3)")
    parser.add_argument("--tags", default="", help="用英文或中文逗号分隔的中文标签")
    parser.add_argument("--source", help="可选的 .md/.txt 正文")
    parser.add_argument("--new-tag", action="append", default=[], help="中文=法语slug，可重复")
    parser.add_argument("--allow-nonstandard-id", action="store_true")
    parser.add_argument("--allow-html", action="store_true")
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
        build_solo(
            changes,
            paths,
            section="article" if args.type == "article" else "histoire",
            content_id=args.id,
            title=args.title,
            description=args.description,
            image=parse_input_path(args.image),
            color=args.color,
            tags=split_tags(args.tags),
            source=parse_input_path(args.source) if args.source else None,
            allow_nonstandard_id=args.allow_nonstandard_id,
            allow_html=args.allow_html,
            clock=clock,
        )
        run_postprocessors(
            changes, {"operation": "create_solo", "content_id": args.id}
        )
        print_plan(changes)
        if args.dry_run:
            print("检查完成：dry-run 未修改任何文件。")
        else:
            commit_changes(changes)
            print("内容创建完成。")
        return 0
    except SpicaError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
