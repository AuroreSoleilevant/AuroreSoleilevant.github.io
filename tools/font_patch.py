"""字体修补器预留接口；下一轮实现实际修补。"""

from __future__ import annotations

import argparse

from spica_core import ChangeSet, configure_console


IMPLEMENTED = False


def process(changes: ChangeSet, context: dict | None = None) -> None:
    """创建器后处理接口。第一轮不修改变更集。"""
    return None


def main(argv: list[str] | None = None) -> int:
    configure_console()
    argparse.ArgumentParser(description="Spica 字体修补器（预留，尚未实现）").parse_args(argv)
    print("字体修补功能尚未实现。")
    return 3


if __name__ == "__main__":
    raise SystemExit(main())

