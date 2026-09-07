import json
import os
from pathlib import Path
import runpy
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest

CONTROL = Path(__file__).resolve().parents[1]
ADAPTER = CONTROL / "runtime/knowledge-readonly.py"
module = runpy.run_path(str(ADAPTER))
ReadonlyIndex = module["ReadonlyIndex"]
file_sha256 = module["file_sha256"]


class ReadonlyTests(unittest.TestCase):
    def setUp(self):
        base = CONTROL / "runtime/tests"
        base.mkdir(parents=True, exist_ok=True)
        self.root = Path(tempfile.mkdtemp(prefix="knowledge-ro-", dir=base))
        self.db = self.root / "index.sqlite3"
        with sqlite3.connect(self.db) as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("CREATE TABLE meta(key TEXT, value TEXT)")
            connection.execute("INSERT INTO meta VALUES('generation', 'current-fixture')")
        connection.close()
        self.sha256 = file_sha256(self.db)
        self.assertFalse(Path(str(self.db) + "-wal").exists())

    def tearDown(self):
        shutil.rmtree(self.root)

    def test_current_wal_database_is_readable_and_not_writable(self):
        guard = ReadonlyIndex(self.db, self.sha256)
        connection = guard.connect(self.db)
        self.assertEqual(connection.execute("SELECT value FROM meta").fetchone()[0], "current-fixture")
        with self.assertRaises(sqlite3.OperationalError):
            connection.execute("UPDATE meta SET value='forged'")
        connection.close()
        guard.assert_unchanged()

    def test_reject_sidecars_including_empty_and_dangling(self):
        for suffix in ("-wal", "-shm", "-journal"):
            sidecar = Path(str(self.db) + suffix)
            sidecar.touch()
            with self.assertRaisesRegex(RuntimeError, "INDEX_JOURNAL_PRESENT"):
                ReadonlyIndex(self.db, self.sha256)
            sidecar.unlink()
        sidecar.symlink_to("missing")
        with self.assertRaisesRegex(RuntimeError, "INDEX_JOURNAL_PRESENT"):
            ReadonlyIndex(self.db, self.sha256)

    def test_reject_other_database_or_connection_options(self):
        guard = ReadonlyIndex(self.db, self.sha256)
        with self.assertRaisesRegex(RuntimeError, "UNEXPECTED_SQLITE_CONNECTION"):
            guard.connect(":memory:")
        with self.assertRaisesRegex(RuntimeError, "UNEXPECTED_SQLITE_CONNECTION"):
            guard.connect(self.db, uri=True)

    def test_reject_wrong_context_bound_hash(self):
        with self.assertRaisesRegex(RuntimeError, "INDEX_SHA_MISMATCH"):
            ReadonlyIndex(self.db, "0" * 64)

    def test_reject_content_drift(self):
        guard = ReadonlyIndex(self.db, self.sha256)
        with self.db.open("ab") as handle:
            handle.write(b"changed")
        with self.assertRaisesRegex(RuntimeError, "INDEX_SHA_MISMATCH"):
            guard.assert_unchanged()

    def test_reject_replacement_even_if_bytes_match(self):
        guard = ReadonlyIndex(self.db, self.sha256)
        replacement = self.db.with_name("replacement")
        shutil.copyfile(self.db, replacement)
        replacement.replace(self.db)
        with self.assertRaisesRegex(RuntimeError, "INDEX_CHANGED_DURING_VALIDATION"):
            guard.assert_unchanged()

    @unittest.skipUnless(sys.platform == "darwin", "macOS sandbox required")
    def test_immutable_reads_under_unchanged_full_write_deny_sandbox(self):
        code = (
            "import runpy,sys,json;from pathlib import Path;"
            "m=runpy.run_path(sys.argv[1]);g=m['ReadonlyIndex'](Path(sys.argv[2]),sys.argv[3]);"
            "c=g.connect(Path(sys.argv[2]));r=c.execute('SELECT value FROM meta').fetchone();"
            "c.close();g.assert_unchanged();print(json.dumps(r))"
        )
        result = subprocess.run(
            ["/usr/bin/sandbox-exec", "-p", "(version 1)(allow default)(deny network*)(deny file-write*)",
             sys.executable, "-I", "-B", "-c", code, str(ADAPTER), str(self.db), self.sha256],
            env={"PATH": "/usr/bin:/bin", "HOME": str(self.root), "LANG": "zh_CN.UTF-8"},
            text=True, capture_output=True, timeout=10,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), ["current-fixture"])
        self.assertEqual(file_sha256(self.db), self.sha256)


if __name__ == "__main__":
    unittest.main()
