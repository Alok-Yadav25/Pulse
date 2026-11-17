"""A rule-based homepage profile using the same SSRF-safe transport as probes."""

import asyncio
from urllib.parse import urljoin, urlsplit, urlunsplit

from selectolax.parser import HTMLParser

from app.services.probe import request


async def profile(url: str) -> dict:
    """Extract bounded metadata, stack signatures, and security-header presence."""
    parsed = urlsplit(url)
    url = urlunsplit((parsed.scheme, parsed.netloc, "/", "", ""))
    result = await request(url)
    if not result.ok:
        raise ValueError(result.error_type or "Homepage could not be fetched")
    document = HTMLParser(result.body)

    def text(selector: str) -> str:
        node = document.css_first(selector)
        return node.text(strip=True)[:500] if node else ""

    def attribute(selector: str, key: str) -> str:
        node = document.css_first(selector)
        return node.attributes.get(key, "")[:1000] if node else ""

    title = text("title") or text("h1")
    description = attribute('meta[name="description"]', "content")
    signatures = (result.body[:500000].decode("utf-8", "replace") + str(result.headers)).lower()
    stack = [
        name
        for name, tokens in {
            "WordPress": ["wp-content", "wordpress"],
            "Shopify": ["cdn.shopify", "shopify"],
            "Next.js": ["_next/", "__next_data__"],
            "React": ["react-dom", "data-reactroot"],
            "Vue": ["vue.js", "data-v-"],
            "Cloudflare": ["cf-ray", "cloudflare"],
            "Vercel": ["x-vercel"],
            "Netlify": ["x-nf-request-id"],
            "Google Analytics": ["googletagmanager", "google-analytics"],
        }.items()
        if any(token in signatures for token in tokens)
    ]
    content = f"{title} {description} {text('h1')} {text('h2')}".lower()
    categories = {
        "e-commerce": ["shop", "cart", "buy", "store"],
        "blog": ["blog", "article", "posts"],
        "SaaS": ["platform", "software", "workspace", "pricing"],
        "portfolio": ["portfolio", "designer", "developer"],
        "news": ["news", "headlines"],
        "docs": ["documentation", "reference", "api"],
        "education": ["learn", "course", "university"],
    }
    scores = {
        name: sum(content.count(word) for word in words) for name, words in categories.items()
    }
    category = max(scores, key=scores.get) if any(scores.values()) else "website"
    security = {
        name: key in result.headers
        for name, key in {
            "HSTS": "strict-transport-security",
            "CSP": "content-security-policy",
            "Frame protection": "x-frame-options",
            "Content type protection": "x-content-type-options",
            "Referrer policy": "referrer-policy",
        }.items()
    }
    robots, sitemap = await asyncio.gather(
        request(urljoin(url, "/robots.txt")), request(urljoin(url, "/sitemap.xml"))
    )
    return {
        "robots_txt": robots.ok,
        "sitemap": sitemap.ok,
        "title": title,
        "description": description,
        "category": category,
        "stack": stack,
        "language": attribute("html", "lang"),
        "h1": text("h1"),
        "h2": text("h2"),
        "og_title": attribute('meta[property="og:title"]', "content"),
        "favicon": urljoin(url, attribute('link[rel~="icon"]', "href") or "/favicon.ico"),
        "security_headers": security,
        "security_score": sum(security.values()) * 20,
        "summary": (
            f"{title or 'This site'} appears to be a {category} site. "
            f"{description[:250] or 'No description was provided by its homepage.'}"
        ),
        "summary_source": "rules",
    }
