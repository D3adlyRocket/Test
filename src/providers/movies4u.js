"use strict";

var cheerio = require("cheerio-without-node-native");

var TMDB_API_KEY = "1b3113663c9004682ed61086cf967c44";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";

var MAIN_URL = "https://new1.movies4u.style";
var M4UPLAY_BASE = "https://m4uplay.store";

var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Referer": MAIN_URL,
  "Origin": MAIN_URL
};


// ✅ SAFE FETCH (TV FRIENDLY)
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

// ✅ RETRY WRAPPER
async function safeFetch(url, options = {}, retries = 2) {
  try {
    return await fetchWithTimeout(url, options);
  } catch (e) {
    if (retries > 0) return safeFetch(url, options, retries - 1);
    throw e;
  }
}


// ---------------- TMDB ----------------
async function getTMDBDetails(tmdbId, mediaType) {
  try {
    const type = mediaType === "movie" ? "movie" : "tv";
    const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const res = await safeFetch(url);

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
    const url = `${MAIN_URL}/?s=${encodeURIComponent(query)}`;
    const res = await safeFetch(url);

    if (!res || !res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);

    const results = [];

    $("h3.entry-title a").each((_, el) => {
      const title = $(el).text().trim();
      const link = $(el).attr("href");

      if (title && link) results.push({ title, url: link });
    });

    return results;
  } catch {
    return [];
  }
}


// ---------------- WATCH LINKS ----------------
async function extractWatchLinks(url) {
  try {
    const res = await safeFetch(url);

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


// ---------------- HLS RESOLVER ----------------
async function resolveHlsPlaylist(masterUrl) {
  const result = { variants: [] };

  try {
    const res = await safeFetch(masterUrl, {
      headers: { Referer: M4UPLAY_BASE }
    });

    if (!res || !res.ok) return result;

    const text = await res.text();

    if (!text.includes("#EXTM3U")) return result;

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
    const res = await safeFetch(url);

    if (!res || !res.ok) return [];

    const html = await res.text();

    const match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);

    if (!match) return [];

    const master = match[0];

    const resolved = await resolveHlsPlaylist(master);

    // ✅ RETURN DIRECT STREAMS (TV FIX)
    if (resolved.variants.length > 0) {
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
    let media = await getTMDBDetails(tmdbId, mediaType);

    if (!media) return [];

    const results = await searchMovies(media.title);

    if (!results.length) return [];

    const page = results[0];

    const watchLinks = await extractWatchLinks(page.url);

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
            Referer: M4UPLAY_BASE,
            "User-Agent": HEADERS["User-Agent"]
          }
        });
      }
    }

    return streams;
  } catch (e) {
    return [];
  }
}


module.exports = { getStreams };
