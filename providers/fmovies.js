var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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

// src/moviesdrive/index.js
var cheerio = require("cheerio-without-node-native");
var PROVIDER_NAME = "Asura | MoviesDrive";
var MAIN_URL = "https://moviesdrive.forum";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var REQUEST_TIMEOUT = 1e4;
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Connection": "keep-alive"
};
var visitedUrls = /* @__PURE__ */ new Set();
function fetchSafe(_0) {
  return __async(this, arguments, function* (url, options = {}, timeout = REQUEST_TIMEOUT) {
    try {
      const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(timeout) : null;
      const merged = __spreadProps(__spreadValues({}, options), { headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {}) });
      if (signal)
        merged.signal = signal;
      return yield fetch(url, merged);
    } catch (e) {
      return null;
    }
  });
}
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    try {
      const res = yield fetchSafe(url, options);
      if (!res || !res.ok)
        return null;
      return JSON.parse(yield res.text());
    } catch (e) {
      return null;
    }
  });
}
function fetchHtml(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    try {
      const res = yield fetchSafe(url, options);
      if (!res || !res.ok)
        return null;
      return cheerio.load(yield res.text());
    } catch (e) {
      return null;
    }
  });
}
function parseQuality(text) {
  const t = (text || "").toUpperCase();
  if (t.includes("2160") || t.includes("4K") || t.includes("UHD"))
    return "2160P";
  if (t.includes("1080"))
    return "1080P";
  if (t.includes("720"))
    return "720P";
  if (t.includes("480"))
    return "480P";
  return "HD";
}
function similarity(s1, s2, year) {
  if (!s1 || !s2)
    return 0;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const w1 = norm(s1);
  const w2 = new Set(norm(s2));
  const intersection = w1.filter((x) => w2.has(x)).length;
  let score = intersection / Math.max(w1.length, 1);
  if (year && String(s2).includes(String(year)))
    score += 0.3;
  if (s2.toLowerCase().startsWith(s1.toLowerCase()))
    score += 0.2;
  if (year && w1.length <= 3) {
    const ym = s2.match(/\b(19|20)\d{2}\b/);
    if (ym && Math.abs(parseInt(ym[0]) - parseInt(year)) > 1)
      score -= 0.8;
  }
  return Math.min(score, 1);
}
function dedupe(streams) {
  const seen = /* @__PURE__ */ new Set();
  return (streams || []).filter((s) => {
    if (!s || !s.url || seen.has(s.url))
      return false;
    seen.add(s.url);
    return true;
  });
}
function makeStream(name, title, url, quality, headers = {}) {
  return { name: PROVIDER_NAME + " | " + name, title, url, quality, headers };
}
function getOrigin(url) {
  try {
    const parts = url.split("//");
    if (parts.length < 2)
      return url;
    return parts[0] + "//" + parts[1].split("/")[0];
  } catch (e) {
    return url;
  }
}
function chunkAll(taskFns, size = 3) {
  return __async(this, null, function* () {
    const results = [];
    for (let i = 0; i < taskFns.length; i += size) {
      const batch = yield Promise.all(taskFns.slice(i, i + size).map((fn) => fn().catch(() => [])));
      batch.forEach((r) => results.push(...Array.isArray(r) ? r : r ? [r] : []));
    }
    return results;
  });
}
function getTMDBInfo(id, type) {
  return __async(this, null, function* () {
    const idStr = String(id || "").trim();
    const isImdb = idStr.startsWith("tt");
    const tmdbType = type === "tv" || type === "series" ? "tv" : "movie";
    try {
      if (isImdb) {
        const data = yield fetchJson("https://api.themoviedb.org/3/find/" + idStr + "?api_key=" + TMDB_API_KEY + "&external_source=imdb_id");
        const list = data ? tmdbType === "tv" ? data.tv_results : data.movie_results : null;
        if (list && list.length > 0) {
          const item = list[0];
          return { title: tmdbType === "tv" ? item.name : item.title, year: (item.first_air_date || item.release_date || "").split("-")[0], imdbId: idStr };
        }
        return { title: idStr, year: null, imdbId: idStr };
      } else {
        const data = yield fetchJson("https://api.themoviedb.org/3/" + tmdbType + "/" + idStr + "?api_key=" + TMDB_API_KEY + "&append_to_response=external_ids");
        if (data) {
          return { title: tmdbType === "tv" ? data.name : data.title, year: (data.first_air_date || data.release_date || "").split("-")[0], imdbId: data.imdb_id || null };
        }
      }
    } catch (e) {
    }
    return { title: idStr, year: null, imdbId: null };
  });
}
function searchSite(title, year) {
  return __async(this, null, function* () {
    try {
      const url = MAIN_URL + "/search.php?q=" + encodeURIComponent(title) + "&page=1";
      console.log("[" + PROVIDER_NAME + "] Search: " + url);
      const data = yield fetchJson(url, { headers: HEADERS });
      if (!data || !data.hits)
        return [];
      const results = data.hits.map((hit) => {
        var _a;
        const doc = hit.document;
        return {
          title: (doc.post_title || "").replace(/^Download\s+/i, ""),
          href: MAIN_URL + doc.permalink,
          year: ((_a = (doc.post_title || "").match(/\b(19|20)\d{2}\b/)) == null ? void 0 : _a[0]) || null
        };
      });
      console.log("[" + PROVIDER_NAME + "] Search: found " + results.length + " results");
      return results;
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] Search error: " + e.message);
      return [];
    }
  });
}
function extractHubCloud(url, label, quality) {
  return __async(this, null, function* () {
    if (visitedUrls.has(url))
      return [];
    visitedUrls.add(url);
    try {
      const hubHeaders = __spreadProps(__spreadValues({}, HEADERS), { "Referer": MAIN_URL + "/", "Cookie": "xla=s4t" });
      let baseUrl = getOrigin(url);
      let newUrl = url;
      console.log("[" + PROVIDER_NAME + "] HubCloud: fetching " + url.substring(0, 60));
      const $ = yield fetchHtml(newUrl, { headers: hubHeaders });
      if (!$)
        return [];
      const html = $.html();
      let link = "";
      const scriptMatch = html.match(/var url\s*=\s*'([^']+)'/);
      if (scriptMatch) {
        link = scriptMatch[1];
      } else {
        link = $("#download").attr("href") || "";
        if (link && !link.startsWith("http"))
          link = baseUrl + "/" + link.replace(/^\//, "");
      }
      if (!link)
        return [];
      console.log("[" + PROVIDER_NAME + "] HubCloud: bridge " + link.substring(0, 60));
      const $b = yield fetchHtml(link, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": url, "Cookie": "xla=s4t" }) });
      if (!$b)
        return [];
      const headerText = $b("div.card-header").text();
      const sizeText = $b("i#size").text();
      const detectedQuality = parseQuality(headerText) || quality;
      const streams = [];
      $b("h2 a.btn, a.btn").each((i, el) => {
        const href = $b(el).attr("href");
        const text = $b(el).text().toLowerCase();
        if (!href)
          return;
        if (text.includes("fsl server")) {
          streams.push(makeStream("FSL | " + detectedQuality, label + " [FSL]", href, detectedQuality, { "Referer": link }));
        } else if (text.includes("download file")) {
          streams.push(makeStream("HubCloud | " + detectedQuality, label + " [Direct]", href, detectedQuality, { "Referer": link }));
        } else if (text.includes("mega server")) {
          streams.push(makeStream("Mega | " + detectedQuality, label + " [Mega]", href, detectedQuality, { "Referer": link }));
        } else if (text.includes("s3 server")) {
          streams.push(makeStream("S3 | " + detectedQuality, label + " [S3]", href, detectedQuality, { "Referer": link }));
        } else if (text.includes("fslv2")) {
          streams.push(makeStream("FSLv2 | " + detectedQuality, label + " [FSLv2]", href, detectedQuality, { "Referer": link }));
        } else if (text.includes("buzzserver")) {
          streams.push(makeStream("Buzz | " + detectedQuality, label + " [Buzz]", href, detectedQuality, { "Referer": link }));
        } else if (text.includes("10gbps") || text.includes("10 gbps")) {
          streams.push(makeStream("10Gbps | " + detectedQuality, label + " [10Gbps]", href, detectedQuality, { "Referer": link }));
        } else if (href.includes("pixeldra")) {
          const pixelBase = getOrigin(href);
          const pixelUrl = href.includes("download") ? href : pixelBase + "/api/file/" + href.split("/").pop() + "?download";
          streams.push(makeStream("Pixel | " + detectedQuality, label + " [Pixel]", pixelUrl, detectedQuality, { "Referer": link }));
        }
      });
      console.log("[" + PROVIDER_NAME + "] HubCloud: found " + streams.length + " streams");
      return streams;
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] HubCloud error: " + e.message);
      return [];
    }
  });
}
function extractGDFlix(url, label, quality) {
  return __async(this, null, function* () {
    if (visitedUrls.has(url))
      return [];
    visitedUrls.add(url);
    try {
      console.log("[" + PROVIDER_NAME + "] GDFlix: " + url.substring(0, 60));
      const baseUrl = getOrigin(url);
      const $ = yield fetchHtml(url);
      if (!$)
        return [];
      const fileName = $("ul > li.list-group-item:contains(Name)").text().split("Name : ")[1] || label;
      const detectedQuality = parseQuality(fileName) || quality;
      const streams = [];
      const addStream = (server, link) => {
        if (link)
          streams.push(makeStream("GDFlix | " + detectedQuality, label + " [" + server + "]", link, detectedQuality, { "Referer": baseUrl + "/" }));
      };
      $("div.text-center a").each((i, el) => {
        const text = $(el).text().toLowerCase();
        const link = $(el).attr("href") || "";
        if (text.includes("fsl v2"))
          addStream("FSL V2", link);
        else if (text.includes("direct dl") || text.includes("direct server"))
          addStream("Direct", link);
        else if (text.includes("cloud download") || text.includes("r2"))
          addStream("Cloud", link);
        else if (text.includes("fast cloud")) {
          addStream("FastCloud", link);
        } else if (text.includes("instant dl")) {
          addStream("Instant", link);
        } else if (link.includes("pixeldra")) {
          const pxlUrl = link.includes("download") ? link : getOrigin(link) + "/api/file/" + link.split("/").pop() + "?download";
          addStream("Pixel", pxlUrl);
        }
      });
      try {
        const wfileBase = url.replace("/file/", "/wfile/");
        for (const type of ["1", "2"]) {
          const cfUrl = wfileBase + "?type=" + type;
          const cfDoc = yield fetchHtml(cfUrl, { headers: { "Referer": url } });
          if (cfDoc) {
            const cfLink = cfDoc("a.btn-success, a.btn").attr("href");
            if (cfLink)
              addStream("CF", cfLink);
          }
        }
      } catch (e) {
      }
      console.log("[" + PROVIDER_NAME + "] GDFlix: found " + streams.length + " streams");
      return streams;
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] GDFlix error: " + e.message);
      return [];
    }
  });
}
function extractSourceUrls(pageUrl, label) {
  return __async(this, null, function* () {
    try {
      console.log("[" + PROVIDER_NAME + "] Loading: " + pageUrl.substring(0, 70));
      const $ = yield fetchHtml(pageUrl, { headers: HEADERS });
      if (!$)
        return [];
      const tasks = [];
      $("h5 > a").each((i, el) => {
        const href = $(el).attr("href");
        if (href) {
          tasks.push(() => extractPageLinks(href, label));
        }
      });
      console.log("[" + PROVIDER_NAME + "] Found " + tasks.length + " quality buttons");
      const results = yield chunkAll(tasks, 3);
      return results.flat();
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] Load error: " + e.message);
      return [];
    }
  });
}
function extractPageLinks(pageUrl, label) {
  return __async(this, null, function* () {
    try {
      const $ = yield fetchHtml(pageUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": MAIN_URL + "/" }) });
      if (!$)
        return [];
      const tasks = [];
      $("a").each((i, el) => {
        const href = $(el).attr("href") || "";
        if (href.includes("hubcloud")) {
          tasks.push(() => extractHubCloud(href, label, parseQuality(href)));
        } else if (href.includes("gdflix") || href.includes("gdlink")) {
          tasks.push(() => extractGDFlix(href, label, parseQuality(href)));
        }
      });
      if (tasks.length === 0) {
        $("span:contains(HubCloud), span:contains(GDFlix), span:contains(gdlink)").each((i, el) => {
          const parentText = $(el).parent().text();
          const href = $(el).parent().find("a").attr("href") || $(el).next("a").attr("href") || "";
          if (href.includes("hubcloud")) {
            tasks.push(() => extractHubCloud(href, label, parseQuality(parentText)));
          } else if (href.includes("gdflix") || href.includes("gdlink")) {
            tasks.push(() => extractGDFlix(href, label, parseQuality(parentText)));
          }
        });
      }
      return yield chunkAll(tasks, 2);
    } catch (e) {
      return [];
    }
  });
}
function extractTVStreams(pageUrl, label, targetSeason, targetEpisode) {
  return __async(this, null, function* () {
    try {
      console.log("[" + PROVIDER_NAME + "] TV Load: " + pageUrl.substring(0, 60) + " S=" + targetSeason + " E=" + targetEpisode);
      const $ = yield fetchHtml(pageUrl, { headers: HEADERS });
      if (!$)
        return [];
      const tasks = [];
      $("h5 > a").each((i, el) => {
        const href = $(el).attr("href");
        const text = $(el).text();
        if (!href)
          return;
        const seasonMatch = text.match(/(?:Season|S)\s*(\d+)/i);
        if (seasonMatch && parseInt(seasonMatch[1]) !== Number(targetSeason))
          return;
        tasks.push(() => extractEpisodeLinks(href, label, targetSeason, targetEpisode));
      });
      const results = yield chunkAll(tasks, 3);
      return results.flat();
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] TV error: " + e.message);
      return [];
    }
  });
}
function extractEpisodeLinks(pageUrl, label, season, episode) {
  return __async(this, null, function* () {
    try {
      const $ = yield fetchHtml(pageUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": MAIN_URL + "/" }) });
      if (!$)
        return [];
      const tasks = [];
      $("span:contains(HubCloud), span:contains(GDFlix), span:contains(gdlink)").each((i, el) => {
        var _a;
        const epSpan = $(el).parent().prev("span").text() || "";
        const epNum = parseInt((_a = epSpan.match(/Ep(\d+)/i)) == null ? void 0 : _a[1]) || 0;
        if (epNum !== Number(episode))
          return;
        const href = $(el).parent().find("a").attr("href") || "";
        if (href.includes("hubcloud"))
          tasks.push(() => extractHubCloud(href, label + " S" + season, parseQuality(href)));
        else if (href.includes("gdflix") || href.includes("gdlink"))
          tasks.push(() => extractGDFlix(href, label + " S" + season, parseQuality(href)));
      });
      if (tasks.length === 0) {
        $('a[href*="hubcloud"], a[href*="gdflix"], a[href*="gdlink"]').each((i, el) => {
          var _a;
          const href = $(el).attr("href") || "";
          const parentText = $(el).parent().text();
          const epNum = parseInt((_a = parentText.match(/Ep\s*(\d+)/i)) == null ? void 0 : _a[1]) || 0;
          if (epNum !== Number(episode))
            return;
          if (href.includes("hubcloud"))
            tasks.push(() => extractHubCloud(href, label + " S" + season, parseQuality(parentText)));
          else if (href.includes("gdflix") || href.includes("gdlink"))
            tasks.push(() => extractGDFlix(href, label + " S" + season, parseQuality(parentText)));
        });
      }
      return yield chunkAll(tasks, 2);
    } catch (e) {
      return [];
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    visitedUrls = /* @__PURE__ */ new Set();
    try {
      const info = yield getTMDBInfo(tmdbId, mediaType);
      if (!info.title)
        return [];
      const isTv = mediaType === "tv" || mediaType === "series";
      const safeSeason = season != null ? Number(season) : null;
      const safeEpisode = episode != null ? Number(episode) : null;
      console.log("[" + PROVIDER_NAME + "] Request: ID=" + tmdbId + " " + info.title + " (" + (info.year || "N/A") + ") Tv=" + isTv);
      const searchResults = yield searchSite(info.title, info.year);
      let bestMatch = null, bestScore = 0;
      for (const r of searchResults) {
        const score = similarity(info.title, r.title, info.year);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = r;
        }
      }
      if (!bestMatch || bestScore < 0.4) {
        console.log("[" + PROVIDER_NAME + "] No match found");
        return [];
      }
      console.log("[" + PROVIDER_NAME + "] Best: " + bestMatch.title + " (" + bestScore.toFixed(2) + ")");
      let pageStreams = [];
      if (isTv) {
        pageStreams = yield extractTVStreams(bestMatch.href, info.title, safeSeason, safeEpisode);
      } else {
        pageStreams = yield extractSourceUrls(bestMatch.href, info.title);
      }
      const result = dedupe(pageStreams);
      console.log("[" + PROVIDER_NAME + "] Total: " + result.length + " streams");
      return result;
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] Fatal: " + e.message);
      return [];
    }
  });
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
