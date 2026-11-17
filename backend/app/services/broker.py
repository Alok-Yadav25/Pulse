"""One bounded queue per SSE client, at most 50 clients per process."""

import asyncio
import json
from collections import defaultdict


class Broker:
    def __init__(self) -> None:
        self.clients: dict[str, set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, topic: str) -> asyncio.Queue:
        """Register one bounded queue or reject excess connections."""
        if sum(map(len, self.clients.values())) >= 50:
            raise OverflowError("Live connection limit reached")
        queue: asyncio.Queue = asyncio.Queue(maxsize=64)
        self.clients[topic].add(queue)
        return queue

    def unsubscribe(self, topic: str, queue: asyncio.Queue) -> None:
        """Release all references to a disconnected client."""
        self.clients[topic].discard(queue)
        if not self.clients[topic]:
            self.clients.pop(topic, None)

    def publish(self, topic: str, event: str, data: dict) -> None:
        """Disconnect slow clients instead of growing memory indefinitely."""
        message = f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
        for queue in list(self.clients.get(topic, set())):
            if queue.full():
                self.unsubscribe(topic, queue)
                while not queue.empty():
                    queue.get_nowait()
                queue.put_nowait(None)
            else:
                queue.put_nowait(message)

    def site_event(self, site_id: str, owner_id: str, event: str, data: dict) -> None:
        """Publish an event only to the relevant site and account topics."""
        self.publish(f"site:{site_id}", event, {"site_id": site_id, **data})
        self.publish(f"user:{owner_id}", event, {"site_id": site_id, **data})


broker = Broker()
