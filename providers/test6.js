/*
 * PikaHD Provider for Nuvio - Final D-dot.js version (2026)
 * Based on 4KHDHub + new.pikahd.co structure
 * Now follows proxy links (kmhd.eu) and extracts real streams
 */

var cheerio = require("cheerio-without-node-native");

var DEFAULT_MAIN_URL = "https://new.pikahd.co";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DEBUG = false;

var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
};

function dbg() {
  if (!DEBUG) return;
  console.log.apply(console, arguments);
}

function fetchText(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    redirect: options.redirect || "follow",
    headers: assign(DEFAULT_HEADERS, options.headers || {})
  }).then(res => {
    if (!res.ok && res.status !== 301 && res.status !== 302) throw new Error("HTTP " + res.status);
    return res.text();
  });
}

function assign(target, source) {
  target = target || {};
  source = source || {};
  var out = {};
  for (var k in target) out[k] = target[k];
  for (var k in source) out[k] = source[k];
  return out;
}

function fixUrl(url, baseUrl) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  try { return new URL(url, baseUrl).toString(); } catch(e) { return url; }
}

function normalizeTitle(t) {
  return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function levenshteinDistance(a, b) {
  a = normalizeTitle(a); b = normalizeTitle(b);
  if (a === b) return 0;
  var n = a.length, m = b.length;
  var d = [];
  for (let i = 0; i <= n; i++) d[i] = [];
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[n][m];
}

function uniqueBy(list, keyFn) {
  var seen = {}, out = [];
  for (var i = 0; i < list.length; i++) {
    var key = keyFn(list[i]);
    if (seen[key]) continue;
    seen[key] = 1;
    out.push(list[i]);
  }
  return out;
}

function isPlayableMediaUrl(url) {
  var u = String(url || "").toLowerCase();
  return /\.(mkv|mp4|m3u8)(\?|$)/.test(u) || u.includes("player") || u.includes("embed");
}

function hostConfidence(url) {
  var u = String(url || "").toLowerCase();
  if (u.includes("player")) return 95;
  if (u.includes("embed")) return 90;
  return 50;
}

function getMainUrl() {
  return Promise.resolve(DEFAULT_MAIN_URL);
}

function getTmdbNames(tmdbId, mediaType) {
  var type = mediaType === "movie" ? "movie" : "tv";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
  return fetchJson(url).then(data => ({
    title: data.title || data.name || "",
    year: (data.release_date || data.first_air_date || "").split("-")[0] || ""
  })).catch(() => ({ title: "", year: "" }));
}

function fetchJson(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    redirect: options.redirect || "follow",
    headers: assign(DEFAULT_HEADERS, options.headers || {})
  }).then(res => {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

function searchContent(query, mediaType, year) {
  return getMainUrl().then(mainUrl => {
    var searchUrl = mainUrl + "/?s=" + encodeURIComponent(query);
    return fetchText(searchUrl).then(html => {
      var $ = cheerio.load(html);
      var results = [];
      $("a[href]").each((_, el) => {
        var href = fixUrl($(el).attr("href"), mainUrl);
        if (!href || !href.includes(mainUrl)) return;
        var title = $(el).text().trim();
        if (!title) return;
        var combined = (title + " " + href).toLowerCase();
        var itemYear = combined.match(/\b(19|20)\d{2}\b/);
        var distance = levenshteinDistance(normalizeTitle(title), normalizeTitle(query));
        results.push({ href, title, year: itemYear ? parseInt(itemYear[0]) : 0, distance });
      });
      results.sort((a,b) => a.distance - b.distance);
      return results[0] ? results[0].href : null;
    });
  });
}

function extractFromPage(contentUrl) {
  return fetchText(contentUrl).then(html => {
    var $ = cheerio.load(html);
    var links = [];

    // Extract proxy links like https://links.kmhd.eu/play?id=...
    $("a[href]").each((_, el) => {
      var href = fixUrl($(el).attr("href"), contentUrl);
      var lower = href.toLowerCase();
      if (lower.includes("kmhd.eu") && (lower.includes("play?id") || lower.includes("file/"))) {
        links.push({ url: href, label: "PikaHD Proxy Link" });
      }
    });

    // Fallback full scan for any embed/player
    if (links.length === 0) {
      $("iframe[src], iframe[data-src]").each((_, el) => {
        var src = $(el).attr("src") || $(el).attr("data-src");
        if (src && (src.includes("player") || src.includes("embed"))) {
          links.push({ url: fixUrl(src, contentUrl), label: "PikaHD Video Link" });
        }
      });
    }

    if (links.length === 0) return [];

    // Resolve each proxy link (this is the key step)
    return Promise.all(links.map(item => resolveProxyLink(item.url, item.label)));
  }).then(groups => {
    var streams = [];
    for (var i = 0; i < groups.length; i++) streams = streams.concat(groups[i]);
    streams = uniqueBy(streams, s => s.url);
    return streams;
  });
}

function resolveProxyLink(proxyUrl, label) {
  return fetchText(proxyUrl).then(html => {
    var $ = cheerio.load(html);
    var videoUrl = "";

    // Look for actual video in the proxy page
    $("iframe[src], iframe[data-src]").each((_, el) => {
      var src = $(el).attr("src") || $(el).attr("data-src");
      if (src && (src.includes("player") || src.includes("embed") || src.includes(".mp4"))) {
        videoUrl = fixUrl(src, proxyUrl);
      }
    });

    if (videoUrl) {
      return buildStream(label, videoUrl, "1080p");
    }
    return [];
  }).catch(() => []);
}

function buildStream(label, url, quality) {
  return {
    name: "PikaHD Provider",
    title: "PikaHD Stream",
    url: url,
    quality: quality
  };
}

function getStreams(tmdbId, mediaType, season, episode) {
  return getTmdbNames(tmdbId, mediaType).then(tmdbData => {
    return searchContent(tmdbData.title, mediaType, tmdbData.year).then(contentUrl => {
      if (!contentUrl) return [];
      return extractFromPage(contentUrl);
    });
  }).catch(() => []);
}

module.exports = { getStreams };  target = target || {};
  source = source || {};
  var out = {};
  for (var k in target) out[k] = target[k];
  for (var k in source) out[k] = source[k];
  return out;
}

function fixUrl(url, baseUrl) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  try { return new URL(url, baseUrl).toString(); } catch(e) { return url; }
}

function normalizeTitle(t) {
  return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function levenshteinDistance(a, b) {
  a = normalizeTitle(a); b = normalizeTitle(b);
  if (a === b) return 0;
  var n = a.length, m = b.length;
  var d = [];
  for (let i = 0; i <= n; i++) d[i] = [];
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[n][m];
}

function uniqueBy(list, keyFn) {
  var seen = {}, out = [];
  for (var i = 0; i < list.length; i++) {
    var key = keyFn(list[i]);
    if (seen[key]) continue;
    seen[key] = 1;
    out.push(list[i]);
  }
  return out;
}

function isPlayableMediaUrl(url) {
  var u = String(url || "").toLowerCase();
  return /\.(mkv|mp4|m3u8)(\?|$)/.test(u) || u.includes("player") || u.includes("embed");
}

function hostConfidence(url) {
  var u = String(url || "").toLowerCase();
  if (u.includes("player")) return 95;
  if (u.includes("embed")) return 90;
  return 50;
}

function getMainUrl() {
  return Promise.resolve(DEFAULT_MAIN_URL);
}

function getTmdbNames(tmdbId, mediaType) {
  var type = mediaType === "movie" ? "movie" : "tv";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
  return fetchJson(url).then(data => ({
    title: data.title || data.name || "",
    year: (data.release_date || data.first_air_date || "").split("-")[0] || ""
  })).catch(() => ({ title: "", year: "" }));
}

function fetchJson(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    redirect: options.redirect || "follow",
    headers: assign(DEFAULT_HEADERS, options.headers || {})
  }).then(res => {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

function searchContent(query, mediaType, year) {
  return getMainUrl().then(mainUrl => {
    var searchUrl = mainUrl + "/?s=" + encodeURIComponent(query);
    return fetchText(searchUrl).then(html => {
      var $ = cheerio.load(html);
      var results = [];
      $("a[href]").each((_, el) => {
        var href = fixUrl($(el).attr("href"), mainUrl);
        if (!href) return;
        var title = $(el).text().trim();
        if (!title) return;
        var combined = (title + " " + href).toLowerCase();
        var itemYear = combined.match(/\b(19|20)\d{2}\b/);
        var distance = levenshteinDistance(normalizeTitle(title), normalizeTitle(query));
        results.push({ href, title, year: itemYear ? parseInt(itemYear[0]) : 0, distance });
      });
      results.sort((a,b) => a.distance - b.distance);
      return results[0] ? results[0].href : null;
    });
  });
}

function collectLinksFromIframe(html) {
  var $ = cheerio.load(html);
  var links = [];
  $("iframe[src], iframe[data-src]").each((_, el) => {
    var src = $(el).attr("src") || $(el).attr("data-src");
    if (!src) return;
    links.push({ url: src, label: "PikaHD Video Link" });
  });
  return links;
}

function extractFromPage(contentUrl, mediaType) {
  return fetchText(contentUrl).then(html => {
    var links = collectLinksFromIframe(html);
    if (!links.length) return [];

    return Promise.all(links.map(item => {
      var quality = "1080p";
      return [buildStream(item.label, item.url, quality)];
    })).then(groups => {
      var streams = [];
      for (var i = 0; i < groups.length; i++) streams = streams.concat(groups[i]);
      streams = uniqueBy(streams, s => s.url);
      return streams;
    });
  });
}

function buildStream(label, url, quality) {
  return {
    name: "PikaHD Provider",
    title: "PikaHD Stream",
    url: url,
    quality: quality
  };
}

function getStreams(tmdbId, mediaType, season, episode) {
  return getTmdbNames(tmdbId, mediaType).then(tmdbData => {
    return searchContent(tmdbData.title, mediaType, tmdbData.year).then(contentUrl => {
      if (!contentUrl) return [];
      return extractFromPage(contentUrl, mediaType);
    });
  }).catch(() => []);
}

module.exports = { getStreams };}

function fetchJson(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    redirect: options.redirect || "follow",
    headers: assign(DEFAULT_HEADERS, options.headers || {})
  }).then(res => {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

function assign(target, source) {
  target = target || {};
  source = source || {};
  var out = {};
  for (var k in target) out[k] = target[k];
  for (var k in source) out[k] = source[k];
  return out;
}

function fixUrl(url, baseUrl) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  try { return new URL(url, baseUrl).toString(); } catch(e) { return url; }
}

function normalizeTitle(t) {
  return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function levenshteinDistance(a, b) {
  a = normalizeTitle(a); b = normalizeTitle(b);
  if (a === b) return 0;
  var n = a.length, m = b.length;
  var d = [];
  for (let i = 0; i <= n; i++) d[i] = [];
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[n][m];
}

function uniqueBy(list, keyFn) {
  var seen = {}, out = [];
  for (var i = 0; i < list.length; i++) {
    var key = keyFn(list[i]);
    if (seen[key]) continue;
    seen[key] = 1;
    out.push(list[i]);
  }
  return out;
}

function isPlayableMediaUrl(url) {
  var u = String(url || "").toLowerCase();
  return /\.(mkv|mp4|m3u8)(\?|$)/.test(u) || u.includes(".workers.dev") || u.includes(".r2.dev") || u.includes("googleusercontent.com");
}

function hostConfidence(url) {
  var u = String(url || "").toLowerCase();
  if (u.includes(".workers.dev")) return 95;
  if (u.includes(".r2.dev")) return 90;
  return 50;
}

function getMainUrl() {
  return Promise.resolve(DEFAULT_MAIN_URL);
}

function getTmdbNames(tmdbId, mediaType) {
  var type = mediaType === "movie" ? "movie" : "tv";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
  return fetchJson(url).then(data => ({
    title: data.title || data.name || "",
    original: data.original_title || data.original_name || "",
    year: (data.release_date || data.first_air_date || "").split("-")[0] || ""
  })).catch(() => ({ title: "", original: "", year: "" }));
}

function searchContent(query, mediaType, year) {
  return getMainUrl().then(mainUrl => {
    var searchUrl = mainUrl + "/?s=" + encodeURIComponent(query);
    return fetchText(searchUrl).then(html => {
      var $ = cheerio.load(html);
      var results = [];
      $("a[href]").each((_, el) => {
        var href = fixUrl($(el).attr("href"), mainUrl);
        if (!href || !href.includes(mainUrl)) return;
        var title = $(el).text().trim();
        if (!title) return;
        var combined = (title + " " + href).toLowerCase();
        var itemYear = combined.match(/\b(19|20)\d{2}\b/);
        var distance = levenshteinDistance(normalizeTitle(title), normalizeTitle(query));
        results.push({ href, title, year: itemYear ? parseInt(itemYear[0]) : 0, distance });
      });
      results.sort((a,b) => a.distance - b.distance);
      return results[0] ? results[0].href : null;
    });
  });
}

function collectMovieLinks($, pageUrl) {
  var links = [];
  $("a[href]").each((_, el) => {
    var href = fixUrl($(el).attr("href"), pageUrl);
    var lower = href.toLowerCase();
    if (lower.includes("player") || lower.includes("embed") || lower.includes(".mp4") || lower.includes(".mkv")) {
      links.push({ url: href, label: "PikaHD Link" });
    }
  });
  return links;
}

function extractFromPage(contentUrl, mediaType, season, episode) {
  return fetchText(contentUrl).then(html => {
    var $ = cheerio.load(html);
    var links = collectMovieLinks($, contentUrl);
    return Promise.all(links.map(item => {
      return [buildStream(item.label, item.url, "1080p", undefined)];
    })).then(groups => {
      var streams = [];
      for (var i = 0; i < groups.length; i++) streams = streams.concat(groups[i]);
      streams = uniqueBy(streams, s => s.url);
      return streams;
    });
  });
}

function buildStream(label, url, quality, headers) {
  return {
    name: "PikaHD Provider",
    title: "PikaHD Stream",
    url: url,
    quality: quality,
    headers: headers
  };
}

function getStreams(tmdbId, mediaType, season, episode) {
  return getTmdbNames(tmdbId, mediaType).then(tmdbData => {
    var epTitle = "";
    if (mediaType === "tv" && season && episode) {
      // Simplified TMDB episode name call (full version can be added later)
      epTitle = "Episode " + episode;
    }
    return searchContent(tmdbData.title, mediaType, tmdbData.year).then(contentUrl => {
      if (!contentUrl) return [];
      var meta = { title: tmdbData.title, year: tmdbData.year, season, episode, episodeTitle: epTitle };
      return extractFromPage(contentUrl, mediaType, season, episode, meta);
    });
  }).catch(() => []);
}

module.exports = { getStreams };                    streams.push({
                        name: "PikaHD Provider",
                        title: `Mirror ${streams.length + 1}`,
                        url: url
                    });
                }
            }

            return streams.length > 0 ? streams : [];
        })
        .catch(() => []);
}

module.exports = { getStreams };                url = url.replace(/&amp;/g, '&');

                if (url.includes('player') || url.includes('embed') || url.includes('.mp4')) {
                    streams.push({
                        name: "PikaHD Provider",
                        title: `Mirror ${streams.length + 1}`,
                        url: url
                    });
                }
            }

            return streams.length > 0 ? streams : [];
        })
        .catch(() => []);
}

module.exports = { getStreams };
