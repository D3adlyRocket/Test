"use strict";

var PROVIDER = "Dizipal";
var BASE = "https://dizipal2063.com";
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

function fixUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  return BASE + url;
}

function extractM3U8(html) {
  var m = html.match(/["']([^"']+\.m3u8[^"']*)["']/);
  return m ? m[1] : null;
}

function extractCfg(html) {
  var m = html.match(/data-cfg="([^"]+)"/);
  return m ? m[1] : null;
}

function resolvePlayer(cfg, referer) {
  return fetch(BASE + "/ajax-player-config", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": referer
    },
    body: "cfg=" + encodeURIComponent(cfg)
  })
  .then(r => r.text())
  .then(t => {
    try {
      var json = JSON.parse(t);
      var url = json?.config?.url || json?.url;
      if (!url) return null;
      return url.replace(/\\\//g, "/");
    } catch(e){ return null; }
  });
}

function resolvePage(url) {
  return fetchText(url).then(html => {

    // direct m3u8
    var m3u8 = extractM3U8(html);
    if (m3u8) {
      return { url: m3u8, quality: "Auto", headers: { Referer: url } };
    }

    // cfg method
    var cfg = extractCfg(html);
    if (cfg) {
      return resolvePlayer(cfg, url).then(embed => {
        if (!embed) return null;
        return fetchText(embed, { Referer: url }).then(ehtml => {
          var m3 = extractM3U8(ehtml);
          if (!m3) return null;
          return { url: m3, quality: "Auto", headers: { Referer: embed } };
        });
      });
    }

    return null;
  });
}

function search(title) {
  return fetchJson(BASE + "/ajax-search?q=" + encodeURIComponent(title), {
    "X-Requested-With": "XMLHttpRequest",
    "Referer": BASE
  }).then(res => {
    if (!res) return [];
    return res.results || res.data || [];
  });
}

function getEpisodeUrl(seriesUrl, season, episode) {
  return fetchText(seriesUrl).then(html => {
    var re = new RegExp(`${season}\\.\\s*Sezon\\s*${episode}\\.\\s*B`, "i");
    var match = html.match(/href="([^"]+\/bolum\/[^"]+)"/g);

    if (!match) return null;

    for (var i = 0; i < match.length; i++) {
      var url = match[i].match(/href="([^"]+)"/)[1];
      if (url.includes(`-${season}-sezon-${episode}-bolum`)) {
        return fixUrl(url);
      }
    }
    return null;
  });
}

function getStreams(tmdbId, type, season, episode) {

  return fetch("https://api.themoviedb.org/3/" + (type === "movie" ? "movie" : "tv") + "/" + tmdbId + "?api_key=500330721680edb6d5f7f12ba7cd9023")
  .then(r => r.json())
  .then(data => {

    var title = data.title || data.name;
    if (!title) return [];

    return search(title).then(results => {

      if (!results.length) return [];

      var match = results[0];
      var url = fixUrl(match.url);

      if (type !== "movie") {
        return getEpisodeUrl(url, season, episode).then(epUrl => {
          if (!epUrl) return [];
          return resolvePage(epUrl);
        });
      }

      return resolvePage(url);
    });
  })
  .then(stream => {
    if (!stream) return [];
    return [{
      name: PROVIDER,
      url: stream.url,
      quality: stream.quality,
      headers: stream.headers
    }];
  })
  .catch(() => []);
}

if (typeof module !== "undefined") {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
