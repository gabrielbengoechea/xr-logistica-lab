"""Persistencia de sesiones de telemetría en SQLite (stdlib). Seguro para varios hilos con un lock."""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path

from .metrics import metricas
from .schemas import SessionRecord, SessionReport, TelemetryEvent

ESQUEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    session_id      TEXT PRIMARY KEY,
    student_id      TEXT NOT NULL,
    scenario        TEXT NOT NULL,
    device          TEXT NOT NULL,
    interaction     TEXT NOT NULL,
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    parts_total     INTEGER NOT NULL,
    parts_placed    INTEGER NOT NULL,
    assembly_errors INTEGER NOT NULL,
    hints_used      INTEGER NOT NULL,
    events_json     TEXT NOT NULL,
    received_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sessions_student ON sessions(student_id);
CREATE INDEX IF NOT EXISTS ix_sessions_scenario ON sessions(scenario);
"""


class TelemetryStore:
    def __init__(self, path: Path | str) -> None:
        self._path = str(path)
        if self._path != ":memory:":
            Path(self._path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self._path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(ESQUEMA)
            self._conn.execute("PRAGMA journal_mode=WAL" if self._path != ":memory:" else "PRAGMA journal_mode=MEMORY")

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def upsert(self, report: SessionReport) -> tuple[SessionRecord, bool]:
        """Guarda la sesión; si ya existía con ese `session_id` la reemplaza. Devuelve (registro, creada)."""
        ahora = datetime.now(UTC)
        fila = (
            report.session_id,
            report.student_id,
            report.scenario,
            report.device.value,
            report.interaction.value,
            report.started_at.isoformat(),
            report.ended_at.isoformat() if report.ended_at else None,
            report.parts_total,
            report.parts_placed,
            report.assembly_errors,
            report.hints_used,
            json.dumps([e.model_dump(mode="json") for e in report.events], ensure_ascii=False),
            ahora.isoformat(),
        )
        with self._lock, self._conn:
            existia = self._conn.execute("SELECT 1 FROM sessions WHERE session_id = ?", (report.session_id,)).fetchone() is not None
            self._conn.execute(
                """INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(session_id) DO UPDATE SET
                     student_id=excluded.student_id, scenario=excluded.scenario, device=excluded.device,
                     interaction=excluded.interaction, started_at=excluded.started_at, ended_at=excluded.ended_at,
                     parts_total=excluded.parts_total, parts_placed=excluded.parts_placed,
                     assembly_errors=excluded.assembly_errors, hints_used=excluded.hints_used,
                     events_json=excluded.events_json, received_at=excluded.received_at""",
                fila,
            )
        registro = self.get(report.session_id)
        assert registro is not None
        return registro, not existia

    def get(self, session_id: str) -> SessionRecord | None:
        with self._lock:
            fila = self._conn.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
        return _registro(fila) if fila else None

    def events(self, session_id: str) -> list[TelemetryEvent] | None:
        with self._lock:
            fila = self._conn.execute("SELECT events_json FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
        return [TelemetryEvent.model_validate(e) for e in json.loads(fila["events_json"])] if fila else None

    def list(self, student_id: str | None = None, scenario: str | None = None, limit: int = 200) -> list[SessionRecord]:
        sql = "SELECT * FROM sessions"
        cond: list[str] = []
        args: list[object] = []
        if student_id:
            cond.append("student_id = ?")
            args.append(student_id)
        if scenario:
            cond.append("scenario = ?")
            args.append(scenario)
        if cond:
            sql += " WHERE " + " AND ".join(cond)
        sql += " ORDER BY received_at DESC LIMIT ?"
        args.append(limit)
        with self._lock:
            filas = self._conn.execute(sql, args).fetchall()
        return [_registro(f) for f in filas]

    def count(self) -> int:
        with self._lock:
            return int(self._conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0])

    def clear(self) -> int:
        with self._lock, self._conn:
            return self._conn.execute("DELETE FROM sessions").rowcount


def _registro(f: sqlite3.Row) -> SessionRecord:
    eventos = [TelemetryEvent.model_validate(e) for e in json.loads(f["events_json"])]
    base = SessionReport(
        session_id=f["session_id"],
        student_id=f["student_id"],
        scenario=f["scenario"],
        device=f["device"],
        interaction=f["interaction"],
        started_at=datetime.fromisoformat(f["started_at"]),
        ended_at=datetime.fromisoformat(f["ended_at"]) if f["ended_at"] else None,
        parts_total=f["parts_total"],
        parts_placed=f["parts_placed"],
        assembly_errors=f["assembly_errors"],
        hints_used=f["hints_used"],
        events=eventos,
    )
    return SessionRecord(
        **base.model_dump(exclude={"events"}),
        finished=base.ended_at is not None,
        metrics=metricas(base, eventos),
        received_at=datetime.fromisoformat(f["received_at"]),
    )
