"""文章与故事创建器共用的封面、标签和元数据逻辑。"""

from __future__ import annotations

from pathlib import Path

from create_tag import build_tag
from image_card import create_card_bytes
from spica_core import (
    ChangeSet,
    OperationClock,
    ProjectPaths,
    SpicaError,
    id_warning,
    load_json,
    normalize_rgba,
    parse_input_path,
    safe_segment,
    stage_json,
    validate_tags,
)


def split_tags(value: str) -> list[str]:
    if not value.strip():
        return []
    return [item.strip() for item in value.replace("，", ",").split(",") if item.strip()]


def parse_new_tag_specs(specs: list[str]) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for spec in specs:
        separator = "=" if "=" in spec else "：" if "：" in spec else None
        if separator is None:
            raise SpicaError(f"新标签格式应为 中文=法语slug：{spec}")
        chinese, slug = (part.strip() for part in spec.split(separator, 1))
        if not chinese or not slug:
            raise SpicaError(f"新标签格式不完整：{spec}")
        result.append((chinese, slug))
    return result


def add_requested_tags(
    changes: ChangeSet,
    paths: ProjectPaths,
    specs: list[tuple[str, str]],
    clock: OperationClock,
) -> None:
    for chinese, slug in specs:
        build_tag(changes, paths, chinese, slug, clock)


def validate_content_identity(
    changes: ChangeSet,
    paths: ProjectPaths,
    section: str,
    content_id: str,
    title: str,
    allow_nonstandard_id: bool,
) -> tuple[str, str]:
    from spica_core import require_unique_content

    if section not in {"article", "histoire"}:
        raise SpicaError("内容类型必须是 article 或 histoire。")
    content_id = safe_segment(content_id, "内容 ID")
    title = title.strip()
    if not title:
        raise SpicaError("标题不能为空。")
    warning = id_warning(section, content_id)
    if warning and not allow_nonstandard_id:
        raise SpicaError(warning + " 如确认继续，请使用 --allow-nonstandard-id。")
    require_unique_content(changes, content_id, title)
    destination = paths.root / section / content_id
    if destination.exists():
        raise SpicaError(f"目标内容目录已经存在：{destination}")
    return content_id, title


def prepare_cover(
    changes: ChangeSet,
    paths: ProjectPaths,
    section: str,
    image_input: str | Path,
) -> str:
    source = image_input if isinstance(image_input, Path) else parse_input_path(image_input)
    if not source.is_file():
        raise SpicaError(f"封面图像不是文件：{source}")
    safe_segment(source.name, "封面文件名")
    image_dir = paths.root / "images" / section
    cover_destination = image_dir / source.name
    card_destination = image_dir / "cards" / f"{source.stem}.webp"

    if source.resolve() != cover_destination.resolve():
        if cover_destination.exists() or changes.exists(cover_destination):
            raise SpicaError(f"站内封面文件已经存在：{cover_destination}")
        changes.set_bytes(cover_destination, source.read_bytes(), "复制封面原图")
    if card_destination.exists() or changes.exists(card_destination):
        raise SpicaError(f"卡片图片已经存在：{card_destination}")
    changes.set_bytes(card_destination, create_card_bytes(source), "生成 1200×280 WebP 卡片")
    return f"/images/{section}/{source.name}"


def append_metadata(
    changes: ChangeSet,
    section: str,
    *,
    content_id: str,
    title: str,
    description: str,
    cover_image: str,
    color: str,
    tags: list[str],
    clock: OperationClock,
) -> None:
    database = f"json/{section}.json"
    entries = load_json(changes, database, list)
    entries.append(
        {
            "id": content_id,
            "url": f"/{section}/{content_id}",
            "title": title,
            "description": description,
            "cover_image": cover_image,
            "created_at": clock.iso_utc,
            "updated_at": clock.iso_utc,
            "word_count": 0,
            "color": normalize_rgba(color),
            "tags": validate_tags(changes, tags),
        }
    )
    stage_json(changes, database, entries, f"登记 {title}")

