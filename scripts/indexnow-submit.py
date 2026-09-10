#!/usr/bin/env python3
"""Submit URLs to IndexNow for vigent.ir.
Usage: python3 scripts/indexnow-submit.py <url1> [<url2> ...]

The key file lives at https://vigent.ir/<KEY>.txt (served statically from /public).
"""
import sys
import json
import urllib.request
import urllib.error

INDEXNOW_KEY = "d1b86b39399df7538051e1acaa4859a4"
KEY_LOCATION = f"https://vigent.ir/{INDEXNOW_KEY}.txt"

def submit(urls):
    """Submit URLs to IndexNow (bulk submission, single API call)."""
    clean_urls = []
    for url in urls:
        if not url.startswith("https://vigent.ir"):
            if url.startswith("/"):
                url = f"https://vigent.ir{url}"
            elif not url.startswith("http"):
                url = f"https://vigent.ir/{url.lstrip(chr(47))}"
        clean_urls.append(url)

    payload = {
        "host": "vigent.ir",
        "key": INDEXNOW_KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": clean_urls,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.indexnow.org/IndexNow",
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"OK Submitted {len(clean_urls)} URLs. Status: {resp.status}")
            print(f"  Key file: {KEY_LOCATION}")
            for u in clean_urls:
                print(f"  -> {u}")
            print(f"Bing/Yandex/Naver will crawl within 24-72 hours.")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:300]
        print(f"FAIL HTTP {e.code}: {body}")
    except Exception as e:
        print(f"FAIL Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/indexnow-submit.py <url1> [<url2> ...]")
        print("Examples:")
        print("  python3 scripts/indexnow-submit.py https://vigent.ir/blog/new-article")
        print("  python3 scripts/indexnow-submit.py /blog/new-article")
        sys.exit(1)
    submit(sys.argv[1:])
