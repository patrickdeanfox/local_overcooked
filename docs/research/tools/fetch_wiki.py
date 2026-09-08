#!/usr/bin/env python3
"""Fetch Overcooked wiki pages and images from the MediaWiki API.

The wiki rejects plain library user-agents (402), so every request sends a browser UA.
Image files are served as WebP even when the title ends in .png, so downloads are
converted with Pillow.

Usage:
    fetch_wiki.py text "1-1 (Overcooked!)"                 # print wikitext
    fetch_wiki.py images "1-1 (Overcooked!)"               # list image file titles
    fetch_wiki.py search soup                              # search page titles
    fetch_wiki.py category "Category:Levels"               # list category members
    fetch_wiki.py download "File:1-1.webp" out/1-1.png     # download + convert to PNG
    fetch_wiki.py page-images "1-1 (Overcooked!)" out/     # download every image on a page
"""

# --- config -----------------------------------------------------------------
import json
import os
import sys
import urllib.parse
import urllib.request

API = "https://overcooked.fandom.com/api.php"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
TIMEOUT = 60
MAX_BYTES = 8 * 1024 * 1024  # skip anything larger; screenshots are well under this


# --- api helpers ------------------------------------------------------------
def api(**params):
    params.setdefault("format", "json")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as fh:
        return json.load(fh)


def wikitext(page):
    d = api(action="parse", page=page, prop="wikitext")
    if "error" in d:
        return None
    return d["parse"]["wikitext"]["*"]


def page_images(page):
    d = api(action="parse", page=page, prop="images")
    if "error" in d:
        return []
    return d["parse"]["images"]


def search(term, limit=25):
    d = api(action="query", list="search", srsearch=term, srlimit=limit)
    return [r["title"] for r in d["query"]["search"]]


def category(title, limit=500):
    out, cont = [], None
    while True:
        kw = {"cmcontinue": cont} if cont else {}
        d = api(action="query", list="categorymembers", cmtitle=title, cmlimit=limit, **kw)
        out += [m["title"] for m in d["query"]["categorymembers"]]
        cont = d.get("continue", {}).get("cmcontinue")
        if not cont:
            return out


def image_url(file_title):
    if not file_title.lower().startswith("file:"):
        file_title = "File:" + file_title
    d = api(action="query", titles=file_title, prop="imageinfo", iiprop="url|size")
    for p in d["query"]["pages"].values():
        info = p.get("imageinfo")
        if info:
            return info[0]["url"], info[0].get("size", 0)
    return None, 0


# --- download ---------------------------------------------------------------
def download(file_title, dest):
    url, size = image_url(file_title)
    if not url:
        print(f"  no url for {file_title}", file=sys.stderr)
        return False
    if size and size > MAX_BYTES:
        print(f"  skip {file_title}: {size} bytes", file=sys.stderr)
        return False
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://overcooked.fandom.com/"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as fh:
        raw = fh.read()
    os.makedirs(os.path.dirname(os.path.abspath(dest)) or ".", exist_ok=True)
    tmp = dest + ".raw"
    with open(tmp, "wb") as fh:
        fh.write(raw)
    try:
        from PIL import Image
        im = Image.open(tmp)
        # keep transparency for icons, flatten photos/screenshots to RGB
        im.convert("RGBA" if "A" in im.getbands() else "RGB").save(dest)
        os.remove(tmp)
    except Exception as exc:  # not an image Pillow understands: keep the raw bytes
        os.replace(tmp, dest)
        print(f"  raw copy for {file_title}: {exc}", file=sys.stderr)
    print(f"  {file_title} -> {dest} ({len(raw)} bytes)")
    return True


def download_page_images(page, out_dir):
    for name in page_images(page):
        if not name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            continue
        stem = os.path.splitext(name)[0]
        download("File:" + name, os.path.join(out_dir, stem + ".png"))


# --- cli --------------------------------------------------------------------
def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    cmd, arg = argv[1], argv[2]
    if cmd == "text":
        text = wikitext(arg)
        print(text if text else f"(no page: {arg})")
    elif cmd == "images":
        print("\n".join(page_images(arg)))
    elif cmd == "search":
        print("\n".join(search(arg)))
    elif cmd == "category":
        print("\n".join(category(arg)))
    elif cmd == "url":
        print(image_url(arg))
    elif cmd == "download":
        download(arg, argv[3])
    elif cmd == "page-images":
        download_page_images(arg, argv[3])
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
