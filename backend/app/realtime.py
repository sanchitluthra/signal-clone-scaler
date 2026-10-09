"""Keeps track of open WebSocket connections and pushes JSON events to users.

A user can have several sockets open at once (two browser tabs, phone + laptop),
so we map user_id -> set of sockets. A user is "online" while that set is non-empty.

Note: this lives in process memory, so it works for a single backend instance.
Running several instances would need a shared pub/sub (e.g. Redis) between them.
"""
from collections import defaultdict
from typing import Iterable

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._sockets: dict[int, set[WebSocket]] = defaultdict(set)

    def connect(self, user_id: int, ws: WebSocket) -> bool:
        """Register a socket. Returns True if the user just came online."""
        was_offline = not self._sockets[user_id]
        self._sockets[user_id].add(ws)
        return was_offline

    def disconnect(self, user_id: int, ws: WebSocket) -> bool:
        """Forget a socket. Returns True if the user just went offline."""
        self._sockets[user_id].discard(ws)
        if not self._sockets[user_id]:
            del self._sockets[user_id]
            return True
        return False

    def is_online(self, user_id: int) -> bool:
        return bool(self._sockets.get(user_id))

    async def send(self, user_id: int, event: dict) -> bool:
        """Send an event to every socket of one user. Returns True if at least one socket received it."""
        delivered = False
        for ws in list(self._sockets.get(user_id, ())):
            try:
                await ws.send_json(event)
                delivered = True
            except Exception:  # socket died mid-send; its own handler will clean it up
                pass
        return delivered

    async def send_many(self, user_ids: Iterable[int], event: dict) -> set[int]:
        """Send to several users. Returns the ids that received it."""
        return {uid for uid in set(user_ids) if await self.send(uid, event)}


manager = ConnectionManager()
