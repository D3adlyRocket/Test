/*
 * 4Khdhub Provider for Nuvio
 * ========================================
 * Version: 5.0.0
 * - Added: ⏱️ Duration & Movie Year support
 * - Layout: 🎬 Identity Line | Line 2 Technical Specs
 */
var cheerio = require("cheerio-without-node-native");

var PROVIDER_NAME = "4khdhub";
var DOMAINS_URL = "https://raw.githubusercontent.com/Xyr0nX/NGEX/refs/heads/main/manifest.json";
var DEFAULT_MAIN_URL = "https://4khdhub.dad";
var TMDB_API_KEY = "f3d757824f08ea2cff45eb8f47ca3a1e"; // Swapped to your key for consistency
var DEBUG = false;

var FALLBACK_DOMAINS = [DEFAULT_MAIN_URL];

var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Connection": "keep-alive"
};

// ─── NEW TMDB HELPERS ───────────────────────────────────────

function getTmdbMetadata(tmdbId, type) {
  var url = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=en-US';
  return fetchJson(url).then(function(data) {
      var date = data.release_date || data.first_air_date || "";
      return {
        title: data.title || data.name || "4khdhub",
        original: data.original_name || data.original_title || "",
        year: date ? date.split('-')[0] : "",
        duration: (type === 'movie' && data.runtime) ? data.runtime + ' min' : (type === 'tv' && data.episode_run_time && data.episode_run_time.length > 0 ? data.episode_run_time[0] + ' min' : "")
      };
  }).catch(function() { return { title: "4khdhub", year: "", duration: "" }; });
}

function getEpMetadata(tmdbId, season, episode) {
  if (!tmdbId || !season || !episode) return Promise.resolve(null);
  var url = 'https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '/episode/' + episode + '?api_key=' + TMDB_API_KEY + '&language=en-US';
  return fetchJson(url).then(function(data) {
      return { name: data.name || null, duration: data.runtime ? data.runtime + ' min' : null };
  }).catch(function() { return null; });
}

// ─── UPDATED TITLE BUILDER ──────────────────────────────────

function buildMeta(meta, res, langHint, size, tech, season, episode, epMeta) {
    var qIcon = (res.indexOf('2160') !== -1 || res.indexOf('4K') !== -1) ? '💎' : '📺';
    
    // Lang Logic
    var lang = inferLang(langHint);
    var lIcon = '🌍';
    if (lang.indexOf('Hindi') !== -1) lIcon = '🇮🇳';
    if (lang === 'English' || lang === 'EN') lIcon = '🇺🇸';

    // Line 1: Identity
    var line1 = '🎬 ';
    if (season && episode) {
        line1 += 'S' + season + ' E' + episode + (epMeta && epMeta.name ? ' - ' + epMeta.name : '') + ' | ' + meta.title;
    } else {
        line1 += meta.title + (meta.year ? ' - ' + meta.year : '');
    }

    // Line 2: Specs
    var columns = [
        qIcon + ' ' + res,
        lIcon + ' ' + lang,
        '🎞️ ' + tech
    ];
    if (size) columns.push('💾 ' + size);
    
    var finalDur = (epMeta && epMeta.duration) ? epMeta.duration : meta.duration;
    if (finalDur) columns.push('⏱️ ' + finalDur);

    return {
        name: PROVIDER_NAME + ' | ' + res + (size ? ' | ' + size : ''),
        title: line1 + '\n' + columns.join(' | ')
    };
}

// ─── HELPER FUNCTIONS (Preserved) ───────────────────────────

function fetchJson(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    headers: assign(DEFAULT_HEADERS, options.headers || {}),
  }).then(function(res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

function fetchText(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    headers: assign(DEFAULT_HEADERS, options.headers || {}),
  }).then(function(res) { return res.text(); });
}

function fetchResponse(url, options) {
    return fetch(url, options);
}

function assign(target, source) {
  var out = {};
  for (var k in target) out[k] = target[k];
  for (var k in source) out[k] = source[k];
  return out;
}

function normalizeTitle(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function levenshteinDistance(s, t) {
  if (s === t) return 0;
  var n = s.length, m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;
  var d = [];
  var i, j, cost;
  for (i = 0; i <= n; i += 1) { d[i] = []; d[i][0] = i; }
  for (j = 0; j <= m; j += 1) d[0][j] = j;
  for (i = 1; i <= n; i += 1) {
    for (j = 1; j <= m; j += 1) {
      cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1;
      d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+cost);
    }
  }
  return d[n][m];
}

function inferLang(text) {
  var t = String(text || "").toLowerCase();
  var langs = [];
  if (t.indexOf("hindi") !== -1) langs.push("Hindi");
  if (t.indexOf("tamil") !== -1) langs.push("Tamil");
  if (t.indexOf("telugu") !== -1) langs.push("Telugu");
  if (t.indexOf("english") !== -1 || /\beng\b/.test(t)) langs.push("English");
  if (langs.length > 1) return "Multi Audio";
  return langs[0] || "EN";
}

function cleanTech(title) {
  var allowed = ["WEB-DL","WEBRIP","BLURAY","HDR","HEVC","H265","DTS","ATMOS","DD5.1"];
  var parts = String(title).toUpperCase().split(/[ ._()\[\]+-]+/);
  var out = [];
  for (var i = 0; i < parts.length; i++) {
      if (allowed.indexOf(parts[i]) !== -1) out.push(parts[i]);
  }
  return out.length ? out.join(" ") : "WEB-DL";
}

function parseBytes(val) {
  var match = String(val).match(/^([0-9.]+)\s*([a-zA-Z]+)$/);
  if (!match) return 0;
  var num = parseFloat(match[1]);
  var unit = match[2].toLowerCase();
  if (unit.indexOf("g") === 0) return num * 1024 * 1024 * 1024;
  if (unit.indexOf("m") === 0) return num * 1024 * 1024;
  return num;
}

function formatBytes(val) {
  var k = 1024;
  var sizes = ["B", "KB", "MB", "GB"];
  var i = Math.floor(Math.log(val) / Math.log(k));
  return parseFloat((val / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function detectQualityFromSources(parts) {
  var text = parts.join(" ").toLowerCase();
  var m = text.match(/\b(2160p|1080p|720p|480p)\b/);
  return m ? m[1] : "HD";
}

function fixUrl(url, baseUrl) {
  if (!url) return "";
  if (url.indexOf("http") === 0) return url;
  try { return new URL(url, baseUrl).toString(); } catch(e) { return url; }
}

function hostConfidence(url) {
  var u = url.toLowerCase();
  if (u.indexOf("lotuscdn") !== -1 || u.indexOf("yummy.monster") !== -1) return 95;
  if (u.indexOf(".workers.dev") !== -1) return 25;
  if (u.indexOf("googleusercontent") !== -1) return 10;
  return 5;
}

function uniqueBy(list, keyFn) {
  var seen = {};
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var key = keyFn(list[i]);
    if (!seen[key]) { seen[key] = 1; out.push(list[i]); }
  }
  return out;
}

// ─── CORE LOGIC (Modified to pass Meta) ─────────────────────

function buildStream(meta, label, url, season, episode, epMeta) {
  var finalUrl = String(url || "").trim();
  var quality = detectQualityFromSources([label, finalUrl]);
  var size = label.match(/\b(\d+(?:\.\d+)?)\s*(GB|MB)\b/i);
  size = size ? size[0] : "";
  var tech = cleanTech(label + " " + finalUrl);

  var ui = buildMeta(meta, quality, label, size, tech, season, episode, epMeta);

  var streamHeaders = {};
  if (finalUrl.indexOf(".workers.dev") !== -1) {
      streamHeaders = { "Referer": "https://gamerxyt.com/" };
  }

  return {
    name: ui.name,
    title: ui.title,
    url: finalUrl,
    quality: quality,
    headers: Object.keys(streamHeaders).length ? streamHeaders : undefined
  };
}

function getMainUrl() {
    return fetchJson(DOMAINS_URL).then(function(json) {
        return json["4khdhub"] || DEFAULT_MAIN_URL;
    }).catch(function() { return DEFAULT_MAIN_URL; });
}

function searchContent(mainUrl, query, year) {
  var searchQuery = query + (year ? " " + year : "");
  var searchUrl = mainUrl + "/?s=" + encodeURIComponent(searchQuery);
  return fetchText(searchUrl).then(function(html) {
      var $ = cheerio.load(html);
      var link = $("a.movie-card, .result-item a").first().attr("href");
      return link ? fixUrl(link, mainUrl) : null;
  });
}

function resolveHubcloud(url, meta, season, episode, epMeta) {
    return fetchText(url).then(function(html) {
        var $ = cheerio.load(html);
        var downloadUrl = $("#download, a[href*='hubcloud.php']").attr("href");
        if (!downloadUrl) return [];
        
        return fetchText(fixUrl(downloadUrl, url)).then(function(pageHtml) {
            var $$ = cheerio.load(pageHtml);
            var streams = [];
            $$("a.btn[href]").each(function(_, el) {
                var link = $$(el).attr("href");
                if (link && link.indexOf('http') === 0) {
                    streams.push(buildStream(meta, $$(el).text(), link, season, episode, epMeta));
                }
            });
            return streams;
        });
    }).catch(function() { return []; });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return Promise.all([
      getTmdbMetadata(tmdbId, mediaType),
      mediaType === 'tv' ? getEpMetadata(tmdbId, season, episode) : Promise.resolve(null),
      getMainUrl()
  ]).then(function(results) {
      var meta = results[0];
      var epMeta = results[1];
      var mainUrl = results[2];

      return searchContent(mainUrl, meta.title, meta.year).then(function(contentUrl) {
          if (!contentUrl) return [];

          return fetchText(contentUrl).then(function(html) {
              var $ = cheerio.load(html);
              var links = [];
              $("a[href*='hubcloud']").each(function(_, el) {
                  links.push($(el).attr("href"));
              });

              return Promise.all(links.map(function(l) {
                  return resolveHubcloud(l, meta, season, episode, epMeta);
              })).then(function(groups) {
                  var all = [];
                  groups.forEach(function(g) { all = all.concat(g); });
                  all = uniqueBy(all, function(s) { return s.url; });
                  return all.sort(function(a, b) { return hostConfidence(b.url) - hostConfidence(a.url); });
              });
          });
      });
  }).catch(function() { return []; });
}

module.exports = { getStreams: getStreams };
