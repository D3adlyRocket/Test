/**
 * moviesmod — built 2026-07-19T07:47:42.878Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/moviesmod/resolvers/index.js
var require_resolvers = __commonJS({
  "src/moviesmod/resolvers/index.js"(exports2, module2) {
    var cheerio2 = require("cheerio-without-node-native");
    var crypto2 = require("crypto-js");
    var HEADERS2 = (referer) => __spreadValues({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/json,*/*",
      "Accept-Language": "en-US,en;q=0.9"
    }, referer ? { Referer: referer } : {});
    function getHTML2(url) {
      return __async(this, null, function* () {
        const r = yield fetch(url, { headers: HEADERS2(url), redirect: "follow" });
        if (!r.ok)
          throw new Error(`HTTP ${r.status} ${url}`);
        return { html: yield r.text(), finalUrl: r.url };
      });
    }
    function resolveGdrive(url) {
      return __async(this, null, function* () {
        const m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
        if (!m)
          return null;
        const id = m[1];
        return {
          url: `https://drive.google.com/uc?export=download&id=${id}`,
          headers: HEADERS2(url)
        };
      });
    }
    function resolvePixelDrain(url) {
      return __async(this, null, function* () {
        const m = url.match(/pixeldrain\.com\/u\/([A-Za-z0-9]+)/);
        if (!m)
          return null;
        return {
          url: `https://pixeldrain.com/api/file/${m[1]}?download`,
          headers: HEADERS2(url)
        };
      });
    }
    function resolveStreamtape(url) {
      return __async(this, null, function* () {
        const { html, finalUrl } = yield getHTML2(url);
        const m = html.match(/get_video\?id=([^'"]+)/) || html.match(/src=["'](https?:\/\/streamtape\.com\/[^'"]+)/);
        if (!m)
          return null;
        return { url: "https://streamtape.com/get_video?" + (m[1] ? "id=" + m[1] : ""), headers: HEADERS2(finalUrl) };
      });
    }
    function resolveHubCloud(url) {
      return __async(this, null, function* () {
        try {
          const { html, finalUrl } = yield getHTML2(url);
          const $ = cheerio2.load(html);
          const direct = $('a[href*=".mkv"], a[href*=".mp4"], a[href*="workers.dev"]').map((_, a) => $(a).attr("href")).get();
          if (direct.length) {
            return { url: direct[0], headers: HEADERS2(finalUrl) };
          }
          const form = $('form#hubcloud, form[action*="hubcloud"]').first();
          if (form.length) {
            const action = form.attr("action") || finalUrl;
            const data = {};
            form.find("input, select, textarea").each((_, el) => {
              const name = $(el).attr("name");
              if (name)
                data[name] = $(el).attr("value") || "";
            });
            const r = yield fetch(action, {
              method: "POST",
              headers: __spreadProps(__spreadValues({}, HEADERS2(finalUrl)), { "Content-Type": "application/x-www-form-urlencoded" }),
              body: new URLSearchParams(data).toString(),
              redirect: "follow"
            });
            const h = yield r.text();
            const m2 = h.match(/https?:\/\/[^\s'"]*\.(?:mp4|mkv|m3u8)[^\s'"]*/i) || h.match(/https?:\/\/[a-z0-9.-]+\.workers\.dev\/[^\s'"]+/i) || h.match(/https?:\/\/hubcloud\.[a-z.]+\/api\/file\/[^\s'"]+/i);
            if (m2)
              return { url: m2[0], headers: HEADERS2(r.url) };
          }
        } catch (e) {
        }
        return null;
      });
    }
    function resolveGDFlix(url) {
      return __async(this, null, function* () {
        try {
          const { html, finalUrl } = yield getHTML2(url);
          const b64 = html.match(/atob\("([A-Za-z0-9+/=]+)"\)/) || html.match(/base64,([A-Za-z0-9+/=]+)/);
          if (b64) {
            try {
              const decoded = crypto2.enc.Utf8.stringify(crypto2.enc.Base64.parse(b64[1]));
              if (/^https?:/.test(decoded)) {
                return { url: decoded, headers: HEADERS2(finalUrl) };
              }
            } catch (_) {
            }
          }
          const g = html.match(/https?:\/\/drive\.google\.com\/file\/d\/[^'"\s]+/);
          if (g)
            return { url: g[0], headers: HEADERS2(finalUrl) };
        } catch (e) {
        }
        return null;
      });
    }
    function resolveDirectFile(url) {
      return __async(this, null, function* () {
        if (/\.(mp4|m3u8|mkv|webm)(\?|$)/i.test(url)) {
          return { url, headers: HEADERS2(url) };
        }
        try {
          const r = yield fetch(url, { method: "HEAD", headers: HEADERS2(url), redirect: "follow" });
          const ct = r.headers.get("content-type") || "";
          if (/video|octet-stream/.test(ct)) {
            return { url: r.url, headers: HEADERS2(url) };
          }
        } catch (_) {
        }
        return null;
      });
    }
    function resolveModlinks(url) {
      return __async(this, null, function* () {
        try {
          const { html, finalUrl } = yield getHTML2(url);
          const $ = cheerio2.load(html);
          const out = /* @__PURE__ */ new Set();
          $("a[href]").each((_, a) => {
            const h = $(a).attr("href");
            if (!h)
              return;
            if (/drive\.google|pixeldrain|hubcloud|hubcdn|streamtape|hubdrive|gdtot|gdflix/i.test(h)) {
              out.add(h);
            }
          });
          for (const candidate of out) {
            const r = yield resolveAny2(candidate);
            if (r)
              return r;
          }
        } catch (e) {
        }
        return null;
      });
    }
    function resolveAny2(url) {
      return __async(this, null, function* () {
        if (!url)
          return null;
        const resolvers = [
          resolveDirectFile,
          resolvePixelDrain,
          resolveGdrive,
          resolveStreamtape,
          resolveHubCloud,
          resolveGDFlix,
          resolveModlinks
        ];
        for (const fn of resolvers) {
          try {
            const r = yield fn(url);
            if (r)
              return r;
          } catch (_) {
          }
        }
        return null;
      });
    }
    module2.exports = { resolveAny: resolveAny2, HEADERS: HEADERS2 };
  }
});

// src/moviesmod/index.js
var cheerio = require("cheerio-without-node-native");
var crypto = require("crypto-js");
var { resolveAny, HEADERS } = require_resolvers();
var BASE = "https://moviesmod.at";
var cache = {
  posts: /* @__PURE__ */ new Map(),
  meta: /* @__PURE__ */ new Map(),
  streams: /* @__PURE__ */ new Map(),
  ttl: 5 * 60 * 1e3
};
var set = (m, k, v) => m.set(k, { v, t: Date.now() });
var get = (m, k) => {
  const e = m.get(k);
  if (!e)
    return null;
  if (Date.now() - e.t > cache.ttl) {
    m.delete(k);
    return null;
  }
  return e.v;
};
var decodeId = (postId) => {
  try {
    return crypto.enc.Utf8.stringify(crypto.enc.Base64.parse(postId));
  } catch (e) {
    return null;
  }
};
var encodeUrl = (url) => crypto.enc.Base64.stringify(crypto.enc.Utf8.parse(url)).replace(/=+$/, "");
var isHttpUrl = (value = "") => /^https?:\/\//i.test((value || "").trim());
var normalizeImdbId = (value = "") => {
  const match = String(value).trim().match(/(?:imdb[:\s/-]*)?(tt\d{5,})/i);
  return match ? match[1].toLowerCase() : null;
};
var normalizeTmdbId = (value = "") => {
  const raw = String(value).trim();
  if (!raw)
    return null;
  const cleaned = raw.replace(/^tmdb[:\s/-]*/i, "");
  return /^\d{1,12}$/.test(cleaned) ? cleaned : null;
};
var buildLookupTerms = (postRef) => {
  const terms = /* @__PURE__ */ new Set();
  const add = (v) => {
    const imdb = normalizeImdbId(v);
    if (imdb)
      terms.add(imdb);
    const tmdb = normalizeTmdbId(v);
    if (tmdb)
      terms.add(tmdb);
  };
  if (postRef && typeof postRef === "object") {
    add(postRef.imdbId);
    add(postRef.tmdbId);
    add(postRef.imdb);
    add(postRef.tmdb);
    add(postRef.id);
  } else {
    add(postRef);
  }
  return Array.from(terms);
};
function findPostUrlByLookupTerm(term) {
  return __async(this, null, function* () {
    const { html } = yield getHTML(`${BASE}/?s=${encodeURIComponent(term)}`);
    const $ = cheerio.load(html);
    const results = [];
    $("article").each((_, el) => {
      const article = $(el);
      const href = article.find("a[href]").first().attr("href");
      if (!href)
        return;
      let postUrl;
      try {
        postUrl = new URL(href, BASE).toString();
      } catch (e) {
        return;
      }
      const title = article.find(".entry-title").text().trim();
      const snippet = article.text().replace(/\s+/g, " ").trim();
      const haystack = `${title} ${snippet} ${postUrl}`.toLowerCase();
      let score = 0;
      if (haystack.includes(term.toLowerCase()))
        score += 5;
      if (title.toLowerCase().includes(term.toLowerCase()))
        score += 3;
      results.push({ postUrl: postUrl.replace(/\/+$/, ""), score });
    });
    if (!results.length)
      return null;
    results.sort((a, b) => b.score - a.score);
    return results[0].postUrl;
  });
}
function resolvePostRef(postRef) {
  return __async(this, null, function* () {
    const normalized = normalizePostRef(postRef);
    if (normalized.url)
      return normalized;
    const lookupTerms = buildLookupTerms(postRef);
    for (const term of lookupTerms) {
      try {
        const postUrl = yield findPostUrlByLookupTerm(term);
        if (!postUrl)
          continue;
        return {
          cacheKey: `lookup:${term}`,
          url: postUrl,
          id: encodeUrl(postUrl)
        };
      } catch (_) {
      }
    }
    return normalized;
  });
}
var normalizePostRef = (postRef) => {
  var _a, _b, _c;
  if (postRef && typeof postRef === "object") {
    return normalizePostRef((_c = (_b = (_a = postRef.postId) != null ? _a : postRef.id) != null ? _b : postRef.url) != null ? _c : postRef.href);
  }
  const raw = typeof postRef === "string" ? postRef.trim() : "";
  if (!raw)
    return { cacheKey: "empty", url: null, id: null };
  if (isHttpUrl(raw)) {
    const url = raw.replace(/\/+$/, "");
    return { cacheKey: `url:${url}`, url, id: encodeUrl(url) };
  }
  const decoded = decodeId(raw);
  if (decoded && isHttpUrl(decoded)) {
    const url = decoded.replace(/\/+$/, "");
    return { cacheKey: `id:${raw}`, url, id: raw };
  }
  return { cacheKey: `raw:${raw}`, url: null, id: raw };
};
var inferType = (text = "") => /\bseason\b|\bepisode\b|\bs\d{1,2}\b|\bseries\b|\btv\b/i.test(text) ? "series" : "movie";
function getHTML(url) {
  return __async(this, null, function* () {
    const r = yield fetch(url, { headers: HEADERS(url), redirect: "follow" });
    if (!r.ok)
      throw new Error(`HTTP ${r.status} on ${url}`);
    return { html: yield r.text(), finalUrl: r.url };
  });
}
function getCatalog() {
  return __async(this, null, function* () {
    const cached = get(cache.posts, "catalog");
    if (cached)
      return cached;
    const fallback = [
      { id: "moviesmod-trending", title: "Trending", filter: "trending", type: "movie" },
      { id: "moviesmod-latest", title: "Latest", filter: "latest", type: "movie" },
      { id: "moviesmod-hollywood", title: "Hollywood Movies", filter: "/category/hollywood-movies/", type: "movie" },
      { id: "moviesmod-bollywood", title: "Bollywood Movies", filter: "/category/bollywood-movies/", type: "movie" }
    ];
    try {
      const { html } = yield getHTML(BASE);
      const $ = cheerio.load(html);
      const seen = /* @__PURE__ */ new Set();
      const dynamic = [];
      $('a[href*="/category/"]').each((_, el) => {
        const rawHref = $(el).attr("href");
        const rawTitle = $(el).text().replace(/\s+/g, " ").trim();
        if (!rawHref || !rawTitle)
          return;
        let u;
        try {
          u = new URL(rawHref, BASE);
        } catch (e) {
          return;
        }
        if (!u.pathname.includes("/category/"))
          return;
        const filter = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
        if (seen.has(filter))
          return;
        seen.add(filter);
        const slug = (u.pathname.split("/").filter(Boolean).pop() || "category").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
        dynamic.push({
          id: `moviesmod-${slug}`,
          title: rawTitle,
          filter,
          type: inferType(rawTitle)
        });
      });
      const catalog = [
        { id: "moviesmod-trending", title: "Trending", filter: "trending", type: "movie" },
        { id: "moviesmod-latest", title: "Latest", filter: "latest", type: "movie" },
        ...dynamic
      ];
      if (dynamic.length > 0) {
        set(cache.posts, "catalog", catalog);
        return catalog;
      }
    } catch (_) {
    }
    set(cache.posts, "catalog", fallback);
    return fallback;
  });
}
function buildFeedUrl(filter, page) {
  if (!filter || filter === "trending") {
    return page > 1 ? `${BASE}/?paged=${page}` : `${BASE}/`;
  }
  if (filter === "latest") {
    return page > 1 ? `${BASE}/?order=latest&paged=${page}` : `${BASE}/?order=latest`;
  }
  let u;
  try {
    u = new URL(filter, BASE);
  } catch (e) {
    return page > 1 ? `${BASE}/?paged=${page}` : `${BASE}/`;
  }
  if (u.pathname.includes("/category/")) {
    const normalized = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
    return page > 1 ? `${u.origin}${normalized}page/${page}/` : `${u.origin}${normalized}`;
  }
  if (page > 1)
    u.searchParams.set("paged", String(page));
  return u.toString();
}
function getPosts(filter, page = 1) {
  return __async(this, null, function* () {
    const url = buildFeedUrl(filter || "trending", page);
    const { html } = yield getHTML(url);
    const $ = cheerio.load(html);
    const posts = [];
    $("article").each((_, el) => {
      var _a;
      const a = $(el).find("a").first();
      const href = a.attr("href");
      if (!href)
        return;
      let postUrl;
      try {
        postUrl = new URL(href, BASE).toString();
      } catch (e) {
        return;
      }
      const title = $(el).find(".entry-title").text().trim() || ((_a = a.attr("title")) == null ? void 0 : _a.trim()) || a.text().trim();
      const poster = $(el).find("img").attr("src") || $(el).find("img").attr("data-src");
      if (!title)
        return;
      posts.push({
        id: encodeUrl(postUrl),
        type: inferType(title),
        title,
        poster: poster || void 0
      });
    });
    const hasNext = $('.pagination .next, .nav-links a.next, a[rel="next"]').length > 0;
    return { posts, nextPage: posts.length > 0 && hasNext ? page + 1 : void 0 };
  });
}
function getMeta(postRef) {
  return __async(this, null, function* () {
    const ref = yield resolvePostRef(postRef);
    const cached = get(cache.meta, ref.cacheKey);
    if (cached)
      return cached;
    if (!ref.url)
      throw new Error("bad postId");
    const { html } = yield getHTML(ref.url);
    const $ = cheerio.load(html);
    const title = $("h1.entry-title, h1").first().text().trim() || $("title").text().split("\u2014")[0].trim();
    const poster = $('meta[property="og:image"]').attr("content") || $(".entry-content img").first().attr("src");
    const desc = $('meta[property="og:description"]').attr("content") || $(".entry-content p").first().text().trim();
    const year = parseInt(
      (($(".entry-meta, .date, .entry-date").text() || "").match(/\b(19|20)\d{2}\b/) || [])[0] || "",
      10
    ) || void 0;
    const isSeries = /\bseason\b|\bepisode\b/i.test($(".entry-content").text() || "");
    const type = isSeries ? "series" : "movie";
    const meta = {
      id: ref.id || postRef,
      type,
      title,
      poster: poster || void 0,
      description: desc || void 0,
      year
    };
    set(cache.meta, ref.cacheKey, meta);
    return meta;
  });
}
function extractQuality(label) {
  const m = label && label.match(/\b(2160p|1080p|720p|480p|360p|4K)\b/i);
  return m ? m[1].toLowerCase() : "Auto";
}
function detectHost(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes("drive.google"))
      return "Gdrive";
    if (h.includes("pixeldrain"))
      return "PixelDrain";
    if (h.includes("streamtape"))
      return "Streamtape";
    if (h.includes("hubcloud"))
      return "HubCloud";
    if (h.includes("hubcdn"))
      return "HubCDN";
    if (h.includes("hubdrive"))
      return "HubDrive";
    if (h.includes("gdflix"))
      return "GDFlix";
    if (h.includes("gdtot"))
      return "GDTot";
    if (h.includes("modlinks"))
      return "Modlinks";
    if (/\.(mp4|m3u8|mkv)/.test(url))
      return "Direct";
    return h.split(".").slice(-2, -1)[0];
  } catch (e) {
    return "Unknown";
  }
}
function getStreams(postRef) {
  return __async(this, null, function* () {
    const ref = yield resolvePostRef(postRef);
    const cached = get(cache.streams, ref.cacheKey);
    if (cached)
      return cached;
    if (!ref.url)
      return [];
    const { html } = yield getHTML(ref.url);
    const $ = cheerio.load(html);
    const candidateMap = /* @__PURE__ */ new Map();
    const addCandidate = (href, label) => {
      if (!href)
        return;
      let absolute;
      try {
        absolute = new URL(href, ref.url).toString();
      } catch (e) {
        return;
      }
      if (!/^https?:\/\//i.test(absolute))
        return;
      const normalized = absolute.replace(/\/+$/, "");
      if (!candidateMap.has(normalized)) {
        candidateMap.set(normalized, { href: normalized, label: (label || "").trim() });
      }
    };
    $(".entry-content a[href], .entry-content [data-href], .entry-content [data-url], .entry-content [onclick]").each((_, el) => {
      const node = $(el);
      const text = node.text().trim();
      addCandidate(node.attr("href"), text);
      addCandidate(node.attr("data-href"), text);
      addCandidate(node.attr("data-url"), text);
      const onClick = node.attr("onclick") || "";
      const clickUrl = onClick.match(/https?:\/\/[^\s"'`<>]+/i) || onClick.match(/(?:window\.open|location(?:\.href)?\s*=)\s*['"]([^'"]+)['"]/i);
      if (clickUrl)
        addCandidate(clickUrl[1] || clickUrl[0], text);
    });
    const candidates = Array.from(candidateMap.values());
    const results = [];
    const queue = candidates.slice();
    const workers = 6;
    function run() {
      return __async(this, null, function* () {
        while (queue.length) {
          const c = queue.shift();
          try {
            const r = yield resolveAny(c.href);
            if (r) {
              const host = detectHost(r.url);
              const q = extractQuality(c.label);
              results.push({
                title: `${c.label || host} \u2014 ${host} [${q}]`.replace(/\s+/g, " ").trim(),
                url: r.url,
                quality: q,
                headers: r.headers || HEADERS(r.url),
                host
              });
            }
          } catch (_) {
          }
        }
      });
    }
    yield Promise.all(Array.from({ length: workers }, run));
    const seen = /* @__PURE__ */ new Set();
    const streams = results.filter((s) => {
      if (seen.has(s.url))
        return false;
      seen.add(s.url);
      return true;
    });
    set(cache.streams, ref.cacheKey, streams);
    return streams;
  });
}
module.exports = { getCatalog, getPosts, getMeta, getStreams };
