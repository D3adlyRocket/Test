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


// ✅ FIXED FETCH (ONLY CHANGE)
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


// ---------------- SEARCH ----------------
async function searchMovies(query) {
  try {
    const res = await fetchWithTimeout(`${MAIN_URL}/?s=${encodeURIComponent(query)}`);

    if (!res || !res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);

    const results = [];

    $("h3.entry-title a").each((_, el) => {
      results.push({
        title: $(el).text().trim(),
        url: $(el).attr("href")
      });
    });

    return results;
  } catch {
    return [];
  }
}


// ---------------- WATCH LINKS ----------------
async function extractWatchLinks(url) {
  try {
    const res = await fetchWithTimeout(url);

    if (!res || !res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);

    const links = [];

    $("a.btn.btn-zip").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text();

      if (href && href.includes("m4uplay")) {
        links.push({
          url: href,
          quality: text.includes("1080") ? "1080p" :
                   text.includes("720") ? "720p" :
                   text.includes("4K") ? "4K" : "Unknown",
          label: text
        });
      }
    });

    return links;
  } catch {
    return [];
  }
}


// ---------------- UNPACK (RESTORED) ----------------
function unpack(p, a, c, k) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
    }
  }
  return p;
}


// ---------------- HLS ----------------
async function resolveHlsPlaylist(masterUrl) {
  const result = { variants: [], isMaster: false };

  try {
    const res = await fetchWithTimeout(masterUrl, {
      headers: {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": M4UPLAY_BASE,
        "Origin": M4UPLAY_BASE
      }
    });

    if (!res || !res.ok) return result;

    const text = await res.text();

    if (!text.includes("#EXTM3U")) return result;

    if (text.includes("#EXT-X-STREAM-INF")) {
      result.isMaster = true;
    }

    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("#EXT-X-STREAM-INF")) {

        let quality = "Unknown";
        const match = lines[i].match(/RESOLUTION=\d+x(\d+)/);

        if (match) {
          const h = parseInt(match[1]);
          if (h >= 1080) quality = "1080p";
          else if (h >= 720) quality = "720p";
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


// ---------------- EXTRACT (FULL ORIGINAL LOGIC RESTORED) ----------------
async function extractFromM4UPlay(url) {
  try {
    const res = await fetchWithTimeout(url);

    if (!res || !res.ok) return [];

    const html = await res.text();

    let unpacked = html;

    const packer = html.match(/eval\(function\(p,a,c,k,e,d\).*?\)/s);
    if (packer) {
      try {
        const args = packer[0].match(/\((.*)\)/s)[1];
        const parts = args.split(",");
        unpacked += unpack(parts[0].slice(1, -1), parseInt(parts[1]), parseInt(parts[2]), parts[3].slice(1, -1).split("|"));
      } catch {}
    }

    const match = unpacked.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);

    if (!match) return [];

    const master = match[0];

    const resolved = await resolveHlsPlaylist(master);

    // ✅ TV FIX
    if (resolved.isMaster && resolved.variants.length > 0) {
      return resolved.variants.map(v => ({
        url: v.url,
        quality: v.quality
      }));
    }

    return [{ url: master, quality: "Unknown" }];
  } catch {
    return [];
  }
}


// ---------------- MAIN ----------------
async function getStreams(tmdbId, mediaType = "movie") {
  try {
    const tmdb = await fetchWithTimeout(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);

    if (!tmdb || !tmdb.ok) return [];

    const data = await tmdb.json();

    const title = data.title || data.name;
    const year = (data.release_date || data.first_air_date || "").split("-")[0];

    const results = await searchMovies(title);
    if (!results.length) return [];

    const watchLinks = await extractWatchLinks(results[0].url);

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
