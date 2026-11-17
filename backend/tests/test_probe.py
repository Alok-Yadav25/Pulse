"""Exercise the real timed transport against explicitly injected local test servers."""

import asyncio
import ssl
import subprocess

from app.services.probe import request
from app.services.ssrf import Target, UnsafeURL


async def test_close_delimited_response_and_phase_timing(monkeypatch):
    captured = []

    async def handler(reader, writer):
        captured.append(await reader.readuntil(b"\r\n\r\n"))
        await asyncio.sleep(0.01)
        writer.write(b"HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nready")
        await writer.drain()
        writer.close()

    server = await asyncio.start_server(handler, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]

    async def resolve(url):
        return Target(url, "site.test", port, False, "/health?region=in", "127.0.0.1")

    monkeypatch.setattr("app.services.probe.resolve_target", resolve)
    try:
        result = await request("http://site.test/health?region=in")
        assert result.ok and result.body == b"ready"
        assert result.tcp_ms > 0 and result.ttfb_ms >= 8
        assert b"Host: site.test:" in captured[0]
        assert b"GET /health?region=in" in captured[0]
    finally:
        server.close()
        await server.wait_closed()


async def test_redirect_revalidates_before_connecting(monkeypatch):
    calls = []

    async def handler(reader, writer):
        await reader.readuntil(b"\r\n\r\n")
        writer.write(
            b"HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1/private\r\nContent-Length: 0\r\n\r\n"
        )
        await writer.drain()
        writer.close()

    server = await asyncio.start_server(handler, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]

    async def resolve(url):
        calls.append(url)
        if len(calls) > 1:
            raise UnsafeURL("Private redirect")
        return Target(url, "site.test", port, False, "/", "127.0.0.1")

    monkeypatch.setattr("app.services.probe.resolve_target", resolve)
    try:
        result = await request("http://site.test/")
        assert not result.ok and result.error_type == "unsafe_url"
        assert calls == ["http://site.test/", "http://127.0.0.1/private"]
    finally:
        server.close()
        await server.wait_closed()


async def test_tls_uses_original_sni_and_measures_certificate(monkeypatch, tmp_path):
    config = tmp_path / "openssl.cnf"
    config.write_text(
        "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=site.test\n[ext]\nsubjectAltName=DNS:site.test\nbasicConstraints=CA:TRUE\n"
    )
    key, cert = tmp_path / "key.pem", tmp_path / "cert.pem"
    await asyncio.to_thread(
        subprocess.run,
        [
            "/usr/bin/openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-keyout",
            str(key),
            "-out",
            str(cert),
            "-days",
            "2",
            "-config",
            str(config),
        ],
        check=True,
        capture_output=True,
    )
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    tls.load_cert_chain(cert, key)
    names = []
    tls.set_servername_callback(lambda socket, name, context: names.append(name))
    trusted = ssl.create_default_context(cafile=str(cert))

    async def handler(reader, writer):
        await reader.readuntil(b"\r\n\r\n")
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
        await writer.drain()
        writer.close()

    server = await asyncio.start_server(handler, "127.0.0.1", 0, ssl=tls)
    port = server.sockets[0].getsockname()[1]

    async def resolve(url):
        return Target(url, "site.test", port, True, "/", "127.0.0.1")

    monkeypatch.setattr("app.services.probe.resolve_target", resolve)
    monkeypatch.setattr("app.services.probe.ssl.create_default_context", lambda: trusted)
    try:
        result = await request("https://site.test/")
        assert result.ok, result.error_type
        assert result.tls_ms > 0 and result.tls_days_left in {1, 2}
        assert names == ["site.test"]
    finally:
        server.close()
        await server.wait_closed()
