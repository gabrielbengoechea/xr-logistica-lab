"""Cálculo de métricas de una sesión y resúmenes para el tablero (funciones puras, sin I/O)."""

from __future__ import annotations

from collections import defaultdict
from statistics import fmean

from .schemas import (
    EventType,
    ScenarioSummary,
    SessionMetrics,
    SessionRecord,
    SessionReport,
    StudentSummary,
    TelemetryEvent,
    TelemetrySummary,
)

PESO_COMPLETITUD = 70
PESO_PRECISION = 30
PENALIDAD_PISTA = 3


def puntaje(parts_total: int, parts_placed: int, errors: int, hints: int) -> int:
    """
    Puntaje 0–100:
    70 × fracción de piezas colocadas + 30 × precisión (colocadas / (colocadas + errores)) − 3 por pista usada.
    Sin piezas a colocar (parts_total = 0) la completitud cuenta como 0.
    """
    completitud = parts_placed / parts_total if parts_total else 0.0
    intentos = parts_placed + errors
    precision = parts_placed / intentos if intentos else 0.0
    bruto = PESO_COMPLETITUD * completitud + PESO_PRECISION * precision - PENALIDAD_PISTA * hints
    return max(0, min(100, round(bruto)))


def metricas(report: SessionReport | SessionRecord, events: list[TelemetryEvent]) -> SessionMetrics:
    cuenta: dict[EventType, int] = defaultdict(int)
    for e in events:
        cuenta[e.type] += 1
    duracion = (report.ended_at - report.started_at).total_seconds() if report.ended_at else (events[-1].t if events else None)
    if report.parts_placed:
        tasa_error = report.assembly_errors / report.parts_placed
    else:
        tasa_error = 1.0 if report.assembly_errors else 0.0
    return SessionMetrics(
        duration_s=round(duracion, 3) if duracion is not None else None,
        completion=round(report.parts_placed / report.parts_total, 4) if report.parts_total else 0.0,
        error_rate=round(tasa_error, 4),
        grabs=cuenta[EventType.grab],
        snaps_ok=cuenta[EventType.snap_ok],
        snaps_failed=cuenta[EventType.snap_fail],
        explode_toggles=cuenta[EventType.explode] + cuenta[EventType.assemble],
        score=puntaje(report.parts_total, report.parts_placed, report.assembly_errors, report.hints_used),
    )


def resumen(sesiones: list[SessionRecord]) -> TelemetrySummary:
    por_escenario: dict[str, list[SessionRecord]] = defaultdict(list)
    por_alumno: dict[str, list[SessionRecord]] = defaultdict(list)
    for s in sesiones:
        por_escenario[s.scenario].append(s)
        por_alumno[s.student_id].append(s)

    escenarios = []
    for nombre, lista in sorted(por_escenario.items()):
        duraciones = [s.metrics.duration_s for s in lista if s.finished and s.metrics.duration_s is not None]
        escenarios.append(
            ScenarioSummary(
                scenario=nombre,
                sessions=len(lista),
                finished=sum(1 for s in lista if s.finished),
                avg_duration_s=round(fmean(duraciones), 2) if duraciones else None,
                avg_errors=round(fmean(s.assembly_errors for s in lista), 2),
                avg_score=round(fmean(s.metrics.score for s in lista), 2),
                best_score=max(s.metrics.score for s in lista),
            )
        )
    alumnos = [
        StudentSummary(
            student_id=a,
            sessions=len(lista),
            avg_score=round(fmean(s.metrics.score for s in lista), 2),
            total_errors=sum(s.assembly_errors for s in lista),
            last_seen=max(s.received_at for s in lista),
        )
        for a, lista in por_alumno.items()
    ]
    alumnos.sort(key=lambda a: (-a.avg_score, a.student_id))
    return TelemetrySummary(
        sessions=len(sesiones),
        students=len(por_alumno),
        avg_score=round(fmean(s.metrics.score for s in sesiones), 2) if sesiones else 0.0,
        total_errors=sum(s.assembly_errors for s in sesiones),
        by_scenario=escenarios,
        by_student=alumnos,
    )
