"""Bounded HTTP/1.1 transport with separate DNS, TCP, TLS, and TTFB timings."""

import asyncio
import json
import socket
import ssl
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from urllib.parse import urljoin

import h11

from app.config import get_settings
from app.services.ssrf import UnsafeURL, resolve_target

MAX_BODY = 1024 * 1024
semaphore = asyncio.Semaphore(10)


@dataclass
class ProbeResult:
    ok: bool = False
    status_code: int | None = None
    dns_ms: float = 0
    tcp_ms: float = 0
    tls_ms: float = 0
    ttfb_ms: float = 0
    total_ms: float = 0
    bytes: int = 0
    redirects: int = 0
    error_type: str | None = None
    tls_days_left: int | None = None
    body: bytes = b""
    headers: dict[str, str] = field(default_factory=dict)

    def record(self) -> dict:
        """Exclude response content from durable check records."""
        return {k: v for k, v in asdict(self).items() if k not in {"body", "headers"}}


def assert_response(status: int, body: bytes, assertions: dict) -> str | None:
    """Evaluate bounded status/text/dotted-JSON assertions without executing code."""
    expected = assertions.get("status_codes", [])
    if expected and status not in expected:
        return "assertion_status"
    if assertions.get("contains") and assertions["contains"] not in body.decode("utf-8", "replace"):
        return "assertion_text"
    if assertions.get("json_path"):
        try:
            value = json.loads(body)
            for part in assertions["json_path"].split("."):
                value = value[int(part)] if isinstance(value, list) else value[part]
            if value != assertions.get("equals"):
                return "assertion_json"
        except (ValueError, KeyError, TypeError, IndexError):
            return "assertion_json"
    return None


async def request(url: str, method: str = "GET", payload: bytes | None = None) -> ProbeResult:
    """Perform a pinned-IP request, validating each of at most three redirects."""
    result = ProbeResult()
    started = time.perf_counter()
    try:
        async with semaphore, asyncio.timeout(10):
            for hop in range(4):
                stamp = time.perf_counter()
                target = await resolve_target(url)
                result.dns_ms += (time.perf_counter() - stamp) * 1000
                writer = None
                try:
                    stamp = time.perf_counter()
                    last_error: Exception = ConnectionError("No reachable public address")
                    for address in target.addresses or (target.ip,):
                        try:
                            reader, writer = await asyncio.wait_for(
                                asyncio.open_connection(address, target.port, limit=32768),
                                timeout=3,
                            )
                            break
                        except (OSError, TimeoutError) as error:
                            last_error = error
                    else:
                        raise last_error
                    result.tcp_ms += (time.perf_counter() - stamp) * 1000
                    if target.tls:
                        stamp = time.perf_counter()
                        await writer.start_tls(
                            ssl.create_default_context(), server_hostname=target.host
                        )
                        result.tls_ms += (time.perf_counter() - stamp) * 1000
                        certificate = writer.get_extra_info("ssl_object").getpeercert()
                        expires = datetime.fromtimestamp(
                            ssl.cert_time_to_seconds(certificate["notAfter"]), UTC
                        )
                        result.tls_days_left = (expires - datetime.now(UTC)).days
                    connection = h11.Connection(h11.CLIENT, max_incomplete_event_size=32768)
                    host = f"[{target.host}]" if ":" in target.host else target.host
                    if target.port != (443 if target.tls else 80):
                        host += f":{target.port}"
                    headers = [
                        (b"Host", host.encode()),
                        (
                            b"User-Agent",
                            f"PulseBot/1.0 (+{get_settings().public_api_url}/info)".encode(),
                        ),
                        (b"Connection", b"close"),
                        (b"Accept-Encoding", b"identity"),
                    ]
                    if payload is not None:
                        headers += [
                            (b"Content-Type", b"application/json"),
                            (b"Content-Length", str(len(payload)).encode()),
                        ]
                    writer.write(
                        connection.send(
                            h11.Request(
                                method=method, target=target.path.encode("ascii"), headers=headers
                            )
                        )
                    )
                    if payload:
                        writer.write(connection.send(h11.Data(data=payload)))
                    writer.write(connection.send(h11.EndOfMessage()))
                    await writer.drain()
                    stamp = time.perf_counter()
                    body = bytearray()
                    first = True
                    while True:
                        event = connection.next_event()
                        if event is h11.NEED_DATA:
                            chunk = await reader.read(16384)
                            if first:
                                result.ttfb_ms += (time.perf_counter() - stamp) * 1000
                                first = False
                            connection.receive_data(chunk)
                        elif isinstance(event, h11.Response):
                            result.status_code = event.status_code
                            result.headers = {
                                k.decode().lower(): v.decode("latin-1") for k, v in event.headers
                            }
                        elif isinstance(event, h11.Data):
                            body.extend(event.data[: MAX_BODY - len(body)])
                            if len(body) >= MAX_BODY:
                                break
                        elif isinstance(event, h11.EndOfMessage | h11.ConnectionClosed):
                            break
                    result.body = bytes(body)
                    result.bytes += len(body)
                    if result.status_code in {301, 302, 303, 307, 308} and result.headers.get(
                        "location"
                    ):
                        # Webhooks cannot redirect a secret payload to another host.
                        if method != "GET" or hop == 3:
                            result.error_type = "redirect_limit"
                            break
                        url = urljoin(target.url, result.headers["location"])
                        result.redirects += 1
                        continue
                    result.ok = bool(result.status_code and 200 <= result.status_code < 400)
                    if not result.ok:
                        result.error_type = (
                            "http_5xx" if (result.status_code or 0) >= 500 else "http_4xx"
                        )
                    break
                finally:
                    if writer:
                        writer.close()
                        try:
                            await writer.wait_closed()
                        except (OSError, ssl.SSLError):
                            pass
    except UnsafeURL:
        result.error_type = "unsafe_url"
    except socket.gaierror:
        result.error_type = "dns_failure"
    except TimeoutError:
        result.error_type = "timeout"
    except ssl.SSLError:
        result.error_type = "tls_error"
    except ConnectionRefusedError:
        result.error_type = "connection_refused"
    except (OSError, ConnectionError, h11.RemoteProtocolError, UnicodeError):
        result.error_type = "connection_error"
    result.total_ms = round((time.perf_counter() - started) * 1000, 2)
    return result


async def probe(url: str, assertions: dict) -> ProbeResult:
    """Apply response assertions and an optional latency threshold after transport."""
    result = await request(url)
    if result.status_code is not None and result.error_type in {None, "http_4xx", "http_5xx"}:
        failure = assert_response(result.status_code, result.body, assertions)
        if failure:
            result.ok, result.error_type = False, failure
        elif assertions.get("status_codes"):
            result.ok, result.error_type = True, None
    if result.ok and result.total_ms > assertions.get("max_ms", 10000):
        result.ok, result.error_type = False, "slow"
    return result
