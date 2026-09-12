#!/usr/bin/env python3
"""Collect small, public source snapshots for the static operations dashboard."""
import argparse, concurrent.futures, datetime as dt, hashlib, json, os, re, sys, gzip
import html as html_lib
from html.parser import HTMLParser
import urllib.parse, urllib.request, urllib.robotparser, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_SOURCES = os.path.join(ROOT, "monitor", "sources.json")
DEFAULT_OUTPUT = os.path.join(ROOT, "dist", "watch.json")
TIMEOUT = 12
MAX_BYTES = 2_000_000
UA = "JikePublicWatch/1.0 (+https://github.com/0xBigotry7/jike-data)"
EXTRACTOR_VERSION = "3.0"

def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def allowed_by_robots(url, timeout=5):
    p = urllib.parse.urlsplit(url)
    robots_url = urllib.parse.urlunsplit((p.scheme, p.netloc, "/robots.txt", "", ""))
    rp = urllib.robotparser.RobotFileParser()
    try:
        with urllib.request.urlopen(urllib.request.Request(robots_url, headers={"User-Agent": UA}), timeout=timeout) as r:
            if r.status in (401, 403): return False, "robots_forbidden"
            rp.parse(r.read(256_000).decode("utf-8", "replace").splitlines())
        return rp.can_fetch(UA, url), None
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403): return False, "robots_forbidden"
        if exc.code == 404: return True, "robots_missing"
        return False, "robots_unavailable"
    except Exception:
        # A missing/unreachable robots file is not an authorization to bypass it.
        return False, "robots_unavailable"

def fetch(url):
    ok, robots_note = allowed_by_robots(url)
    if not ok:
        raise RuntimeError("blocked_by_robots")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise RuntimeError("response_too_large")
        charset = response.headers.get_content_charset() or "utf-8"
    if response.headers.get("Content-Encoding", "").lower() == "gzip": data = gzip.decompress(data)
    if len(data) > MAX_BYTES: raise RuntimeError("response_too_large")
    return data.decode(charset, "replace"), robots_note

class BodyParser(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
    SKIP = {"script", "style", "noscript", "svg", "footer", "header", "nav", "menu", "aside", "head"}
    def __init__(self):
        super().__init__(); self.parts=[]; self.stack=[]; self.anchor=None; self.items=[]
    def handle_starttag(self, tag, attrs):
        tag=tag.lower(); attrs=dict(attrs)
        classes=(attrs.get("class", "")+" "+attrs.get("id", "")).lower()
        skip=(self.stack[-1][1] if self.stack else False) or tag in self.SKIP or bool(re.search(r"(?:^|[ _-])(nav|menu|footer|header|sidebar|breadcrumb)(?:$|[ _-])", classes))
        if tag not in self.VOID: self.stack.append((tag,skip))
        if tag=="a" and not skip: self.anchor={"text":[],"url":attrs.get("href")}
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag,attrs)
        if tag not in self.VOID: self.handle_endtag(tag)
    def handle_endtag(self, tag):
        if tag=="a" and self.anchor:
            text=re.sub(r"\s+", " ", " ".join(self.anchor["text"])).strip()
            if text and self.anchor.get("url"): self.items.append({"title":text[:200],"url":self.anchor["url"]})
            self.anchor=None
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0]==tag:
                del self.stack[i:]; break
    def handle_data(self,data):
        if not self.stack or not self.stack[-1][1]:
            self.parts.append(data)
            if self.anchor is not None: self.anchor["text"].append(data)

def clean_text(raw):
    p = BodyParser()
    try: p.feed(raw); value = " ".join(p.parts)
    except Exception: value = re.sub(r"(?s)<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", html_lib.unescape(value)).strip()

def extract_date(text):
    m = re.search(r"(?<!\d)(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})日?", text)
    if m:
        try:
            return dt.date(*map(int, m.groups())).isoformat()
        except ValueError:
            return None
    return None

def extract_title(raw, fallback):
    m = re.search(r"(?is)<title[^>]*>(.*?)</title>", raw)
    title = clean_text(m.group(1)) if m else ""
    return (title[:200] or fallback[:200]).strip()

def snapshot_source(source, fetcher=fetch):
    checked = now_iso()
    try:
        raw, robots_note = fetcher(source["url"])
        parser = BodyParser()
        parser.feed(raw)
        text = re.sub(r"\s+", " ", html_lib.unescape(" ".join(parser.parts))).strip()
        title = extract_title(raw, source["name"])
        # Keep a stable, useful excerpt and avoid making numeric claims from it.
        if (len(text) < 20 or not re.search(r"\d|新闻|价格|公告|指数|动态|新品|日报", text[:1000])
                or re.search(r"(?i)(enable javascript|请启用 javascript|access denied|not found|404)", text[:500])):
            raise RuntimeError("empty_or_soft_404")
        items=[]
        seen=set()
        for item in parser.items:
            url=urllib.parse.urljoin(source["url"],item["url"])
            if (len(item["title"])>=12 and urllib.parse.urlsplit(url).scheme in ("http","https")
                    and url not in seen and re.search(source.get("item_pattern", ".*"),url)):
                items.append({"title":item["title"],"url":url}); seen.add(url)
        if source.get("data_role")=="list":
            if not items: raise RuntimeError("no_public_list_items")
            items=items[:20]
            text="\n".join(i["title"]+" "+i["url"] for i in items)
        excerpt = "；".join(i["title"] for i in items[:3])[:200] if items else text[:200]
        normalized = re.sub(r"\s+", " ", text).strip()
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        return {"status":"ok", "last_checked":checked, "last_success":checked,
                "content_hash":digest, "source_date":(extract_date(text) if source.get("date_mode") != "none" else None), "title":title,
                "excerpt":excerpt, "robots_note":robots_note, "extractor_version":EXTRACTOR_VERSION,
                "snapshot_text":text[:20000], "snapshot_truncated":len(text)>20000,
                "items":items}
    except Exception as exc:
        return {"status":"error", "last_checked":checked, "error":str(exc)[:240]}

def collect(sources, old=None, fetcher=fetch):
    old = old or {}
    previous_sources = old.get("sources", [])
    if isinstance(previous_sources, dict):  # tolerate the first development snapshot format
        previous_sources = list(previous_sources.values())
    previous_by_id = {x.get("id"): x for x in previous_sources}
    checked_at = now_iso()
    results = {}
    def one(s): return s, snapshot_source(s, fetcher)
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, max(1, len(sources)))) as pool:
        pairs = list(pool.map(one, sources))
    changes = list(old.get("changes", []))
    for source, fresh in pairs:
        sid = source["id"]
        previous = previous_by_id.get(sid, {})
        record = {"id":sid, "url":source["url"], "name":source["name"], "category":source["category"], "data_role":source.get("data_role", "site_snapshot")}
        if fresh["status"] == "error":
            record.update({k: previous[k] for k in ("last_success","content_hash","source_date","title","excerpt","snapshot_text","snapshot_truncated","extractor_version","items") if k in previous})
            record.update(fresh)
            change_type = "error"
        else:
            record.update(fresh)
            if (not previous.get("content_hash") or previous.get("url") != source["url"] or previous.get("extractor_version") != EXTRACTOR_VERSION):
                change_type = "initial"
            elif previous.get("content_hash") == fresh["content_hash"]:
                change_type = "unchanged"
            else:
                change_type = "content_changed"
        record["change_type"] = change_type
        results[sid] = record
        if change_type == "content_changed":
            changes.append({"id":sid,"name":record["name"],"url":record["url"],"checked_at":record["last_checked"],"source_date":record.get("source_date"),"title":record.get("title"),"excerpt":record.get("excerpt"),"before_hash":previous.get("content_hash"),"after_hash":record.get("content_hash"),"before_excerpt":previous.get("excerpt"),"after_excerpt":record.get("excerpt"),"before_snapshot_text":previous.get("snapshot_text",""),"after_snapshot_text":record.get("snapshot_text","")})
    history = list(old.get("history", []))
    history.append({"checked_at":checked_at,"sources":[{"id":r["id"],"status":r["status"],"change_type":r["change_type"]} for r in results.values()]})
    failures = [{"id":r["id"],"name":r["name"],"url":r["url"],"checked_at":r["last_checked"],"error":r.get("error")} for r in results.values() if r["status"] == "error"]
    counts = {k: sum(1 for r in results.values() if r.get("change_type") == k) for k in ("initial","unchanged","content_changed","error")}
    history[-1].update({"success_count":len(results)-counts["error"],"failure_count":counts["error"],"unchanged_count":counts["unchanged"],"changed_count":counts["content_changed"],"initial_count":counts["initial"]})
    return {"schema_version":2,"generated_at":checked_at,"sources":list(results.values()),"failures":failures,"changes":changes[-100:],"history":history[-30:]}

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", default=DEFAULT_SOURCES)
    ap.add_argument("--output", default=DEFAULT_OUTPUT)
    args = ap.parse_args(argv)
    with open(args.sources, encoding="utf-8") as f: sources = json.load(f)
    old = {}
    if os.path.exists(args.output):
        try:
            with open(args.output, encoding="utf-8") as f: old = json.load(f)
        except (OSError, ValueError): pass
    result = collect(sources, old)
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f: json.dump(result, f, ensure_ascii=False, indent=2)
    print(json.dumps({"output":args.output,"generated_at":result["generated_at"],"sources":{v["id"]:v["status"] for v in result["sources"]}}, ensure_ascii=False))
    return 0

if __name__ == "__main__": sys.exit(main())
