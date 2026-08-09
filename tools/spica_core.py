"""Spica 自动化脚本的公共数据、校验与渲染工具。"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


BEGIN_BODY = "<!-- SPICA:BEGIN:MARKDOWN_BODY -->"
END_BODY = "<!-- SPICA:END:MARKDOWN_BODY -->"
ARTICLE_ID_RE = re.compile(r"^\d{6}[A-Z]$")
STORY_ID_RE = re.compile(r"^H[A-Z]+$")
RGBA_RE = re.compile(
    r"^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*"
    r"(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$",
    re.IGNORECASE,
)
INVALID_WINDOWS_CHARS = set('<>:"/\\|?*')
WINDOWS_RESERVED = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


class SpicaError(Exception):
    """可向使用者直接显示的预期错误。"""


@dataclass(frozen=True)
class OperationClock:
    local: datetime
    utc: datetime

    @classmethod
    def capture(cls) -> "OperationClock":
        local = datetime.now().astimezone().replace(microsecond=0)
        return cls(local=local, utc=local.astimezone(timezone.utc))

    @property
    def iso_utc(self) -> str:
        return self.utc.isoformat().replace("+00:00", "Z")

    @property
    def display_date(self) -> str:
        return self.local.strftime("%d/%m/%Y")

    @property
    def year(self) -> str:
        return str(self.local.year)


@dataclass(frozen=True)
class ProjectPaths:
    root: Path

    @classmethod
    def discover(cls, start: Path | None = None) -> "ProjectPaths":
        candidate = (start or Path(__file__).resolve().parent).resolve()
        if candidate.is_file():
            candidate = candidate.parent
        for path in (candidate, *candidate.parents):
            if (path / "json" / "article.json").is_file() and (path / "tools").is_dir():
                return cls(path)
        raise SpicaError("无法定位项目根目录：未找到 json/article.json 和 tools 文件夹。")

    @property
    def tools(self) -> Path:
        return self.root / "tools"

    @property
    def templates(self) -> Path:
        return self.tools / "template"


@dataclass
class ChangeSet:
    root: Path
    writes: dict[Path, bytes] = field(default_factory=dict)
    descriptions: dict[Path, str] = field(default_factory=dict)

    def _absolute(self, path: Path | str) -> Path:
        candidate = Path(path)
        if not candidate.is_absolute():
            candidate = self.root / candidate
        candidate = candidate.resolve()
        try:
            candidate.relative_to(self.root.resolve())
        except ValueError as exc:
            raise SpicaError(f"拒绝修改项目目录之外的文件：{candidate}") from exc
        return candidate

    def set_bytes(self, path: Path | str, content: bytes, description: str) -> None:
        target = self._absolute(path)
        self.writes[target] = content
        self.descriptions[target] = description

    def set_text(self, path: Path | str, content: str, description: str) -> None:
        self.set_bytes(path, content.encode("utf-8"), description)

    def read_bytes(self, path: Path | str) -> bytes:
        target = self._absolute(path)
        if target in self.writes:
            return self.writes[target]
        try:
            return target.read_bytes()
        except FileNotFoundError as exc:
            raise SpicaError(f"文件不存在：{target}") from exc

    def read_text(self, path: Path | str) -> str:
        return decode_text(self.read_bytes(path), str(path))

    def exists(self, path: Path | str) -> bool:
        target = self._absolute(path)
        return target in self.writes or target.exists()

    def summary_lines(self) -> list[str]:
        lines: list[str] = []
        for path in sorted(self.writes, key=lambda item: str(item).casefold()):
            relative = path.relative_to(self.root)
            action = "修改" if path.exists() else "创建"
            detail = self.descriptions.get(path, "")
            lines.append(f"{action} {relative}{' — ' + detail if detail else ''}")
        return lines


def configure_console() -> None:
    """非 Windows 终端尽量启用 UTF-8；Windows 保留其 Unicode 控制台编码。"""
    if os.name == "nt":
        return
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (OSError, ValueError):
                pass


def strip_wrapping_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1].strip()
    return value


def parse_input_path(value: str, *, must_exist: bool = True) -> Path:
    cleaned = os.path.expandvars(os.path.expanduser(strip_wrapping_quotes(value)))
    if not cleaned:
        raise SpicaError("路径不能为空。")
    path = Path(cleaned).resolve()
    if must_exist and not path.exists():
        raise SpicaError(f"路径不存在：{path}")
    return path


def decode_text(data: bytes, label: str = "文本") -> str:
    for encoding in ("utf-8-sig", "gb18030"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise SpicaError(f"{label} 不是可识别的 UTF-8 或 GB18030 文本。")


def read_source_text(path: Path) -> str:
    if path.suffix.casefold() not in {".md", ".txt"}:
        raise SpicaError(f"仅支持 .md 或 .txt 文件：{path}")
    return decode_text(path.read_bytes(), str(path))


def safe_segment(value: str, label: str) -> str:
    value = unicodedata.normalize("NFC", value.strip())
    if not value:
        raise SpicaError(f"{label}不能为空。")
    if value in {".", ".."} or value.endswith((" ", ".")):
        raise SpicaError(f"{label}不是安全的目录名称：{value}")
    if any(char in INVALID_WINDOWS_CHARS or ord(char) < 32 for char in value):
        raise SpicaError(f"{label}包含 Windows 路径不允许的字符：{value}")
    if value.split(".", 1)[0].upper() in WINDOWS_RESERVED:
        raise SpicaError(f"{label}使用了 Windows 保留名称：{value}")
    return value


def normalized_key(value: str) -> str:
    return unicodedata.normalize("NFC", value).strip().casefold()


def id_matches(section: str, content_id: str) -> bool:
    pattern = ARTICLE_ID_RE if section == "article" else STORY_ID_RE
    return bool(pattern.fullmatch(content_id))


def id_warning(section: str, content_id: str) -> str | None:
    if id_matches(section, content_id):
        return None
    example = "080826A" if section == "article" else "HABC"
    rule = "DDMMYY 加一个大写字母" if section == "article" else "H 加一串大写字母"
    return f"ID“{content_id}”不符合推荐格式（{rule}，例如 {example}）。"


def normalize_rgba(value: str) -> str:
    match = RGBA_RE.fullmatch(value.strip())
    if not match:
        raise SpicaError("颜色必须使用 RGBA，例如 rgba(48, 167, 255, 0.3)。")
    red, green, blue = (int(match.group(i)) for i in range(1, 4))
    if any(channel > 255 for channel in (red, green, blue)):
        raise SpicaError("RGBA 的红、绿、蓝通道必须在 0 到 255 之间。")
    alpha = float(match.group(4))
    alpha_text = f"{alpha:.6f}".rstrip("0").rstrip(".")
    return f"rgba({red}, {green}, {blue}, {alpha_text})"


def load_json(changes: ChangeSet, path: Path | str, expected: type | None = None) -> Any:
    raw = changes.read_text(path)
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SpicaError(f"JSON 格式错误：{path}（第 {exc.lineno} 行）") from exc
    if expected is not None and not isinstance(value, expected):
        raise SpicaError(f"JSON 顶层类型错误：{path} 应为 {expected.__name__}。")
    return value


def serialize_json_like(original: str, value: Any) -> str:
    multiline = "\n" in original.strip()
    ending = "\n" if original.endswith(("\n", "\r")) else ""
    if multiline:
        return json.dumps(value, ensure_ascii=False, indent=2) + ending
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")) + ending


def stage_json(
    changes: ChangeSet,
    path: Path | str,
    value: Any,
    description: str,
) -> None:
    original = changes.read_text(path)
    rendered = serialize_json_like(original, value)
    try:
        json.loads(rendered)
    except json.JSONDecodeError as exc:
        raise SpicaError(f"内部错误：生成的 JSON 无法重新解析：{path}") from exc
    changes.set_text(path, rendered, description)


def require_unique_content(changes: ChangeSet, content_id: str, title: str) -> None:
    wanted_id = normalized_key(content_id)
    wanted_title = normalized_key(title)
    for database in ("json/article.json", "json/histoire.json"):
        for entry in load_json(changes, database, list):
            if normalized_key(str(entry.get("id", ""))) == wanted_id:
                raise SpicaError(f"ID 已存在：{content_id}（位于 {database}）")
            if normalized_key(str(entry.get("title", ""))) == wanted_title:
                raise SpicaError(f"标题已存在：{title}（位于 {database}）")


def require_dependencies(modules: dict[str, str]) -> list[str]:
    missing = []
    for module, display_name in modules.items():
        if importlib.util.find_spec(module) is None:
            missing.append(display_name)
    return missing


def render_template(paths: ProjectPaths, template_name: str, **context: Any) -> str:
    try:
        from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape
    except ImportError as exc:
        raise SpicaError(
            "缺少 Jinja2。请运行：python -m pip install -r tools/requirements.txt"
        ) from exc
    template_path = paths.templates / template_name
    if not template_path.is_file():
        raise SpicaError(f"缺少模板：{template_path}")
    environment = Environment(
        loader=FileSystemLoader(str(paths.templates)),
        autoescape=select_autoescape(enabled_extensions=("j2", "html")),
        undefined=StrictUndefined,
        keep_trailing_newline=True,
    )
    try:
        return environment.get_template(template_name).render(**context)
    except Exception as exc:
        raise SpicaError(f"模板 {template_name} 渲染失败：{exc}") from exc


def inject_body(page: str, body_html: str) -> str:
    if page.count(BEGIN_BODY) != 1 or page.count(END_BODY) != 1:
        raise SpicaError("模板中的正文起止标记缺失或重复。")
    before, remainder = page.split(BEGIN_BODY, 1)
    _, after = remainder.split(END_BODY, 1)
    body = body_html.strip()
    middle = f"\n{body}\n" if body else "\n"
    return before + BEGIN_BODY + middle + END_BODY + after


def extract_body(page: str) -> str:
    if page.count(BEGIN_BODY) != 1 or page.count(END_BODY) != 1:
        raise SpicaError("现有页面缺少唯一的正文起止标记，无法安全更新页面外壳。")
    return page.split(BEGIN_BODY, 1)[1].split(END_BODY, 1)[0].strip()


def parse_iso_datetime(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise SpicaError(f"无法解析日期：{value}") from exc


def display_date_from_iso(value: str) -> str:
    return parse_iso_datetime(value).astimezone().strftime("%d/%m/%Y")


def validate_tags(changes: ChangeSet, tags: Iterable[str]) -> list[str]:
    rows = load_json(changes, "json/tag.json", list)
    known = {normalized_key(str(row.get("zh", ""))): str(row.get("zh", "")) for row in rows}
    result: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        key = normalized_key(tag)
        if not key or key in seen:
            continue
        if key not in known:
            raise SpicaError(f"标签不存在：{tag}。请先创建标签或同时提供新标签信息。")
        result.append(known[key])
        seen.add(key)
    return result


def merge_changes(destination: ChangeSet, source: ChangeSet) -> None:
    for path, data in source.writes.items():
        destination.set_bytes(path, data, source.descriptions.get(path, ""))


def run_postprocessors(changes: ChangeSet, context: dict | None = None) -> None:
    """统一调用创建器后处理钩子；第一轮实现不会改变文件。"""
    try:
        import font_patch
        import word_count
    except ImportError as exc:
        raise SpicaError(f"缺少后处理模块：{exc.name}") from exc
    word_count.process(changes, context)
    font_patch.process(changes, context)


def validate_change_set(changes: ChangeSet) -> None:
    """在建立任何事务缓存前重新验证所有待写入产物。"""
    unresolved = re.compile(r"\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*\}\}")
    for path, data in changes.writes.items():
        suffix = path.suffix.casefold()
        if suffix == ".json":
            try:
                json.loads(decode_text(data, str(path)))
            except json.JSONDecodeError as exc:
                raise SpicaError(f"待提交 JSON 无效：{path}（第 {exc.lineno} 行）") from exc
        elif path.name.casefold() == "index.html":
            page = decode_text(data, str(path))
            lower = page.casefold()
            for tag in ("html", "head", "body", "main"):
                if lower.count(f"<{tag}") != 1 or lower.count(f"</{tag}>") != 1:
                    raise SpicaError(f"待提交 HTML 的 <{tag}> 结构不完整：{path}")
            if unresolved.search(page):
                raise SpicaError(f"待提交 HTML 仍含未渲染模板变量：{path}")
        elif suffix == ".webp" and path.parent.name.casefold() == "cards":
            try:
                from PIL import Image
                import io

                with Image.open(io.BytesIO(data)) as image:
                    if image.format != "WEBP" or image.size != (1200, 280):
                        raise SpicaError(f"卡片图尺寸或格式错误：{path}")
            except SpicaError:
                raise
            except Exception as exc:
                raise SpicaError(f"待提交卡片图无法读取：{path}（{exc}）") from exc
