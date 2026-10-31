"""Difusión en vivo por WebSocket hacia los tableros conectados."""

from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket

from .schemas import WsMessage

log = logging.getLogger("xrlab.live")


class LiveHub:
    def __init__(self) -> None:
        self._clientes: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    @property
    def clients(self) -> int:
        return len(self._clientes)

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clientes.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clientes.discard(ws)

    async def send(self, ws: WebSocket, msg: WsMessage) -> None:
        await ws.send_text(msg.model_dump_json())

    async def broadcast(self, msg: WsMessage) -> int:
        """Manda el mensaje a todos; los que fallan (conexión cerrada) se quitan. Devuelve a cuántos llegó."""
        texto = msg.model_dump_json()
        async with self._lock:
            clientes = list(self._clientes)
        caidos: list[WebSocket] = []
        enviados = 0
        for ws in clientes:
            try:
                await ws.send_text(texto)
                enviados += 1
            except Exception as e:  # noqa: BLE001 — cualquier fallo de envío significa cliente caído
                log.info("tablero desconectado: %s", e)
                caidos.append(ws)
        if caidos:
            async with self._lock:
                for ws in caidos:
                    self._clientes.discard(ws)
        return enviados
