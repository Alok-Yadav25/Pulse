"""Resolve every address, reject unsafe destinations, then pin the connection IP."""

import asyncio
import ipaddress
import re
import socket
from dataclasses import dataclass
from urllib.parse import quote, urlsplit, urlunsplit

from app.config import get_settings

PORTS = {80, 443, 8080, 8443}


class UnsafeURL(ValueError):
    """A URL cannot cross the public-network boundary."""


@dataclass(frozen=True)
class Target:
    url: str
    host: str
    port: int
    tls: bool
    path: str
    ip: str
    addresses: tuple[str, ...] = ()


def public_ip(value: str) -> bool:
    """Allow global unicast addresses only, including mapped IPv4 validation."""
    try:
        address = ipaddress.ip_address(value.split("%", 1)[0])
        if isinstance(address, ipaddress.IPv6Address):
            if address in ipaddress.ip_network("64:ff9b::/96") or address in ipaddress.ip_network(
                "64:ff9b:1::/48"
            ):
                return False
            if address.ipv4_mapped:
                return public_ip(str(address.ipv4_mapped))
            if address.sixtofour or address.teredo:
                return False
        return address.is_global and not (
            address.is_multicast or address.is_reserved or address.is_unspecified
        )
    except ValueError:
        return False


def normalize_url(raw: str) -> str:
    """Preserve path and query while rejecting ambiguous URL syntax."""
    if len(raw) > 2048 or re.search(r"[\x00-\x20\x7f\\]", raw):
        raise UnsafeURL("URL contains whitespace, control characters, or backslashes")
    try:
        parsed = urlsplit(raw)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise UnsafeURL("Only complete HTTP and HTTPS URLs are allowed")
        if parsed.username is not None or parsed.password is not None or "%" in parsed.netloc:
            raise UnsafeURL("Credentials and escaped hostnames are not allowed")
        host = parsed.hostname.rstrip(".").encode("idna").decode("ascii").lower()
        if re.fullmatch(r"(?:0x[0-9a-f]+|[0-9]+)(?:\.(?:0x[0-9a-f]+|[0-9]+))*", host):
            try:
                if str(ipaddress.ip_address(host)) != host:
                    raise ValueError("Ambiguous numeric hostname")
            except ValueError as error:
                raise UnsafeURL("Noncanonical numeric IP addresses are not allowed") from error
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if port not in PORTS or len(host) > 253:
            raise UnsafeURL("Unsupported port or hostname")
        own = {
            urlsplit(v).hostname
            for v in [get_settings().public_api_url, *get_settings().cors_origins]
        }
        if (
            host in own
            or host in {"localhost", "metadata.google.internal"}
            or host.endswith(".localhost")
        ):
            raise UnsafeURL("Pulse and local/metadata destinations cannot be monitored")
        authority = f"[{host}]" if ":" in host else host
        if parsed.port:
            authority += f":{port}"
        return urlunsplit(
            (
                parsed.scheme,
                authority,
                quote(parsed.path or "/", safe="/%:@!$&'()*+,;=-._~"),
                parsed.query,
                "",
            )
        )
    except (ValueError, UnicodeError) as error:
        raise UnsafeURL(str(error)) from error


async def resolve_target(raw: str) -> Target:
    """Reject the whole resolution if any A/AAAA answer is unsafe."""
    url = normalize_url(raw)
    parsed = urlsplit(url)
    host = parsed.hostname or ""
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    records = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    addresses = list(dict.fromkeys(record[4][0] for record in records))
    if not addresses or not all(public_ip(address) for address in addresses):
        raise UnsafeURL("Destination must resolve exclusively to public unicast IP addresses")
    path = parsed.path + (f"?{parsed.query}" if parsed.query else "")
    return Target(url, host, port, parsed.scheme == "https", path, addresses[0], tuple(addresses))
