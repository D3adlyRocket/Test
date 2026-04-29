"use strict";

var PROVIDER = "[Dizipal]";
var DOMAINS = [
  "https://dizipal2063.com",
  "https://dizipal2064.com",
  "https://dizipal2062.com"
];

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

function fetchText(url, headers) {
  return fetch(url, {
    headers: Object.assign({ "User-Agent": UA }, headers || {}),
    redirect: "follow"
  }).then(r => r.text());
}

function fetchJson(url, headers) {
  return fetchText(url, headers).then(t => {
    try { return JSON.parse(t); } catch(e){ return null; }
  });
}

function fixUrl(url, base) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  return base + url;
}

function resolveDomain() {
  return Promise.resolve(DOMAINS[0]); // 🔥 Avoid HEAD completely
}

function extractM3U8(html) {
  var m = html.match(/["']([^"']+\.m3u8[^"']*)["']/);
  return m ? m[1] : null;
}

function extractIframe(html) {
  var m = html.match(/<iframe[^>]+src="([^"]+)"/i);
  return m ? m[1] : null;
}

function resolveEmbed(url, referer) {
  return fetchText(url, { Referer: referer }).then(html => {
    var m3u8 = extractM3U8(html);
    if (m3u8) {
      return {
        url: m3u8,
        quality: "Auto",
        headers: { Referer: url }
      };
    }
    return null;
  });
}

function resolvePage(url, base) {
  return fetchText(url).then(html => {

    var m3u8 = extractM3U8(html);
    if (m3u8) {
      return {
        url: m3u8,
        quality: "Auto",
        headers: { Referer: url }
      };
    }

    var iframe = extractIframe(html);
    if (iframe) {
      return resolveEmbed(fixUrl(iframe, base), url);
    }

    return null;
  });
}

function search(title, base) {
  var url = base + "/ajax-search?q=" + encodeURIComponent(title);
  return fetchJson(url, {
    "X-Requested-With": "XMLHttpRequest",
    Referer: base
  });
}

function getStreams(tmdbId, type, season, episode) {
  return resolveDomain().then(base => {

    // 🔥 Minimal TMDB usage (TV safe)
    return fetch("https://api.themoviedb.org/3/" + (type === "movie" ? "movie" : "tv") + "/" + tmdbId + "?api_key=500330721680edb6d5f7f12ba7cd9023")
    .then(r => r.json())
    .then(data => {

      var title = data.title || data.name;
      if (!title) return [];

      return search(title, base).then(res => {
        if (!res || !res.results || !res.results.length) return [];

        var match = res.results[0];
        var url = fixUrl(match.url, base);

        return resolvePage(url, base).then(stream => {
          if (!stream) return [];

          return [{
            name: "Dizipal",
            url: stream.url,
            quality: stream.quality,
            headers: stream.headers
          }];
        });
      });
    });

  }).catch(() => []);
}

if (typeof module !== "undefined") {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
