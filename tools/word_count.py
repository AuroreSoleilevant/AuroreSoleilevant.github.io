"""字数统计器预留接口；下一轮实现实际统计。"""

from __future__ import annotations

import argparse

from spica_core import ChangeSet, configure_console


IMPLEMENTED = False


def process(changes: ChangeSet, context: dict | None = None) -> None:
    """创建器后处理接口。第一轮保持 word_count=0，不修改变更集。"""
    return None


def main(argv: list[str] | None = None) -> int:
    configure_console()
    argparse.ArgumentParser(description="Spica 字数统计器（预留，尚未实现）").parse_args(argv)
    print("字数统计功能尚未实现；第一轮创建器会将 word_count 写为 0。")
    return 3


if __name__ == "__main__":
    raise SystemExit(main())

