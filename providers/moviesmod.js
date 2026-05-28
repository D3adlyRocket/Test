// movies4u.js
// Fixed Nuvio-compatible Movies4u provider with working HubCloud / FSL resolution

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
  if (u.includes("360")) return "360p";
  return "Unknown";
}

function detectProvider(url = "") {
  const u = url.toLowerCase();
  if (u.includes("hubcloud") || u.includes("hc.now") || u.includes("hubcloud.club")) return "hubcloud";
  if (u.includes("fsl") || u.includes("fslink")) return "fsl";
  if (u.includes("m4uplay")) return "m4uplay";
  if (u.includes("m4u")) return "m4u";
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
 * Resolves HubCloud Gateway Links
 */
async function resolveHubCloud(url) {
  try {
    const resp = await fetch(url, { headers: HEADERS, skipSizeCheck: true });
    const html = await resp.text();
    const $ = cheerio.load(html);

    // Hubcloud landing pages usually use a download/watch button leading to an 'unblocked' download page
    let nextUrl = $("a:contains('Download'), a:contains('Watch'), .btn-success").attr("href");
    
    if (!nextUrl) {
      // Alternate fallback: try finding script based redirects
      const match = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
      if (match) nextUrl = match[1];
    }

    if (nextUrl) {
      if (!nextUrl.startsWith("http")) {
        const parsedUrl = new URL(url);
        nextUrl = `${parsedUrl.protocol}//${parsedUrl.host}${nextUrl}`;
      }
      
      // Fetch the final page which holds the direct stream or high-tier stream
      const finalResp = await fetch(nextUrl, { headers: HEADERS, skipSizeCheck: true });
      const finalHtml = await finalResp.text();
      const $final = cheerio.load(finalHtml);
      
      // Looking for instant stream elements or explicit source file paths
      const streamUrl = $final("a.btn-danger, a:contains('Stream'), video source").attr("href") || $final("video source").attr("src");

      if (streamUrl) {
        return [{
          url: streamUrl,
          quality: extractQuality(finalHtml + streamUrl),
          title: "HubCloud High-Speed Stream",
          subtitles: []
        }];
      }
    }

    // Default fallback if parsing fails mid-way
    return [{
      url,
      quality: "Unknown",
      title: "HubCloud Stream (Fallback)",
      subtitles: []
    }];
  } catch (e) {
    console.error("[HubCloud Resolution Error]", e);
    return [];
  }
}

/**
 * Resolves FSL (FSLinks) Gateway Links
 */
async function resolveFSL(url) {
  try {
    const resp = await fetch(url, { headers: HEADERS, skipSizeCheck: true });
    const html = await resp.text();
    const $ = cheerio.load(html);

    // FSL frequently utilizes explicit anchor classes for video pathways
    let targetLink = $("a.btn-download, a.btn-primary").attr("href");

    if (!targetLink) {
      // Look for regex variable streams inside script blocks
      const jsMatch = html.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/);
      if (jsMatch) targetLink = jsMatch[1];
    }

    if (targetLink) {
      if (!targetLink.startsWith("http")) {
        const parsedUrl = new URL(url);
        targetLink = `${parsedUrl.protocol}//${parsedUrl.host}${targetLink}`;
      }

      return [{
        url: targetLink,
        quality: extractQuality(html + targetLink),
        title: "FSL Multi-Quality Stream",
        subtitles: []
      }];
    }

    return [{
      url,
      quality: "Unknown",
      title: "FSL Stream",
      subtitles: []
    }];
  } catch (e) {
    console.error("[FSL Resolution Error]", e);
    return [];
  }
}

async function resolveM4U(url) {
  try {
    return [{
      url,
      quality: "Unknown",
      title: "M4U Stream",
      subtitles: []
    }];
  } catch (e) {
    return [];
  }
}

async function resolveStream(url) {
  const type = detectProvider(url);

  try {
    if (type === "hubcloud") {
      return await resolveHubCloud(url);
    }

    if (type === "fsl") {
      return await resolveFSL(url);
    }

    if (type === "m4uplay" || type === "m4u") {
      return await resolveM4U(url);
    }

    if (type === "direct") {
      return [{
        url,
        quality: extractQuality(url),
        title: "Direct Stream",
        subtitles: []
      }];
    }

    return [{
      url: await resolveUrl(url),
      quality: "Unknown",
      title: "Direct Stream",
      subtitles: []
    }];

  } catch (e) {
    return [];
  }
}

// =======================
// NUVIO EXPORT FIX
// =======================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    // TMDB Lookup
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;

    if (!title) return [];

    // Search Provider
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const searchHtml = await searchResp.text();
    if (!searchHtml) return [];

    const $ = cheerio.load(searchHtml);
    const results = [];
    const selectors = ["article", "div.item", "div.post", "div.card", "div.grid-item", "li"];

    selectors.forEach(sel => {
      $(sel).each((_, el) => {
        const a = $(el).find("a[href]").first();
        const href = a.attr("href");
        const name = $(el).find("h1,h2,h3,.title,.name").first().text().trim() || a.text().trim();

        if (href && name && name.length > 2) {
          results.push({ href, name });
        }
      });
    });

    if (!results.length) return [];

    const match = results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) || results[0];
    if (!match) return [];

    // Extract Streams from Movie Page
    const movieResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });
    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);
    const watchLinks = [];

    $movie("a.btn.btn-zip").each((i, el) => {
      const href = $movie(el).attr("href");
      if (href && (href.includes("m4uplay") || href.includes("m4ufree") || href.includes("m4u") || href.includes("hubcloud") || href.includes("fsl"))) {
        watchLinks.push(href);
      }
    });

    const streams = [];
    if (!watchLinks.length) return [];
    
    for (const watchLink of watchLinks.slice(0, 5)) {
      try {
        const resolved = await resolveUrl(watchLink);
        const providerStreams = await resolveStream(resolved);

        if (providerStreams?.length) {
          streams.push(...providerStreams.map(s => ({
            ...s,
            name: "Movies4u",
            subtitles: []
          })));
        }
      } catch (e) {
        console.log("[stream error]", e);
      }
    }

    return streams;

  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
