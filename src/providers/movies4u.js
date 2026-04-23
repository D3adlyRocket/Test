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


// ✅ FIXED FETCH (NO AbortController)
function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error("Timeout"));
      }
    }, timeout);

    fetch(url, {
      ...options,
      headers: {
        "User-Agent": HEADERS["User-Agent"],
        ...(options.headers || {})
      }
    })
      .then(res => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(res);
        }
      })
      .catch(err => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}


// ---------------- UTILS ----------------
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function calculateTitleSimilarity(t1, t2) {
  const a = normalizeTitle(t1);
  const b = normalizeTitle(t2);
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  return 0;
}

function findBestTitleMatch(mediaInfo, results) {
  let best = null, score = 0;
  for (const r of results) {
    const s = calculateTitleSimilarity(mediaInfo.title, r.title);
    if (s > score) {
      score = s;
      best = r;
    }
  }
  return best;
}


// ---------------- TMDB ----------------
async function getTMDBDetails(id, type) {
  try {
    const url = `${TMDB_BASE_URL}/${type === "movie" ? "movie" : "tv"}/${id}?api_key=${TMDB_API_KEY}`;
    const res = await fetchWithTimeout(url);
    if (!res || !res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || data.name,
      year: (data.release_date || data.first_air_date || "").split("-")[0]
    };
  } catch {
    return null;
  }
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


// ---------------- EXTRACT ----------------
async function extractFromM4UPlay(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res || !res.ok) return [];

    const html = await res.text();

    const match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);

    if (!match) return [];

    const master = match[0];

    const resolved = await resolveHlsPlaylist(master);

    // ✅ TV FIX: return variants instead of master
    if (resolved.isMaster && resolved.variants.length > 0) {
      return resolved.variants.map(v => ({
        url: v.url,
        quality: v.quality,
        isMaster: false
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
    const media = await getTMDBDetails(tmdbId, mediaType);
    if (!media) return [];

    const results = await searchMovies(media.title);
    if (!results.length) return [];

    const best = findBestTitleMatch(media, results);
    if (!best) return [];

    const watchLinks = await extractWatchLinks(best.url);

    const streams = [];

    for (const link of watchLinks) {
      const extracted = await extractFromM4UPlay(link.url);

      for (const s of extracted) {
        streams.push({
          name: "Movies4u",
          title: `${media.title} (${media.year}) - ${s.quality}`,
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
