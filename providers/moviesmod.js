// movies4u.js
// Final Fixed Nuvio Provider - Correctly routes wrapper links to the resolver API

const cheerio = require("cheerio");

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": FALLBACK_URL,
  "Cookie": "xla=s4t"
};

let cachedBaseUrl = null;

async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    const data = await resp.json();
    cachedBaseUrl = data.movies4u || data.movies4uhd || FALLBACK_URL;
  } catch (_) {
    cachedBaseUrl = FALLBACK_URL;
  }
  return cachedBaseUrl;
}

function extractQuality(text) {
  const u = (text || "").toLowerCase();
  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  return "Unknown";
}

/**
 * UPDATED PROVIDER DETECTION
 * Identifies m4uplay and m4ulinks as wrappers that need the API extractor
 */
function detectProvider(url = "") {
  const u = url.toLowerCase();
  
  // If it's a known cloud host or an intermediate wrapper link, route it to the solver API
  if (
    u.includes("hubcloud") || 
    u.includes("hc.now") || 
    u.includes("hubcloud.club") ||
    u.includes("fsl") || 
    u.includes("fslink") ||
    u.includes("m4uplay.store") || // <-- FIX: Catches the exact wrapper link
    u.includes("m4ulinks.com")     // <-- FIX: Catches the exact shortener link
  ) {
    return "solver_api";
  }

  if (u.includes("token=") || u.includes(".m3u8") || u.includes("master.txt")) return "direct";
  
  return "unknown";
}

async function resolveUrl(url) {
  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      skipSizeCheck: true
    });
    return resp.url || url;
  } catch (_) {
    return url;
  }
}

/**
 * Universal Solver API Route
 * Sends wrappers, HubCloud, and FSL domains directly to the Vercel extraction engine
 */
async function resolveViaApi(url) {
  try {
    const extractionApi = `https://hc-zf3c.vercel.app/api/extract?url=${encodeURIComponent(url)}`;
    
    const resp = await fetch(extractionApi, {
      headers: { "Accept": "application/json" },
      skipSizeCheck: true
    });

    if (!resp.ok) return [];
    
    const data = await resp.json();
    const links = data.links || [];

    if (links.length > 0) {
      return links.map(link => ({
        url: link.url,
        quality: extractQuality(link.label || ""),
        title: `Movies4u Cloud (${link.label || 'Direct Stream'})`,
        subtitles: []
      }));
    }
    return [];
  } catch (e) {
    console.error("[Solver API Exception]", e);
    return [];
  }
}

async function resolveStream(url) {
  const type = detectProvider(url);
  try {
    // Both raw cloud hosts and wrapper URLs go here now
    if (type === "solver_api") {
      return await resolveViaApi(url);
    }
    
    if (type === "direct") {
      return [{
        url,
        quality: extractQuality(url),
        title: "Direct Stream",
        subtitles: []
      }];
    }
    return [];
  } catch (e) {
    return [];
  }
}

// ==========================================
// EXPORT PIPELINE
// ==========================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    // 1. Meta Lookup
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search Provider
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {
      headers: HEADERS,
      skipSizeCheck: true
    });
    const searchHtml = await searchResp.text();
    if (!searchHtml) return [];

    const $ = cheerio.load(searchHtml);
    const results = [];
    $("article, div.item, div.post").each((_, el) => {
      const a = $(el).find("a[href]").first();
      const href = a.attr("href");
      const name = $(el).find("h1,h2,h3,.title").first().text().trim() || a.text().trim();
      if (href && name && name.length > 2) {
        results.push({ href, name });
      }
    });
    if (!results.length) return [];

    const match = results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) || results[0];
    if (!match) return [];

    // 3. Extract Links
    const movieResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });
    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);
    const watchLinks = [];

    $movie("a[href]").each((_, el) => {
      const href = $movie(el).attr("href");
      if (!href) return;
      
      const lowerHref = href.toLowerCase();

      // Blacklist non-video files
      if (lowerHref.includes(".apk") || lowerHref.includes("telegram.me") || lowerHref.includes("joincloud")) {
        return;
      }

      // Whitelist targets
      if (
        lowerHref.includes("m4uplay") || 
        lowerHref.includes("m4ufree") || 
        lowerHref.includes("m4u") || 
        lowerHref.includes("hubcloud") || 
        lowerHref.includes("fsl") || 
        lowerHref.includes("fslink") ||
        lowerHref.includes("m4ulinks")
      ) {
        if (!watchLinks.includes(href)) watchLinks.push(href);
      }
    });

    const streams = [];
    if (!watchLinks.length) return [];
    
    // Process unique links
    for (const watchLink of watchLinks.slice(0, 6)) {
      try {
        const resolved = await resolveUrl(watchLink);
        if (resolved.toLowerCase().includes(".apk")) continue;

        const providerStreams = await resolveStream(resolved);
        if (providerStreams?.length) {
          streams.push(...providerStreams.map(s => ({
            ...s,
            name: "Movies4u",
            subtitles: []
          })));
        }
      } catch (e) {
        console.log("[stream process error]", e);
      }
    }

    return streams;

  } catch (e) {
    console.error("[Movies4u Fatal Engine Error]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
