"""创建标签元数据与标签页面。"""

from __future__ import annotations

import argparse
import sys

from spica_core import (
    ChangeSet,
    OperationClock,
    ProjectPaths,
    SpicaError,
    configure_console,
    load_json,
    normalized_key,
    render_template,
    run_postprocessors,
    safe_segment,
    stage_json,
)
from spica_transaction import commit_changes, print_plan


def build_tag(
    changes: ChangeSet,
    paths: ProjectPaths,
    chinese_name: str,
    french_slug: str,
    clock: OperationClock,
) -> None:
    chinese_name = chinese_name.strip()
    if not chinese_name:
        raise SpicaError("标签中文名不能为空。")
    french_slug = safe_segment(french_slug, "标签法语名/slug")
    rows = load_json(changes, "json/tag.json", list)
    wanted_zh = normalized_key(chinese_name)
    wanted_fr = normalized_key(french_slug)
    for row in rows:
        if normalized_key(str(row.get("zh", ""))) == wanted_zh:
            raise SpicaError(f"标签中文名已经存在：{chinese_name}")
        if normalized_key(str(row.get("fr", ""))) == wanted_fr:
            raise SpicaError(f"标签法语名/slug 已经存在：{french_slug}")

    output = paths.root / "tag" / french_slug / "index.html"
    if output.parent.exists() or changes.exists(output):
        raise SpicaError(f"标签目录已经存在：{output.parent}")

    rows.append({"fr": french_slug, "zh": chinese_name})
    stage_json(changes, "json/tag.json", rows, f"登记标签 {chinese_name}")
    page = render_template(
        paths,
        "tag.j2",
        tag_name_fr=french_slug,
        tag_name_cn=chinese_name,
        create_date=clock.display_date,
        updated_date=clock.display_date,
    )
    changes.set_text(output, page, f"标签页面 {chinese_name}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="创建一个新的 Spica 标签及其页面。")
    parser.add_argument("--zh", required=True, help="标签中文名，例如：爱情")
    parser.add_argument("--slug", required=True, help="法语名称/网址 slug，例如：amour")
    parser.add_argument("--dry-run", action="store_true", help="仅检查并显示计划，不写入文件")
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_console()
    args = build_parser().parse_args(argv)
    try:
        paths = ProjectPaths.discover()
        changes = ChangeSet(paths.root)
        build_tag(changes, paths, args.zh, args.slug, OperationClock.capture())
        run_postprocessors(changes, {"operation": "create_tag"})
        print_plan(changes)
        if args.dry_run:
            print("检查完成：dry-run 未修改任何文件。")
        else:
            commit_changes(changes)
            print("标签创建完成。")
        return 0
    except SpicaError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
