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

// src/zinkmovies/index.js
var cheerio = require("cheerio-without-node-native");
var PROVIDER_NAME = "Asura | ZinkMovies";
var MAIN_URL = "https://new7.zinkmovies.biz";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var REQUEST_TIMEOUT = 1e4;
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Connection": "keep-alive"
};
var visitedUrls = /* @__PURE__ */ new Set();
var processedFiles = /* @__PURE__ */ new Set();
function fetchSafe(_0) {
  return __async(this, arguments, function* (url, options = {}, timeout = REQUEST_TIMEOUT) {
    try {
      const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(timeout) : null;
      const merged = __spreadProps(__spreadValues({}, options), { headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {}) });
      if (signal)
        merged.signal = signal;
      const res = yield fetch(url, merged);
      return res;
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] fetchSafe error: " + url.substring(0, 100) + " -> " + e.message);
      return null;
    }
  });
}
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    try {
      const res = yield fetchSafe(url, options);
      if (!res || !res.ok) {
        console.error("[" + PROVIDER_NAME + "] fetchJson failed: " + (res ? res.status : "null") + " " + url.substring(0, 100));
        return null;
      }
      return JSON.parse(yield res.text());
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] fetchJson parse error: " + url.substring(0, 100) + " -> " + e.message);
      return null;
    }
  });
}
function fetchHtml(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    try {
      const res = yield fetchSafe(url, options);
      if (!res || !res.ok) {
        console.error("[" + PROVIDER_NAME + "] fetchHtml failed: " + (res ? res.status : "null") + " " + url.substring(0, 100));
        return null;
      }
      return cheerio.load(yield res.text());
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] fetchHtml error: " + url.substring(0, 100) + " -> " + e.message);
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
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const w1 = clean(s1);
  const w2 = new Set(clean(s2));
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
          return {
            title: tmdbType === "tv" ? item.name : item.title,
            year: (item.first_air_date || item.release_date || "").split("-")[0],
            imdbId: idStr
          };
        }
        return { title: idStr, year: null, imdbId: idStr };
      } else {
        const data = yield fetchJson("https://api.themoviedb.org/3/" + tmdbType + "/" + idStr + "?api_key=" + TMDB_API_KEY + "&append_to_response=external_ids");
        if (data) {
          const imdbId = data.imdb_id || data.external_ids && data.external_ids.imdb_id || null;
          return {
            title: tmdbType === "tv" ? data.name : data.title,
            year: (data.first_air_date || data.release_date || "").split("-")[0],
            imdbId
          };
        }
      }
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] TMDB error: " + e.message);
    }
    return { title: idStr, year: null, imdbId: null };
  });
}
function searchSite(title, year) {
  return __async(this, null, function* () {
    const url = MAIN_URL + "/?s=" + encodeURIComponent(title);
    console.log("[" + PROVIDER_NAME + "] Search: " + url);
    try {
      const $ = yield fetchHtml(url, { headers: HEADERS });
      if (!$) {
        console.log("[" + PROVIDER_NAME + "] Search: no HTML returned");
        return [];
      }
      const results = [];
      $(".result-item article, article.item, article").each((i, el) => {
        const linkEl = $(el).find(".title a, h2 a, h3 a").first();
        const itemTitle = linkEl.text().trim();
        const href = linkEl.attr("href");
        if (href && itemTitle) {
          results.push({ title: itemTitle, href, year: (itemTitle.match(/\d{4}/) || [null])[0] });
        }
      });
      console.log("[" + PROVIDER_NAME + "] Search: found " + results.length + " results for '" + title + "'");
      return results;
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] Search error: " + e.message);
      return [];
    }
  });
}
function extractBraceObject(str, startIdx) {
  if (str[startIdx] !== "{")
    return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < str.length; i++) {
    const c = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"' && !inString) {
      inString = true;
      continue;
    }
    if (c === '"' && inString) {
      inString = false;
      continue;
    }
    if (inString)
      continue;
    if (c === "{")
      depth++;
    if (c === "}")
      depth--;
    if (depth === 0)
      return str.substring(startIdx, i + 1);
  }
  return null;
}
function resolveEmbed(imdbId, label, isTv = false, season, episode) {
  return __async(this, null, function* () {
    if (!imdbId)
      return [];
    try {
      const s = season != null ? Number(season) : 1;
      const e = episode != null ? Number(episode) : 1;
      let playerUrl = "https://hrujo406fix.com/play/" + imdbId;
      if (isTv && !isNaN(s) && !isNaN(e))
        playerUrl += "?s=" + s + "&e=" + e;
      console.log("[" + PROVIDER_NAME + "] Embed: fetching " + playerUrl);
      const res = yield fetchSafe(playerUrl, { headers: HEADERS }, 1e4);
      if (!res || !res.ok) {
        console.log("[" + PROVIDER_NAME + "] Embed: page fetch failed (" + (res ? res.status : "null") + ")");
        return [];
      }
      const html = yield res.text();
      let p3Raw = null;
      const p3Start = html.indexOf("let p3 = ");
      if (p3Start >= 0) {
        const braceIdx = html.indexOf("{", p3Start);
        if (braceIdx >= 0)
          p3Raw = extractBraceObject(html, braceIdx);
      }
      if (!p3Raw) {
        const p3Start2 = html.indexOf("var p3 = ");
        if (p3Start2 >= 0) {
          const braceIdx = html.indexOf("{", p3Start2);
          if (braceIdx >= 0)
            p3Raw = extractBraceObject(html, braceIdx);
        }
      }
      if (!p3Raw) {
        const p3Start3 = html.indexOf("p3 = ");
        if (p3Start3 >= 0) {
          const braceIdx = html.indexOf("{", p3Start3);
          if (braceIdx >= 0)
            p3Raw = extractBraceObject(html, braceIdx);
        }
      }
      if (!p3Raw) {
        console.log("[" + PROVIDER_NAME + "] Embed: p3 object not found in page");
        return [];
      }
      let p3;
      try {
        p3 = JSON.parse(p3Raw);
      } catch (e2) {
        try {
          p3 = JSON.parse(p3Raw.replace(/\\\//g, "/"));
        } catch (e3) {
          console.log("[" + PROVIDER_NAME + "] Embed: p3 JSON parse failed");
          return [];
        }
      }
      if (!p3.file || !p3.key) {
        console.log("[" + PROVIDER_NAME + "] Embed: p3 missing file or key");
        return [];
      }
      const playlistUrl = p3.file.startsWith("http") ? p3.file : "https://hrujo406fix.com" + p3.file;
      console.log("[" + PROVIDER_NAME + "] Embed: playlist URL = " + playlistUrl.substring(0, 100));
      let currentUrl = playlistUrl;
      for (let attempt = 0; attempt < 3; attempt++) {
        console.log("[" + PROVIDER_NAME + "] Embed: POST attempt " + (attempt + 1) + " -> " + currentUrl.substring(0, 80));
        const fRes = yield fetchSafe(currentUrl, {
          method: "POST",
          headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": playerUrl, "X-CSRF-TOKEN": p3.key, "X-Requested-With": "XMLHttpRequest" })
        });
        if (!fRes || !fRes.ok) {
          console.log("[" + PROVIDER_NAME + "] Embed: POST failed (" + (fRes ? fRes.status : "null") + ")");
          break;
        }
        const data = (yield fRes.text()).trim();
        let finalUrl = data;
        if (data.startsWith("[") || data.startsWith("{")) {
          try {
            const json = JSON.parse(data);
            const findFile = (obj) => {
              if (!obj)
                return "";
              if (obj.file)
                return obj.file;
              if (obj.folder && Array.isArray(obj.folder) && obj.folder.length > 0) {
                for (const f of obj.folder) {
                  const result = findFile(f);
                  if (result)
                    return result;
                }
              }
              return "";
            };
            const item = Array.isArray(json) ? json[0] : json;
            finalUrl = findFile(item) || "";
          } catch (e2) {
            console.log("[" + PROVIDER_NAME + "] Embed: JSON parse of response failed");
            break;
          }
        }
        if (!finalUrl) {
          console.log("[" + PROVIDER_NAME + "] Embed: no URL in response");
          break;
        }
        if (finalUrl.startsWith("~")) {
          currentUrl = "https://hrujo406fix.com/playlist/" + finalUrl.substring(1) + ".txt";
          console.log("[" + PROVIDER_NAME + "] Embed: following hash -> " + currentUrl.substring(0, 80));
          continue;
        }
        if (finalUrl.includes("m3u8") || finalUrl.includes(".mp4")) {
          console.log("[" + PROVIDER_NAME + "] Embed: found stream -> " + finalUrl.substring(0, 80));
          return [makeStream("Embed | Multi", label + " [HLS Player]", finalUrl, "Multi", { "Referer": "https://hrujo406fix.com/" })];
        }
        break;
      }
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] Embed fatal: " + e.message);
    }
    return [];
  });
}
function resolveHubCloud(url, label, quality) {
  return __async(this, null, function* () {
    if (visitedUrls.has(url))
      return [];
    visitedUrls.add(url);
    try {
      let bridgeUrl = url;
      if (!url.includes("hubcloud.php")) {
        console.log("[" + PROVIDER_NAME + "] HubCloud: fetching landing page " + url.substring(0, 80));
        const hubHeaders = __spreadProps(__spreadValues({}, HEADERS), { "Referer": MAIN_URL + "/", "Cookie": "xla=s4t" });
        const $ = yield fetchHtml(url, { headers: hubHeaders });
        if (!$) {
          console.log("[" + PROVIDER_NAME + "] HubCloud: landing page fetch failed");
          return [];
        }
        const html = $.html();
        const varUrlMatch = html.match(/var url\s*=\s*'([^']+)'/);
        if (varUrlMatch) {
          bridgeUrl = varUrlMatch[1];
          console.log("[" + PROVIDER_NAME + "] HubCloud: found bridge URL -> " + bridgeUrl.substring(0, 100));
        } else {
          const downloadHref = $("#download").attr("href") || $("a").filter((i, el) => {
            var _a;
            return (_a = $(el).attr("href")) == null ? void 0 : _a.includes("hubcloud.php");
          }).attr("href");
          if (!downloadHref) {
            console.log("[" + PROVIDER_NAME + "] HubCloud: no bridge URL found");
            return [];
          }
          bridgeUrl = downloadHref.startsWith("http") ? downloadHref : getOrigin(url) + "/" + downloadHref.replace(/^\//, "");
        }
      }
      console.log("[" + PROVIDER_NAME + "] HubCloud: fetching bridge page " + bridgeUrl.substring(0, 100));
      const $b = yield fetchHtml(bridgeUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": url, "Cookie": "xla=s4t" }) });
      if (!$b)
        return [];
      const detectedQuality = parseQuality($b("div.card-header").text()) || quality;
      const streams = [];
      const bridgeRef = bridgeUrl;
      const fslLink = $b("a#fsl").attr("href");
      if (fslLink) {
        console.log("[" + PROVIDER_NAME + "] HubCloud: FSL link found");
        streams.push(makeStream("FSL | " + detectedQuality, label + " [FSL Server]", fslLink, detectedQuality, { "Referer": bridgeRef }));
      }
      $b("a.btn, a.btn2, a.btn-success, a.btn-success1, a.btn-lg").each((i, el) => {
        const link = $b(el).attr("href");
        const text = $b(el).text().toLowerCase();
        if (!link)
          return;
        if (text.includes("fsl") && !link.includes("fsl")) {
          streams.push(makeStream("FSL | " + detectedQuality, label + " [FSL]", link, detectedQuality, { "Referer": bridgeRef }));
        } else if (text.includes("download file") || text.includes("s3 server")) {
          streams.push(makeStream("HubCloud | " + detectedQuality, label + " [" + text.toUpperCase().trim() + "]", link, detectedQuality, { "Referer": bridgeRef }));
        } else if (text.includes("10gbps") || text.includes("10 gbps")) {
          streams.push(makeStream("10Gbps | " + detectedQuality, label + " [10Gbps]", link, detectedQuality, { "Referer": bridgeRef }));
        } else if (text.includes("fslv2")) {
          streams.push(makeStream("FSLv2 | " + detectedQuality, label + " [FSLv2]", link, detectedQuality, { "Referer": bridgeRef }));
        }
      });
      console.log("[" + PROVIDER_NAME + "] HubCloud: found " + streams.length + " playable streams");
      return streams;
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] HubCloud error: " + e.message);
      return [];
    }
  });
}
function resolveGDFlix(url, label, quality) {
  return __async(this, null, function* () {
    if (visitedUrls.has(url))
      return [];
    visitedUrls.add(url);
    return [];
  });
}
function resolveZinkCloud(url, label, quality) {
  return __async(this, null, function* () {
    const fileID = url.split("/").pop();
    if (processedFiles.has(fileID))
      return [];
    processedFiles.add(fileID);
    try {
      const domain = getOrigin(url);
      console.log("[" + PROVIDER_NAME + "] ZinkCloud: fileID=" + fileID + " quality=" + quality);
      const tokenData = yield fetchJson(domain + "/ajax_generate_token.php?random_id=" + fileID, {
        method: "POST",
        headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": url, "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded" }),
        body: "random_id=" + fileID
      });
      if (!tokenData || tokenData.status !== "success" || !tokenData.token) {
        console.log("[" + PROVIDER_NAME + "] ZinkCloud: token generation failed");
        return [];
      }
      console.log("[" + PROVIDER_NAME + "] ZinkCloud: token obtained, length=" + tokenData.token.length);
      const dlPageUrl = domain + "/dl/" + tokenData.token;
      console.log("[" + PROVIDER_NAME + "] ZinkCloud: fetching Worker + mirrors in parallel...");
      const [workerData, dlHtml] = yield Promise.all([
        fetchJson(domain + "/server-handler.php", {
          method: "POST",
          headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": dlPageUrl, "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }),
          body: JSON.stringify({ server: "worker", random_id: fileID })
        }),
        fetchHtml(dlPageUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": url }) })
      ]);
      const streams = [];
      if (workerData && workerData.success && workerData.url) {
        console.log("[" + PROVIDER_NAME + "] ZinkCloud: Worker URL obtained");
        streams.push(makeStream("Worker | " + quality, label + " [Direct]", workerData.url, quality, { "Referer": dlPageUrl }));
      }
      const hubLinks = [];
      if (dlHtml) {
        dlHtml("a.btn.hubcloud").each((i, el) => {
          const href = dlHtml(el).attr("href");
          if (href)
            hubLinks.push(href);
        });
      }
      if (hubLinks.length > 0) {
        const hubResults = yield Promise.all(hubLinks.map(
          (href) => resolveHubCloud(href, label, quality).catch(() => null)
        ));
        hubResults.forEach((result) => {
          if (result && Array.isArray(result) && result.length > 0) {
            result.forEach((s) => {
              if (s && s.url)
                streams.push(s);
            });
          }
        });
      }
      console.log("[" + PROVIDER_NAME + "] ZinkCloud: returning " + streams.length + " streams");
      return streams;
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] ZinkCloud fatal: " + e.message);
    }
    return [];
  });
}
function resolveLinkStore(url, targetEpisode, label) {
  return __async(this, null, function* () {
    try {
      console.log("[" + PROVIDER_NAME + "] LinkStore: fetching " + url.substring(0, 80) + " targetEp=" + targetEpisode);
      const $ = yield fetchHtml(url, { headers: HEADERS });
      if (!$) {
        console.log("[" + PROVIDER_NAME + "] LinkStore: page fetch failed");
        return [];
      }
      const tasks = [];
      const isMovie = !targetEpisode;
      $("a.maxbutton, a.btn, a").each((i, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().toUpperCase();
        if (!href.startsWith("http") || text.includes("ZIP") || text.includes("ALL EPISODES"))
          return;
        if (isMovie) {
          const quality = parseQuality(text);
          console.log("[" + PROVIDER_NAME + "] LinkStore: movie link " + href.substring(0, 60) + " q=" + quality);
          if (href.includes("zinkcloud.net"))
            tasks.push(() => resolveZinkCloud(href, label, quality));
          else if (href.includes("hubcloud"))
            tasks.push(() => resolveHubCloud(href, label, quality));
          else if (href.includes("gdflix") || href.includes("gdlink"))
            tasks.push(() => resolveGDFlix(href, label, quality));
          return;
        }
        const epMatch = text.match(/EPISODE\s*-\s*(\d+)/i) || text.match(/EP\s*0*(\d+)/i);
        if (epMatch && parseInt(epMatch[1]) === Number(targetEpisode)) {
          const quality = parseQuality(text);
          console.log("[" + PROVIDER_NAME + "] LinkStore: matched episode " + targetEpisode + " q=" + quality);
          if (href.includes("zinkcloud.net"))
            tasks.push(() => resolveZinkCloud(href, label, quality));
          else if (href.includes("hubcloud"))
            tasks.push(() => resolveHubCloud(href, label, quality));
          else if (href.includes("gdflix") || href.includes("gdlink"))
            tasks.push(() => resolveGDFlix(href, label, quality));
        }
      });
      console.log("[" + PROVIDER_NAME + "] LinkStore: queued " + tasks.length + " tasks");
      return yield chunkAll(tasks, 2);
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] LinkStore error: " + e.message);
      return [];
    }
  });
}
function extractFromPage(pageUrl, label, isTv = false, targetSeason, targetEpisode) {
  return __async(this, null, function* () {
    try {
      console.log("[" + PROVIDER_NAME + "] extractFromPage: " + pageUrl.substring(0, 80) + " isTv=" + isTv + " S=" + targetSeason + " E=" + targetEpisode);
      const $ = yield fetchHtml(pageUrl, { headers: HEADERS });
      if (!$) {
        console.log("[" + PROVIDER_NAME + "] extractFromPage: no HTML");
        return [];
      }
      const collected = [];
      $("a.movie-simple-button, a.btn").each((i, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().toUpperCase();
        if (!href.startsWith("http") || text.includes("ZIP"))
          return;
        const quality = parseQuality(text);
        if (isTv) {
          let sNum = null;
          const sMatch = text.match(/SEASON\s*0*(\d+)/i);
          if (sMatch) {
            sNum = parseInt(sMatch[1]);
          } else {
            const parentHeader = $(el).closest("div, section, article").prevAll("h1,h2,h3,h4,strong,p").first().text().toUpperCase();
            const hm = parentHeader.match(/SEASON\s*(\d+)/i);
            if (hm)
              sNum = parseInt(hm[1]);
          }
          if (sNum === targetSeason || sNum === null) {
            collected.push({ href, text, quality });
          }
        } else {
          collected.push({ href, text, quality });
        }
      });
      console.log("[" + PROVIDER_NAME + "] extractFromPage: collected " + collected.length + " buttons");
      const tasks = collected.map((btn) => () => {
        if (btn.href.includes("linkstore"))
          return resolveLinkStore(btn.href, targetEpisode, label + (isTv ? " S" + targetSeason : ""));
        if (btn.href.includes("zinkcloud.net"))
          return resolveZinkCloud(btn.href, label, btn.quality);
        if (btn.href.includes("hubcloud"))
          return resolveHubCloud(btn.href, label, btn.quality);
        if (btn.href.includes("gdflix") || btn.href.includes("gdlink"))
          return resolveGDFlix(btn.href, label, btn.quality);
        return Promise.resolve([]);
      });
      const streams = yield chunkAll(tasks, 3);
      console.log("[" + PROVIDER_NAME + "] extractFromPage: total " + streams.length + " streams from page");
      return streams;
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] extractFromPage error: " + e.message);
      return [];
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    visitedUrls = /* @__PURE__ */ new Set();
    processedFiles = /* @__PURE__ */ new Set();
    try {
      const info = yield getTMDBInfo(tmdbId, mediaType);
      if (!info.title) {
        console.log("[" + PROVIDER_NAME + "] No title resolved, returning []");
        return [];
      }
      const isTv = mediaType === "tv" || mediaType === "series";
      console.log("[" + PROVIDER_NAME + "] Request: ID=" + tmdbId + " Type=" + mediaType + " S=" + season + " E=" + episode);
      console.log("[" + PROVIDER_NAME + '] Resolved: "' + info.title + '" (' + (info.year || "N/A") + ") IMDB=" + (info.imdbId || "none"));
      console.log("[" + PROVIDER_NAME + "] isTv=" + isTv);
      const safeSeason = season != null ? Number(season) : null;
      const safeEpisode = episode != null ? Number(episode) : null;
      const embedPromise = info.imdbId ? resolveEmbed(info.imdbId, info.title, isTv, safeSeason, safeEpisode) : Promise.resolve([]);
      console.log("[" + PROVIDER_NAME + "] Searching site for: " + info.title);
      const searchResults = yield searchSite(info.title, info.year);
      let bestMatch = null, bestScore = 0;
      for (const r of searchResults) {
        const score = similarity(info.title, r.title, info.year);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = r;
        }
      }
      console.log("[" + PROVIDER_NAME + "] Best match: " + (bestMatch ? bestMatch.title + " (score=" + bestScore.toFixed(2) + ")" : "NONE"));
      let pageStreams = [];
      if (bestMatch && bestScore > 0.4) {
        console.log("[" + PROVIDER_NAME + "] Extracting from page: " + bestMatch.href);
        pageStreams = yield extractFromPage(bestMatch.href, info.title, isTv, safeSeason, safeEpisode);
      }
      const embedStreams = yield embedPromise;
      console.log("[" + PROVIDER_NAME + "] Embed streams: " + embedStreams.length + ", Page streams: " + pageStreams.length);
      const result = dedupe([...embedStreams, ...pageStreams]);
      console.log("[" + PROVIDER_NAME + "] Total unique streams: " + result.length);
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
