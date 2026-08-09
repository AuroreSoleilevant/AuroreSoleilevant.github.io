from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock


TOOLS = Path(__file__).resolve().parents[1]
PROJECT = TOOLS.parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from create_chapters import build_chapters, discover_sources
from create_serial_story import build_serial_story
from create_solo import build_solo
from create_tag import build_tag
from font_patch import (
    _font_cmap,
    _rewrite_font_face,
    build_subset,
    extract_code_strings,
    format_unicode_range,
    scan_file_text,
)
from md_to_html import convert_text
from spica_core import ChangeSet, OperationClock, ProjectPaths, parse_input_path
from spica_transaction import commit_changes
from word_count import count_html_text, process as count_process, update_all


class SpicaToolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "站点测试"
        (self.root / "tools" / "template").mkdir(parents=True)
        for template in (PROJECT / "tools" / "template").iterdir():
            if template.is_file():
                shutil.copy2(template, self.root / "tools" / "template" / template.name)
        (self.root / "json" / "histoire").mkdir(parents=True)
        for directory in (
            "article",
            "histoire",
            "tag",
            "images/article/cards",
            "images/histoire/cards",
        ):
            (self.root / directory).mkdir(parents=True, exist_ok=True)
        (self.root / "json" / "article.json").write_text("[]\n", encoding="utf-8")
        (self.root / "json" / "histoire.json").write_text("[]\n", encoding="utf-8")
        (self.root / "json" / "tag.json").write_text(
            json.dumps([{"fr": "amour", "zh": "爱情"}], ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        self.paths = ProjectPaths(self.root)
        self.clock = OperationClock(
            local=datetime(2026, 8, 9, 12, 30, tzinfo=timezone.utc),
            utc=datetime(2026, 8, 9, 12, 30, tzinfo=timezone.utc),
        )
        from PIL import Image

        self.cover = self.root / "外部封面 测试.png"
        Image.new("RGB", (800, 800), (30, 120, 200)).save(self.cover)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_text_conversion_escapes_symbols(self) -> None:
        self.assertEqual(convert_text("你好 & <世界>\n\n第二行"), "<p>你好 &amp; &lt;世界&gt;</p>\n<p>第二行</p>")

    def test_quoted_windows_style_path(self) -> None:
        self.assertEqual(parse_input_path(f'"{self.cover}"'), self.cover.resolve())

    def test_word_count_matches_mots_unicode_ranges_and_main_only(self) -> None:
        page = """
        <html><body><main>汉字A，㐀豈𠀀<br>继续<script>脚本文字</script></main>
        <div>正文外文字</div></body></html>
        """
        self.assertEqual(count_html_text(page), 7)

    def test_font_scanner_excludes_comments_code_and_hidden_text(self) -> None:
        page = """
        <!-- 注释韩 -->
        <main>正文<img alt="图"><input hidden value="隐藏"><p>继续</p></main>
        <script>
          // 注释帧
          const count = 速度 * 2;
          const label = "昵称";
          const template = `欢迎${name}`;
        </script>
        """
        visible, core = scan_file_text(Path("article/TEST/index.html"), page)
        for character in "正文图继续昵称欢迎":
            self.assertIn(ord(character), visible)
        for character in "韩帧隐藏速度":
            self.assertNotIn(ord(character), visible)
        self.assertFalse(core)
        _, home_core = scan_file_text(Path("index.html"), page)
        self.assertTrue({ord(character) for character in "正文图继续昵称欢迎"} <= home_core)

    def test_code_string_extraction_decodes_unicode_and_skips_comments(self) -> None:
        source = r'''// "注释"
        const a = "\u6635称";
        const b = '\x41';
        /* `帧` */
        '''
        self.assertEqual(
            extract_code_strings(source, javascript=True),
            ["昵称", "A"],
        )

    def test_code_string_extraction_ignores_console_and_error_messages(self) -> None:
        source = '''
        console.error("仅控制台");
        throw new Error("仅异常");
        element.textContent = "页面可见";
        '''
        self.assertEqual(extract_code_strings(source, javascript=True), ["页面可见"])

    def test_font_face_rewrite_is_limited_to_matching_block(self) -> None:
        css = """
        @font-face { src: url('latin.woff2'); unicode-range: U+0000-00FF; }
        @font-face { src: url('../fonts/LXGWWenKai-cjk-core.woff2'); unicode-range: U+4E00; }
        """
        updated = _rewrite_font_face(
            css,
            "LXGWWenKai-cjk-core.woff2",
            {0x4E00, 0x4E01, 0x4E03},
            "abc123",
        )
        self.assertIn("unicode-range: U+0000-00FF", updated)
        self.assertIn("LXGWWenKai-cjk-core.woff2?v=abc123", updated)
        self.assertIn("unicode-range: U+4E00-4E01, U+4E03", updated)

    def test_font_subset_uses_only_requested_supported_characters(self) -> None:
        master = (PROJECT / "fonts" / "LXGWWenKai.ttf").read_bytes()
        subset = build_subset(master, {ord("呦"), ord("蒟"), ord("蒻")})
        self.assertEqual(_font_cmap(subset, "测试子集"), {ord("呦"), ord("蒟"), ord("蒻")})
        self.assertTrue(subset.startswith(b"wOF2"))

    def test_unicode_range_compacts_adjacent_codepoints(self) -> None:
        self.assertEqual(format_unicode_range({0x41, 0x42, 0x44}), "U+0041-0042, U+0044")

    def test_tag_builder_is_staged_until_commit(self) -> None:
        changes = ChangeSet(self.root)
        build_tag(changes, self.paths, "测试标签", "essai", self.clock)
        output = self.root / "tag" / "essai" / "index.html"
        self.assertFalse(output.exists())
        commit_changes(changes)
        self.assertTrue(output.is_file())
        rows = json.loads((self.root / "json" / "tag.json").read_text(encoding="utf-8"))
        self.assertEqual(rows[-1], {"fr": "essai", "zh": "测试标签"})
        self.assertFalse((self.root / "tools" / ".spica-cache").exists())

    def test_solo_creation_and_center_card(self) -> None:
        source = self.root / "正文.txt"
        source.write_text("第一行\n第二行 & 符号", encoding="utf-8")
        changes = ChangeSet(self.root)
        build_solo(
            changes,
            self.paths,
            section="article",
            content_id="090826A",
            title="中文测试文章",
            description="简介，包含中文与符号 &。",
            image=self.cover,
            color="rgba(10,20,30,0.5)",
            tags=["爱情"],
            source=source,
            allow_nonstandard_id=False,
            allow_html=False,
            clock=self.clock,
        )
        count_process(changes, {"operation": "create_solo", "content_id": "090826A"})
        page = self.root / "article" / "090826A" / "index.html"
        self.assertFalse(page.exists())
        commit_changes(changes)
        entry = json.loads((self.root / "json" / "article.json").read_text(encoding="utf-8"))[0]
        self.assertGreater(entry["word_count"], 0)
        self.assertEqual(entry["cover_image"], "/images/article/外部封面 测试.png")
        self.assertIn("&amp;", page.read_text(encoding="utf-8"))
        from PIL import Image

        with Image.open(self.root / "images" / "article" / "cards" / "外部封面 测试.webp") as card:
            self.assertEqual(card.size, (1200, 280))
            self.assertEqual(card.format, "WEBP")

    def test_serial_story_then_batch_chapters(self) -> None:
        changes = ChangeSet(self.root)
        build_serial_story(
            changes,
            self.paths,
            content_id="HTEST",
            title="多章测试",
            description="简介",
            image=self.cover,
            color="rgba(1, 2, 3, 0.4)",
            tags=[],
            allow_nonstandard_id=False,
            clock=self.clock,
        )
        count_process(changes, {"operation": "create_serial_story", "content_id": "HTEST"})
        commit_changes(changes)
        copied = self.root / "json" / "histoire" / "HTEST.json"
        self.assertEqual(copied.read_bytes(), (self.root / "tools" / "template" / "chapter.json").read_bytes())

        batch = self.root / "批量章节"
        batch.mkdir()
        (batch / "10.md").write_text("十", encoding="utf-8")
        (batch / "2.txt").write_text("二", encoding="utf-8")
        (batch / "说明.txt").write_text("忽略", encoding="utf-8")
        sources = discover_sources(batch)
        self.assertEqual([item.name for item in sources], ["2.txt", "10.md"])
        changes = ChangeSet(self.root)
        later = OperationClock(
            local=datetime(2026, 8, 10, 8, 0, tzinfo=timezone.utc),
            utc=datetime(2026, 8, 10, 8, 0, tzinfo=timezone.utc),
        )
        build_chapters(
            changes,
            self.paths,
            story_id="HTEST",
            sources=sources,
            titles=["第二文件", "第十文件"],
            allow_html=False,
            clock=later,
        )
        count_process(changes, {"operation": "create_chapters", "story_id": "HTEST"})
        commit_changes(changes)
        rows = json.loads(copied.read_text(encoding="utf-8"))["chapters"]
        self.assertEqual([row["id"] for row in rows], [0, 1, 2])
        self.assertTrue((self.root / "histoire" / "HTEST" / "1" / "index.html").is_file())
        self.assertTrue((self.root / "histoire" / "HTEST" / "2" / "index.html").is_file())
        root_page = (self.root / "histoire" / "HTEST" / "index.html").read_text(encoding="utf-8")
        self.assertIn("上次更新：10/08/2026", root_page)
        story_entry = json.loads((self.root / "json" / "histoire.json").read_text(encoding="utf-8"))[0]
        expected = sum(
            count_html_text(page.read_text(encoding="utf-8"))
            for page in (
                self.root / "histoire" / "HTEST" / "index.html",
                self.root / "histoire" / "HTEST" / "1" / "index.html",
                self.root / "histoire" / "HTEST" / "2" / "index.html",
            )
        )
        self.assertEqual(story_entry["word_count"], expected)

    def test_full_site_recurses_special_story_but_ignores_unlisted_folder(self) -> None:
        story_dir = self.root / "histoire" / "HBRANCH"
        child_dir = story_dir / "ENDING"
        child_dir.mkdir(parents=True)
        base_page = "<html><head></head><body><main>根页面</main></body></html>"
        child_page = "<html><head></head><body><main>分支结局</main></body></html>"
        (story_dir / "index.html").write_text(base_page, encoding="utf-8")
        (child_dir / "index.html").write_text(child_page, encoding="utf-8")
        unlisted = self.root / "histoire" / "HUNLISTED"
        unlisted.mkdir()
        (unlisted / "index.html").write_text(
            "<html><head></head><body><main>不应统计的文字</main></body></html>", encoding="utf-8"
        )
        entries = [
            {
                "id": "HBRANCH",
                "url": "/histoire/HBRANCH",
                "title": "分支",
                "description": "",
                "cover_image": "",
                "created_at": "2026-08-09T00:00:00Z",
                "updated_at": "2026-08-09T00:00:00Z",
                "word_count": 0,
                "color": "rgba(0, 0, 0, 0)",
                "tags": [],
            }
        ]
        (self.root / "json" / "histoire.json").write_text(
            json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        changes = ChangeSet(self.root)
        update_all(changes, self.paths)
        pending = json.loads(changes.read_text("json/histoire.json"))
        self.assertEqual(pending[0]["word_count"], 7)

    def test_transaction_rolls_back_apply_failure(self) -> None:
        existing = self.root / "json" / "article.json"
        original = existing.read_bytes()
        new_file = self.root / "article" / "FAIL" / "index.html"
        changes = ChangeSet(self.root)
        changes.set_text(existing, "[{}]\n", "测试修改")
        changes.set_text(
            new_file,
            "<!DOCTYPE html><html><head></head><body><main></main></body></html>",
            "测试新文件",
        )

        import spica_transaction

        real_replace = spica_transaction.os.replace
        failed = {"done": False}

        def fail_one_staged_replace(source, destination):
            source_text = str(source).replace("\\", "/")
            if "/staged/" in source_text and not failed["done"]:
                failed["done"] = True
                raise OSError("injected failure")
            return real_replace(source, destination)

        with mock.patch.object(spica_transaction.os, "replace", side_effect=fail_one_staged_replace):
            with self.assertRaises(OSError):
                commit_changes(changes)
        self.assertEqual(existing.read_bytes(), original)
        self.assertFalse(new_file.exists())
        self.assertFalse((self.root / "tools" / ".spica-cache").exists())


if __name__ == "__main__":
    unittest.main()
