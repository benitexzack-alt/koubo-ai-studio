"""Run the unchanged knowledge validator against a guarded, read-only index."""

import argparse
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import sqlite3
import stat
import sys


def file_sha256(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


class ReadonlyIndex:
    def __init__(self, database, expected_sha256):
        self.database = Path(database)
        self.expected_sha256 = expected_sha256
        self.before = self.inspect()
        self.original_connect = sqlite3.connect
        self.connections = 0

    def inspect(self):
        if self.database.is_symlink() or self.database.resolve() != self.database:
            raise RuntimeError("INDEX_PATH_NOT_CANONICAL")
        for suffix in ("-wal", "-shm", "-journal"):
            if os.path.lexists(str(self.database) + suffix):
                raise RuntimeError("INDEX_JOURNAL_PRESENT:" + suffix)
        info = self.database.stat()
        if not stat.S_ISREG(info.st_mode):
            raise RuntimeError("INDEX_NOT_REGULAR")
        identity = (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)
        if file_sha256(self.database) != self.expected_sha256:
            raise RuntimeError("INDEX_SHA_MISMATCH")
        after = self.database.stat()
        if identity != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns):
            raise RuntimeError("INDEX_READ_DRIFT")
        for suffix in ("-wal", "-shm", "-journal"):
            if os.path.lexists(str(self.database) + suffix):
                raise RuntimeError("INDEX_JOURNAL_PRESENT:" + suffix)
        return identity

    def assert_unchanged(self):
        if self.inspect() != self.before:
            raise RuntimeError("INDEX_CHANGED_DURING_VALIDATION")

    def connect(self, database, *args, **kwargs):
        if args or kwargs or Path(database) != self.database:
            raise RuntimeError("UNEXPECTED_SQLITE_CONNECTION")
        self.assert_unchanged()
        # WAL-format DBs without sidecars cannot use mode=ro under deny file-write*.
        # immutable is permitted only while the context-bound DB remains unchanged.
        connection = self.original_connect(self.database.as_uri() + "?mode=ro&immutable=1", uri=True)
        connection.execute("PRAGMA query_only=ON")
        self.connections += 1
        return connection


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--context", type=Path, required=True)
    parser.add_argument("--context-sha256", required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[5]
    kb = root.parent / "个人知识库"
    script = kb / "04_Claude Code日常操作/scripts/opc_rag.py"
    config_path = script.with_name("opc_rag_config.json")
    context_path = args.context
    if context_path.resolve() != context_path or context_path.parent.parent != kb / ".opc-rag/tasks" or context_path.name != "context.json":
        raise RuntimeError("CONTEXT_PATH_ESCAPE")
    if file_sha256(context_path) != args.context_sha256:
        raise RuntimeError("CONTEXT_SHA_MISMATCH")
    context = json.loads(context_path.read_text())
    config = json.loads(config_path.read_text())
    database = kb / ".opc-rag/opc_rag.sqlite3"
    if Path(config["vault_root"]) != kb or config["database"] != ".opc-rag/opc_rag.sqlite3":
        raise RuntimeError("INDEX_CONFIG_SCOPE_CHANGED")
    guard = ReadonlyIndex(database, context["index_freshness"]["generation"]["database_sha256"])
    validator = runpy.run_path(str(script), run_name="candidate_readonly_validator")
    captured = io.StringIO()
    sqlite3.connect = guard.connect
    try:
        with contextlib.redirect_stdout(captured):
            code = validator["main"](["--config", str(config_path), "validate-context", "--context", str(context_path)])
    finally:
        sqlite3.connect = guard.original_connect
    guard.assert_unchanged()
    if guard.connections != 1 or file_sha256(context_path) != args.context_sha256:
        raise RuntimeError("VALIDATION_INPUT_CHANGED")
    # Release the original CLI output only after the live index stability check.
    sys.stdout.write(captured.getvalue())
    return code


if __name__ == "__main__":
    raise SystemExit(main())
