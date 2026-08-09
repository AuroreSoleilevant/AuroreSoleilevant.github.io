"""Spica 网站内容自动化的中文问答式总入口。"""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

try:
    from spica_core import (
        ChangeSet,
        OperationClock,
        ProjectPaths,
        SpicaError,
        configure_console,
        id_warning,
        load_json,
        normalized_key,
        normalize_rgba,
        parse_input_path,
        require_dependencies,
        run_postprocessors,
    )
except Exception as exc:  # 核心模块本身损坏时也要给出可读提示。
    print(f"Spica 无法载入核心模块 spica_core.py：{exc}", file=sys.stderr)
    raise SystemExit(2)


CANCEL_TOKEN = "/q"
INTERNAL_MODULES = (
    "spica_core",
    "spica_transaction",
    "md_to_html",
    "image_card",
    "create_tag",
    "creator_common",
    "create_solo",
    "create_serial_story",
    "create_chapters",
    "word_count",
    "font_patch",
    "generate_story_card_thumbnails",
)
REQUIRED_FILES = (
    "template/solo.j2",
    "template/histoire.j2",
    "template/chapter.j2",
    "template/tag.j2",
    "template/chapter.json",
    "requirements.txt",
)
FONT_REQUIRED_FILES = (
    "fonts/LXGWWenKai.ttf",
    "fonts/LXGWWenKai-latin-symbols.woff2",
    "fonts/LXGWWenKai-cjk-core.woff2",
    "fonts/LXGWWenKai-cjk-site-extra.woff2",
    "css/style.css",
    "js/common-head.js",
    "js/special/common-head-peur.js",
    "json/index.json",
    "json/amis.json",
)


class UserCancelled(Exception):
    pass


def ask(prompt: str, *, allow_empty: bool = False) -> str:
    while True:
        value = input(prompt).strip()
        if value.casefold() == CANCEL_TOKEN:
            raise UserCancelled
        if value or allow_empty:
            return value
        print("此项不能为空。若要取消本次操作，请输入 /q。")


def confirm(prompt: str, *, default: bool = False) -> bool:
    hint = "[Y/n]" if default else "[y/N]"
    while True:
        value = ask(f"{prompt} {hint}：", allow_empty=True).casefold()
        if not value:
            return default
        if value in {"y", "yes", "是"}:
            return True
        if value in {"n", "no", "否"}:
            return False
        print("请输入 y 或 n。")


def ask_path(prompt: str, *, optional: bool = False) -> Path | None:
    while True:
        raw = ask(prompt, allow_empty=optional)
        if not raw and optional:
            return None
        try:
            return parse_input_path(raw)
        except SpicaError as exc:
            print(f"路径无效：{exc}")


def preflight(paths: ProjectPaths) -> None:
    missing_files = [str(paths.tools / item) for item in REQUIRED_FILES if not (paths.tools / item).is_file()]
    missing_files.extend(
        str(paths.root / item)
        for item in FONT_REQUIRED_FILES
        if not (paths.root / item).is_file()
    )
    if missing_files:
        details = "\n  - ".join(missing_files)
        raise SpicaError(f"脚本库或模板不完整，缺少：\n  - {details}")

    module_errors: list[str] = []
    for name in INTERNAL_MODULES:
        try:
            importlib.import_module(name)
        except Exception as exc:
            module_errors.append(f"{name}: {type(exc).__name__}: {exc}")
    if module_errors:
        raise SpicaError("部分内部模块无法载入：\n  - " + "\n  - ".join(module_errors))

    missing_dependencies = require_dependencies(
        {
            "PIL": "Pillow",
            "jinja2": "Jinja2",
            "fontTools": "FontTools",
            "brotli": "Brotli（WOFF2 压缩支持）",
        }
    )
    if missing_dependencies:
        raise SpicaError(
            "缺少 Python 依赖："
            + "、".join(missing_dependencies)
            + "。\n请在项目根目录运行：python -m pip install -r tools/requirements.txt"
        )

    try:
        from jinja2 import Environment, StrictUndefined

        environment = Environment(undefined=StrictUndefined)
        for relative in REQUIRED_FILES:
            if relative.endswith(".j2"):
                environment.parse((paths.tools / relative).read_text(encoding="utf-8"))
        json.loads((paths.templates / "chapter.json").read_text(encoding="utf-8"))
    except Exception as exc:
        raise SpicaError(f"模板语法检查失败：{exc}") from exc

    for relative, expected in (("json/article.json", list), ("json/histoire.json", list), ("json/tag.json", list)):
        changes = ChangeSet(paths.root)
        load_json(changes, relative, expected)


def ask_identity(section: str) -> tuple[str, str, bool]:
    example = "080826A" if section == "article" else "HABC"
    content_id = ask(f"请输入 ID（例如 {example}）：")
    warning = id_warning(section, content_id)
    allow_nonstandard = False
    if warning:
        print(f"警告：{warning}")
        if not confirm("确认仍使用这个 ID 吗？"):
            raise UserCancelled
        allow_nonstandard = True
    title = ask("请输入中文标题（例如：未来的踪迹）：")
    return content_id, title, allow_nonstandard


def ask_valid_identity(
    changes: ChangeSet, paths: ProjectPaths, section: str
) -> tuple[str, str, bool]:
    from creator_common import validate_content_identity

    while True:
        content_id, title, allow_nonstandard = ask_identity(section)
        try:
            validate_content_identity(
                changes, paths, section, content_id, title, allow_nonstandard
            )
            return content_id, title, allow_nonstandard
        except SpicaError as exc:
            print(f"ID 或标题检查未通过：{exc}")
            if not confirm("是否重新输入 ID 和标题？", default=True):
                raise UserCancelled


def ask_tags(changes: ChangeSet, paths: ProjectPaths, clock: OperationClock) -> list[str]:
    from create_tag import build_tag
    from creator_common import split_tags

    raw = ask(
        "请输入中文标签，多个标签用逗号分隔；不需要标签可直接回车\n"
        "例如：中篇, 已完结, 科幻\n标签：",
        allow_empty=True,
    )
    requested = split_tags(raw)
    rows = load_json(changes, "json/tag.json", list)
    known = {normalized_key(str(row.get("zh", ""))): str(row.get("zh", "")) for row in rows}
    result: list[str] = []
    for tag in requested:
        key = normalized_key(tag)
        if key in known:
            result.append(known[key])
            continue
        print(f"标签“{tag}”目前不在 json/tag.json 中。")
        if not confirm("是否现在创建这个标签？"):
            print(f"已从本次内容中移除未知标签：{tag}")
            continue
        while True:
            slug = ask(
                "请输入该标签的法语名称/网址 slug。\n"
                "示例：中文“爱情”对应 amour；中文“科幻”对应 futuriste\nslug："
            )
            try:
                build_tag(changes, paths, tag, slug, clock)
                break
            except SpicaError as exc:
                print(f"标签未通过检查：{exc}")
                if not confirm("是否重新输入这个标签的法语名？", default=True):
                    raise UserCancelled
        known[key] = tag
        result.append(tag)
    return result


def ask_common_content(changes: ChangeSet, paths: ProjectPaths, clock: OperationClock) -> dict:
    description = ask(
        "请输入简介。可以输入中文、标点和常见符号；请保持为一段文字。\n简介："
    )
    print(
        "封面提示：可以输入项目内或项目外的本地图像。项目外图像会复制到对应 images 目录；"
        "路径可以直接粘贴，也可以使用 Windows 的双引号路径。"
    )
    image = ask_path("封面图像路径（例如 \"D:\\图片\\封面.webp\"）：")
    while True:
        color_input = ask("请输入 RGBA 卡片颜色，例如 rgba(48, 167, 255, 0.3)：")
        try:
            color = normalize_rgba(color_input)
            break
        except SpicaError as exc:
            print(f"颜色无效：{exc}")
    tags = ask_tags(changes, paths, clock)
    return {"description": description, "image": image, "color": color, "tags": tags}


def finalize(
    changes: ChangeSet,
    operation: str,
    *,
    content_id: str | None = None,
    story_id: str | None = None,
    run_hooks: bool = True,
) -> None:
    from spica_transaction import commit_changes, print_plan

    if run_hooks:
        run_postprocessors(
            changes,
            {
                "operation": operation,
                "content_id": content_id,
                "story_id": story_id,
            },
        )
    print("\n全部输入和检查已经完成。")
    print_plan(changes)
    print("\n在你确认之前，项目文件尚未被修改。")
    if not confirm("确认执行以上全部变更吗？"):
        print("已取消，没有修改项目文件。")
        return
    commit_changes(changes)
    print("处理成功；事务缓存已清理。")


def create_solo_flow(paths: ProjectPaths) -> None:
    from create_solo import build_solo

    print("\n请选择内容类型：\n  1. 文章\n  2. 单页故事")
    choice = ask("输入 1 或 2：")
    if choice not in {"1", "2"}:
        raise SpicaError("内容类型只能选择 1 或 2。")
    section = "article" if choice == "1" else "histoire"
    clock = OperationClock.capture()
    changes = ChangeSet(paths.root)
    content_id, title, allow_nonstandard = ask_valid_identity(changes, paths, section)
    common = ask_common_content(changes, paths, clock)
    print("正文文件可留空；留空时会创建一个正文区域为空的基础页面。")
    source = ask_path("正文 .md/.txt 路径（可直接回车）：", optional=True)
    allow_html = False
    if source:
        allow_html = confirm("是否允许正文文件中的原始 HTML 标签生效？默认会安全转义", default=False)
    build_solo(
        changes,
        paths,
        section=section,
        content_id=content_id,
        title=title,
        source=source,
        allow_nonstandard_id=allow_nonstandard,
        allow_html=allow_html,
        clock=clock,
        **common,
    )
    finalize(changes, "create_solo", content_id=content_id)


def create_serial_flow(paths: ProjectPaths) -> None:
    from create_serial_story import build_serial_story

    clock = OperationClock.capture()
    changes = ChangeSet(paths.root)
    content_id, title, allow_nonstandard = ask_valid_identity(changes, paths, "histoire")
    common = ask_common_content(changes, paths, clock)
    build_serial_story(
        changes,
        paths,
        content_id=content_id,
        title=title,
        allow_nonstandard_id=allow_nonstandard,
        clock=clock,
        **common,
    )
    finalize(changes, "create_serial_story", content_id=content_id)


def create_chapters_flow(paths: ProjectPaths) -> None:
    from create_chapters import build_chapters, discover_sources

    story_id = ask("请输入母故事 ID，例如 HWAYJ：")
    print(
        "可以输入一个 .md/.txt 文件，也可以输入目录。目录模式只读取以整数命名的文件，"
        "例如 1.md、2.txt、10.md，并按数字排序。"
    )
    source_root = ask_path("章节文件或目录路径：")
    sources = discover_sources(source_root)
    print("识别到以下章节源文件：")
    for index, source in enumerate(sources, 1):
        print(f"  {index}. {source.name}")
    titles: list[str] = []
    for index, source in enumerate(sources, 1):
        titles.append(ask(f"请输入第 {index} 个文件 {source.name} 的章节名："))
    allow_html = confirm("是否允许章节源文件中的原始 HTML 标签生效？", default=False)
    changes = ChangeSet(paths.root)
    build_chapters(
        changes,
        paths,
        story_id=story_id,
        sources=sources,
        titles=titles,
        allow_html=allow_html,
        clock=OperationClock.capture(),
    )
    finalize(changes, "create_chapters", story_id=story_id)


def word_count_flow(paths: ProjectPaths) -> None:
    from word_count import FULL_SITE_INPUTS, update_all, update_one

    target = ask(
        "请输入需要统计的文章/故事 ID。\n"
        "输入 ALL 或 全站，会重新统计主 JSON 中登记的全部内容。\nID："
    )
    changes = ChangeSet(paths.root)
    if target.casefold() in FULL_SITE_INPUTS:
        update_all(changes, paths)
    else:
        update_one(changes, paths, target)
    finalize(changes, "manual_word_count", run_hooks=False)


def font_patch_flow(paths: ProjectPaths) -> None:
    from font_patch import process

    print(
        "将扫描全站 HTML、JSON 与前端脚本中的实际可渲染文字，跳过注释、代码语法"
        "以及母版中不存在的字符。\n首页与全局界面字符进入 Core，其余内容进入 Extra；"
        "离线母版 LXGWWenKai.ttf 不会被修改或在线引用。"
    )
    changes = ChangeSet(paths.root)
    process(changes, {"operation": "manual_font_patch"})
    if not changes.writes:
        print("字体覆盖已经完整，不需要修改。")
        return
    finalize(changes, "manual_font_patch", run_hooks=False)


def main() -> int:
    configure_console()
    try:
        paths = ProjectPaths.discover()
        print("正在检查脚本模块、模板、JSON 和 Python 依赖……")
        preflight(paths)
        from spica_transaction import recover_incomplete

        recovered = recover_incomplete(paths.root)
        if recovered:
            print(f"已自动回滚 {len(recovered)} 个上次未完成的事务。")
        print("检查通过。输入 /q 可随时取消当前尚未提交的操作。")

        while True:
            print(
                "\n========== Spica 内容工具 =========="
                "\n  1. 创建文章/单页故事"
                "\n  2. 创建多章故事"
                "\n  3. 为多章故事添加章节"
                "\n  4. 立刻进行字数统计"
                "\n  5. 立刻进行全站字体修补"
                "\n  0. 退出"
            )
            choice = ask("请选择功能：")
            if choice == "0":
                print("已退出。")
                return 0
            try:
                if choice == "1":
                    create_solo_flow(paths)
                elif choice == "2":
                    create_serial_flow(paths)
                elif choice == "3":
                    create_chapters_flow(paths)
                elif choice == "4":
                    word_count_flow(paths)
                elif choice == "5":
                    font_patch_flow(paths)
                else:
                    print("无效选择，请输入 0 到 5。")
            except UserCancelled:
                print("当前操作已取消；尚未提交，因此项目文件未被修改。")
            except SpicaError as exc:
                print(f"操作未执行：{exc}")
            if not confirm("是否返回主菜单继续？", default=True):
                print("已退出。")
                return 0
    except UserCancelled:
        print("已取消。")
        return 0
    except (SpicaError, EOFError, KeyboardInterrupt) as exc:
        if isinstance(exc, KeyboardInterrupt):
            print("\n已中断；未提交的操作不会修改项目文件。", file=sys.stderr)
        else:
            print(f"启动失败：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
