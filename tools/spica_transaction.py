"""Spica 多文件事务：先暂存、验证，再提交；异常时回滚。"""

from __future__ import annotations

import json
import hashlib
import os
import shutil
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path

from spica_core import ChangeSet, SpicaError, validate_change_set


CACHE_NAME = ".spica-cache"


@contextmanager
def _project_lock(project_root: Path):
    """使用系统临时目录中的进程锁，避免两个创建器同时提交。"""
    digest = hashlib.sha256(str(project_root.resolve()).casefold().encode("utf-8")).hexdigest()[:20]
    lock_path = Path(tempfile.gettempdir()) / f"spica-{digest}.lock"
    handle = lock_path.open("a+b")
    handle.seek(0)
    if handle.read(1) != b"1":
        handle.seek(0)
        handle.write(b"1")
        handle.flush()
    handle.seek(0)
    try:
        if os.name == "nt":
            import msvcrt

            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError as exc:
                raise SpicaError("另一个 Spica 创建器正在提交文件，请稍后再试。") from exc
        else:
            import fcntl

            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as exc:
                raise SpicaError("另一个 Spica 创建器正在提交文件，请稍后再试。") from exc
        yield
    finally:
        try:
            if os.name == "nt":
                import msvcrt

                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass
        handle.close()
        try:
            lock_path.unlink()
        except OSError:
            pass


def _atomic_json(path: Path, value: object) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def _remove_empty_parents(path: Path, stop: Path) -> None:
    current = path.parent
    stop = stop.resolve()
    while current != stop:
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent


def _rollback_transaction(project_root: Path, transaction_dir: Path, journal: dict) -> None:
    entries = journal.get("entries", [])
    for entry in reversed(entries):
        destination = project_root / entry["relative"]
        backup = transaction_dir / entry["backup"]
        if entry["existed"]:
            if backup.is_file():
                destination.parent.mkdir(parents=True, exist_ok=True)
                recovery = destination.with_name(destination.name + ".spica-recovery")
                shutil.copy2(backup, recovery)
                os.replace(recovery, destination)
        else:
            try:
                destination.unlink()
            except FileNotFoundError:
                pass
            _remove_empty_parents(destination, project_root)


def _recover_incomplete_unlocked(project_root: Path) -> list[str]:
    cache_root = project_root / "tools" / CACHE_NAME
    recovered: list[str] = []
    if not cache_root.is_dir():
        return recovered
    for transaction_dir in sorted(cache_root.iterdir()):
        if not transaction_dir.is_dir():
            continue
        journal_path = transaction_dir / "journal.json"
        if journal_path.is_file():
            try:
                journal = json.loads(journal_path.read_text(encoding="utf-8"))
                if journal.get("status") == "applying":
                    _rollback_transaction(project_root, transaction_dir, journal)
                    recovered.append(transaction_dir.name)
            except Exception as exc:
                raise SpicaError(
                    f"发现无法自动恢复的事务缓存：{transaction_dir}。请先人工检查。错误：{exc}"
                ) from exc
        shutil.rmtree(transaction_dir, ignore_errors=False)
    try:
        cache_root.rmdir()
    except OSError:
        pass
    return recovered


def recover_incomplete(project_root: Path) -> list[str]:
    """恢复上次未完成的提交，并清理残留的完整事务缓存。"""
    if not (project_root / "tools" / CACHE_NAME).exists():
        return []
    with _project_lock(project_root):
        return _recover_incomplete_unlocked(project_root)


def commit_changes(changes: ChangeSet) -> None:
    if not changes.writes:
        raise SpicaError("没有需要提交的文件变更。")
    validate_change_set(changes)
    root = changes.root.resolve()
    with _project_lock(root):
        _recover_incomplete_unlocked(root)
        transaction_id = uuid.uuid4().hex
        cache_root = root / "tools" / CACHE_NAME
        transaction_dir = cache_root / transaction_id
        staged_root = transaction_dir / "staged"
        backup_root = transaction_dir / "backup"
        staged_root.mkdir(parents=True, exist_ok=False)
        backup_root.mkdir(parents=True, exist_ok=False)

        entries: list[dict] = []
        try:
            for index, (destination, data) in enumerate(
                sorted(changes.writes.items(), key=lambda item: str(item[0]).casefold())
            ):
                relative = destination.relative_to(root)
                staged = staged_root / f"{index:04d}.bin"
                staged.write_bytes(data)
                existed = destination.is_file()
                backup_relative = f"backup/{index:04d}.bin"
                if existed:
                    shutil.copy2(destination, transaction_dir / backup_relative)
                entries.append(
                    {
                        "relative": relative.as_posix(),
                        "staged": f"staged/{index:04d}.bin",
                        "backup": backup_relative,
                        "existed": existed,
                    }
                )

            journal = {"status": "applying", "entries": entries}
            _atomic_json(transaction_dir / "journal.json", journal)

            for entry in entries:
                destination = root / entry["relative"]
                destination.parent.mkdir(parents=True, exist_ok=True)
                staged = transaction_dir / entry["staged"]
                os.replace(staged, destination)

            journal["status"] = "complete"
            _atomic_json(transaction_dir / "journal.json", journal)
        except BaseException:
            journal_path = transaction_dir / "journal.json"
            if journal_path.is_file():
                journal = json.loads(journal_path.read_text(encoding="utf-8"))
                _rollback_transaction(root, transaction_dir, journal)
            shutil.rmtree(transaction_dir, ignore_errors=True)
            try:
                cache_root.rmdir()
            except OSError:
                pass
            raise
        else:
            shutil.rmtree(transaction_dir, ignore_errors=False)
            try:
                cache_root.rmdir()
            except OSError:
                pass


def print_plan(changes: ChangeSet) -> None:
    print("将执行以下文件操作：")
    for line in changes.summary_lines():
        print(f"  - {line}")
