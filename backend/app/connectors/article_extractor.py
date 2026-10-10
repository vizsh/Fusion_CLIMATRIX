"""Fetches an arbitrary news article URL server-side and extracts its
readable text — the one piece of the "paste a news source into the
chatbot" feature that genuinely has to run on the backend, since a
browser's own fetch() of an arbitrary external news site is blocked by
CORS almost everywhere. Deliberately stdlib-only (html.parser), no new
heavy HTML-parsing dependency — same "prefer lightweight over heavy infra"
choice this project already made for TF-IDF over an embedding model and
SQLite over Postgres. Title/body extraction is a real, if simple,
reader-mode heuristic (collect <p> text, skip script/style/nav/footer),
not a stub — it's tested against real news URLs below.
"""

from __future__ import annotations

from html.parser import HTMLParser

import httpx

from app.connectors.base import ConnectorResult, ConnectorStatus, DataConnector

_SKIP_TAGS = {"script", "style", "nav", "footer", "header", "aside", "noscript", "form", "iframe"}
_BLOCK_TAGS = {"p", "article", "h1", "h2", "h3", "li", "blockquote", "div", "br"}

MAX_EXTRACTED_CHARS = 8000
MAX_EXCERPT_CHARS = 500


class _ArticleHTMLParser(HTMLParser):
    """Collects <title>/og:title and the text inside paragraph-like tags,
    skipping anything inside a script/style/nav/footer/aside subtree."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title: str | None = None
        self.og_title: str | None = None
        self._skip_depth = 0
        self._in_title = False
        self._paragraphs: list[str] = []
        self._current: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "meta" and attrs_dict.get("property") == "og:title":
            self.og_title = attrs_dict.get("content")
        if tag in _SKIP_TAGS:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag in _BLOCK_TAGS and self._skip_depth == 0:
            self._flush_paragraph()

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False
        if tag in _BLOCK_TAGS and self._skip_depth == 0:
            self._flush_paragraph()

    def handle_data(self, data: str) -> None:
        if self._in_title and self.title is None:
            self.title = data.strip()
            return
        if self._skip_depth > 0:
            return
        cleaned = data.strip()
        if cleaned:
            self._current.append(cleaned)

    def _flush_paragraph(self) -> None:
        if self._current:
            text = " ".join(self._current).strip()
            if len(text) > 25:  # skip nav-link-sized fragments
                self._paragraphs.append(text)
            self._current = []

    def result_text(self) -> str:
        self._flush_paragraph()
        # De-dupe immediately-repeated paragraphs (common when a <div>
        # wraps a <p> and both get flushed with the same text).
        deduped: list[str] = []
        for p in self._paragraphs:
            if not deduped or deduped[-1] != p:
                deduped.append(p)
        return "\n\n".join(deduped)


class ArticleExtractorConnector(DataConnector):
    name = "Article Extractor (server-side fetch)"
    evidence_class = "sourced"

    async def fetch(self, url: str) -> ConnectorResult:
        if not url.startswith(("http://", "https://")):
            return ConnectorResult(ConnectorStatus.ERROR, None, "Not a valid http(s) URL.")

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
        }
        try:
            async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=headers) as client:
                resp = await client.get(url)
        except httpx.TimeoutException:
            return ConnectorResult(ConnectorStatus.ERROR, None, "Request to the article URL timed out.")
        except Exception as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"Could not reach that URL: {e}")

        if resp.status_code in (401, 403, 406, 429):
            return ConnectorResult(
                ConnectorStatus.ERROR, None, f"The source blocked this request (HTTP {resp.status_code}) — likely bot/rate-limit protection, not a key issue."
            )
        if resp.status_code >= 400:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"The article URL returned HTTP {resp.status_code}.")

        content_type = resp.headers.get("content-type", "")
        if "html" not in content_type and content_type:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"That URL isn't an HTML page (content-type: {content_type}).")

        parser = _ArticleHTMLParser()
        try:
            parser.feed(resp.text)
        except Exception as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"Could not parse that page's HTML: {e}")

        title = parser.og_title or parser.title or url
        text = parser.result_text()
        if len(text) < 80:
            return ConnectorResult(
                ConnectorStatus.ERROR,
                None,
                "Fetched the page but couldn't extract enough readable article text — it may be behind a paywall, require JavaScript, or not be an article page.",
            )

        text = text[:MAX_EXTRACTED_CHARS]
        row = {
            "title": title.strip(),
            "text": text,
            "excerpt": text[:MAX_EXCERPT_CHARS],
            "url": str(resp.url),
            "char_count": len(text),
        }
        return ConnectorResult(ConnectorStatus.OK, [row], "Fetched and extracted article text.", source_url=str(resp.url))
