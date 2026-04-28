/**
 * patronDizipal - Adapted for Android TV using 4KHDHub Template
 * Generated: 2026-04-29T00:15:22.000Z
 */
"use strict";

var cheerio = require("cheerio-without-node-native");

// --- Constants (From Original) ---
var MAIN_URL = "https://dizipal2063.com";
var TMDB_API_KEY = "500330721680edb6d5f7f12ba7cd9023";
var PROVIDER_TAG = "[DizipalTV]";
// Standard Android TV User-Agent to ensure compatible stream formats
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

var KNOWN_DOMAINS = [
  "https://dizipal2063.com",
  "https://dizipal2064.com",
  "https://dizipal2062.com",
  "https://dizipal2061.com"
];

var _resolvedUrl = null;

// --- Helper: Domain Resolver ---
async function resolveMainUrl() {
  if (_resolvedUrl) return _resolvedUrl;
  for (const domain of KNOWN_DOMAINS) {
    try {
      const res = await fetch(`${domain}/`, {
        method: "HEAD",
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(8000) // Increased for TV latency
      });
      if (res.ok || res.status === 302) {
        _resolvedUrl = new URL(res.url).origin;
        return _resolvedUrl;
      }
    } catch (_) {}
  }
  return KNOWN_DOMAINS[0];
}

// --- Helper: TMDB Logic (Kept Original) ---
async function getTmdbMetadata(tmdbId, type) {
  const endpoint = type === "movie" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      trTitle: data.title || data.name || "",
      origTitle: data.original_title || data.original_name || "",
      year: data.release_date || data.first_air_date ? parseInt((data.release_date || data.first_air_date).substring(0, 4)) : null
    };
  } catch (e) { return null; }
}

// --- Extraction Logic (The Mobile to TV Fix) ---
async function resolveDizipalStream(url, activeUrl) {
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    const html = await response.text();
    
    // 1. Check for data-cfg (Most common on Dizipal)
    const cfgMatch = html.match(/data-cfg="([^"]+)"/);
    if (cfgMatch) {
      const configRes = await fetch(`${activeUrl}/ajax-player-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": USER_AGENT,
          "Referer": url
        },
        body: `cfg=${encodeURIComponent(cfgMatch[1])}`
      });
      const configJson = await configRes.json();
      const rawUrl = configJson?.url || configJson?.config?.v || configJson?.data?.url;
      if (rawUrl) return { url: rawUrl.replace(/\\\//g, "/"), referer: url };
    }

    // 2. Direct m3u8 fallback (Standard for TV players)
    const m3u8Match = html.match(/["']([^"']*\.m3u8[^"']*)["']/);
    if (m3u8Match) return { url: m3u8Match[1], referer: url };

    return null;
  } catch (e) { return null; }
}

// --- Main getStreams (The 4KHDHub structure) ---
async function getStreams(tmdbId, type, season, episode) {
  try {
    console.log(`${PROVIDER_TAG} Starting...`);
    const activeUrl = await resolveMainUrl();
    const meta = await getTmdbMetadata(tmdbId, type);
    if (!meta) return [];

    const query = meta.trTitle || meta.origTitle;
    const searchUrl = `${activeUrl}/ajax-search?q=${encodeURIComponent(query)}`;
    
    const searchRes = await fetch(searchUrl, {
      headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${activeUrl}/`, "User-Agent": USER_AGENT }
    });
    const results = await searchRes.json();

    if (!results?.success || !Array.isArray(results.results)) return [];

    const matchType = type === "movie" ? "Film" : "Dizi";
    const match = results.results.find(r => {
      if (r.type !== matchType) return false;
      const yearMatches = !meta.year || !r.year || Math.abs(meta.year - r.year) <= 1;
      return yearMatches;
    });

    if (!match) return [];

    let contentUrl = match.url.startsWith("http") ? match.url : `${activeUrl}${match.url}`;

    // TV Series Episode Selection
    if (type === "tv") {
      const seriesHtml = await (await fetch(contentUrl, { headers: { "User-Agent": USER_AGENT } })).text();
      const $ = cheerio.load(seriesHtml);
      const epPattern = new RegExp(`${season}.*[Ss]ezon.*${episode}.*[Bb]ölüm`, "i");
      
      let epUrl = null;
      $("a").each((_, el) => {
        const text = $(el).text();
        if (epPattern.test(text)) {
          const href = $(el).attr("href");
          epUrl = href.startsWith("http") ? href : `${activeUrl}${href}`;
        }
      });
      if (!epUrl) return [];
      contentUrl = epUrl;
    }

    const stream = await resolveDizipalStream(contentUrl, activeUrl);
    
    if (stream) {
      return [{
        name: `Dizipal - ${type === 'tv' ? `S${season}E${episode}` : 'Movie'}`,
        title: `Dizipal TV [720p/1080p]\nDomain: ${new URL(activeUrl).hostname}`,
        url: stream.url,
        // CRITICAL TV FIX: Android TV players (ExoPlayer) need headers passed like this
        headers: { 
          "Referer": stream.referer,
          "User-Agent": USER_AGENT 
        },
        behaviorHints: {
          bingeGroup: `dizipal-${tmdbId}`,
          // Some TV apps use this to proxy the request correctly
          notWeb: true 
        }
      }];
    }

  } catch (err) {
    console.log(`${PROVIDER_TAG} Error: ${err.message}`);
  }
  return [];
}

module.exports = { getStreams };
