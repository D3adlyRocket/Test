"use strict";

var cheerio = require("cheerio-without-node-native");

var TMDB_API_KEY = "1b3113663c9004682ed61086cf967c44";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";

var MAIN_URL = "https://new1.movies4u.style";
var M4UPLAY_BASE = "https://m4uplay.store";

var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Referer": MAIN_URL
};

//
// ✅ FIXED FETCH (TV SAFE - NO AbortController)
//
function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error("Timeout"));
      }
    }, timeout);

    fetch(url, {
      ...options,
      headers: {
        ...HEADERS,
        ...(options.headers || {})
      }
    })
      .then(res => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(res);
        }
      })
      .catch(err => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

//
// ---------------- SEARCH ----------------
//
async function searchMovies(query) {
  try {
    const response = await fetchWithTimeout(`${MAIN_URL}/?s=${encodeURIComponent(query)}`);
    if (!response || !response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);

    const results = [];
    $("h3.entry-title a").each((_, el) => {
      const title = $(el).text().trim();
      const url = $(el).attr("href");
      if (title && url) results.push({ title, url });
    });

    return results;
  } catch {
    return [];
  }
}

//
// ---------------- WATCH LINKS ----------------
//
async function extractWatchLinks(movieUrl) {
  try {
    const response = await fetchWithTimeout(movieUrl);
    if (!response || !response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);

    const watchLinks = [];

    $("a.btn.btn-zip").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();

      if (href && href.includes("m4uplay")) {
        watchLinks.push({
          url: href,
          quality:
            text.includes("1080p") ? "1080p" :
            text.includes("720p") ? "720p" :
            text.includes("480p") ? "480p" :
            text.includes("4K") ? "4K" : "Unknown",
          label: text
        });
      }
    });

    return watchLinks;
  } catch {
    return [];
  }
}

//
// ---------------- UNPACK (UNCHANGED) ----------------
//
function unpack(p, a, c, k) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
    }
  }
  return p;
}

//
// ---------------- HLS RESOLVER ----------------
//
async function resolveHlsPlaylist(masterUrl) {
  const result = {
    variants: [],
    isMaster: false
  };

  try {
    const response = await fetchWithTimeout(masterUrl, {
      headers: {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": M4UPLAY_BASE,
        "Origin": M4UPLAY_BASE
      }
    });

    if (!response || !response.ok) return result;

    const content = await response.text();

    if (!content.includes("#EXTM3U")) return result;

    if (content.includes("#EXT-X-STREAM-INF")) {
      result.isMaster = true;
    }

    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes("#EXT-X-STREAM-INF")) {
        let quality = "Unknown";

        const match = line.match(/RESOLUTION=\d+x(\d+)/);
        if (match) {
          const h = parseInt(match[1]);
          if (h >= 2160) quality = "4K";
          else if (h >= 1080) quality = "1080p";
          else if (h >= 720) quality = "720p";
          else if (h >= 480) quality = "480p";
        }

        let next = lines[i + 1]?.trim();

        if (next && !next.startsWith("http")) {
          const base = new URL(masterUrl);
          next = new URL(next, base).href;
        }

        if (next) {
          result.variants.push({ url: next, quality });
        }
      }
    }

    return result;
  } catch {
    return result;
  }
}

//
// ---------------- EXTRACT ----------------
//
async function extractFromM4UPlay(embedUrl) {
  try {
    const response = await fetchWithTimeout(embedUrl);
    if (!response || !response.ok) return [];

    const html = await response.text();

    let unpackedHtml = html;

    const packerMatch = html.match(/eval\(function\(p,a,c,k,e,d\).*?\)/s);

    if (packerMatch) {
      try {
        const args = packerMatch[0].match(/\((.*)\)/s)[1];
        const parts = args.split(",");
        unpackedHtml += unpack(
          parts[0].slice(1, -1),
          parseInt(parts[1]),
          parseInt(parts[2]),
          parts[3].slice(1, -1).split("|")
        );
      } catch {}
    }

    const hlsMatch = unpackedHtml.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);

    if (!hlsMatch) return [];

    const masterUrl = hlsMatch[0];

    const resolved = await resolveHlsPlaylist(masterUrl);

    // ✅ FIX FOR ANDROID TV
    if (resolved.isMaster && resolved.variants.length > 0) {
      return resolved.variants.map(v => ({
        url: v.url,
        quality: v.quality
      }));
    }

    return [{
      url: masterUrl,
      quality: "Unknown"
    }];

  } catch {
    return [];
  }
}

//
// ---------------- MAIN ----------------
//
async function getStreams(tmdbId, mediaType = "movie") {
  try {
    const res = await fetchWithTimeout(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (!res || !res.ok) return [];

    const data = await res.json();

    const title = data.title || data.name;
    const year = (data.release_date || data.first_air_date || "").split("-")[0];

    const searchResults = await searchMovies(title);
    if (!searchResults.length) return [];

    const watchLinks = await extractWatchLinks(searchResults[0].url);

    const streams = [];

    for (const link of watchLinks) {
      const extracted = await extractFromM4UPlay(link.url);

      for (const s of extracted) {
        streams.push({
          name: "Movies4u",
          title: `${title} (${year}) - ${s.quality}`,
          url: s.url,
          quality: s.quality,
          headers: {
            "Referer": M4UPLAY_BASE,
            "User-Agent": HEADERS["User-Agent"]
          }
        });
      }
    }

    return streams;

  } catch {
    return [];
  }
}

module.exports = { getStreams };
