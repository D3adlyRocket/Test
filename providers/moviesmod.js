// movies4u.js
// Fixed Nuvio-compatible Movies4u provider with operational HubCloud / FSL form bypasses

const cheerio = require("cheerio");

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": FALLBACK_URL,
  "Accept-Language": "en-US,en;q=0.9",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
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
 * Advanced HubCloud Resolver
 * Bypasses intermediate landing and extracts the hidden token payload
 */
async function resolveHubCloud(url) {
  try {
    const parsedUrl = new URL(url);
    const domainBase = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const resp = await fetch(url, { headers: HEADERS, skipSizeCheck: true });
    const html = await resp.text();
    let $ = cheerio.load(html);

    // Look for form elements commonly used by Hubcloud/HubDrive links
    const form = $("form");
    if (form.length > 0) {
      const formUrl = form.attr("action") || url;
      const targetAction = formUrl.startsWith("http") ? formUrl : `${domainBase}${formUrl}`;
      
      // Serialize form payload inputs
      const formData = new URLSearchParams();
      form.find("input").each((_, input) => {
        const name = $(input).attr("name");
        const value = $(input).attr("value") || "";
        if (name) formData.append(name, value);
      });

      // Submit authorization payload to step past redirect gates
      const postHeaders = {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": url
      };

      const finalPageResp = await fetch(targetAction, {
        method: "POST",
        headers: postHeaders,
        body: formData.toString(),
        skipSizeCheck: true
      });

      const finalHtml = await finalPageResp.text();
      const $final = cheerio.load(finalHtml);
      
      // Extract underlying media endpoints
      let streamUrl = $final("a.btn-success, a:contains('Stream'), video source").attr("href") || $final("video source").attr("src");
      
      if (!streamUrl) {
        // Fallback structural check: evaluate inline regex declarations inside standard player instances
        const jsUrlMatch = finalHtml.match(/["'](https?:\/\/[^"']+\.(?:mp4|m3u8|mkv)[^"']*)["']/i);
        if (jsUrlMatch) streamUrl = jsUrlMatch[1];
      }

      if (streamUrl) {
        return [{
          url: streamUrl,
          quality: extractQuality(finalHtml + streamUrl),
          title: "HubCloud Video Stream",
          subtitles: []
        }];
      }
    }

    // Secondary fallback for direct links
    let backupLink = $("a:contains('Download'), .btn-primary").attr("href");
    if (backupLink) {
      if (!backupLink.startsWith("http")) backupLink = `${domainBase}${backupLink}`;
      return [{ url: backupLink, quality: "Unknown", title: "HubCloud Stream Mirror", subtitles: [] }];
    }

    return [];
  } catch (e) {
    console.error("[HubCloud Resolver Exception]", e);
    return [];
  }
}

/**
 * Advanced FSL (FSLinks) Resolver
 * Bypasses countdown tracking vectors and tracks relative source tags
 */
async function resolveFSL(url) {
  try {
    const parsedUrl = new URL(url);
    const domainBase = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const resp = await fetch(url, { headers: HEADERS, skipSizeCheck: true });
    const html = await resp.text();
    const $ = cheerio.load(html);

    // Look for landing anchor indicators or hidden file configuration containers
    let targetLink = $("a.btn-download, a.btn-primary, #download_link").attr("href");

    if (!targetLink) {
      // Evaluate target properties bound directly within the inline client definitions
      const scriptMatch = html.match(/var\s+(?:link|url|streamUrl)\s*=\s*['"]([^'"]+)['"]/i);
      if (scriptMatch) targetLink = scriptMatch[1];
    }

    if (targetLink) {
      if (!targetLink.startsWith("http")) targetLink = `${domainBase}${targetLink}`;

      return [{
        url: targetLink,
        quality: extractQuality(html + targetLink),
        title: "FSL Multi-Quality Stream",
        subtitles: []
      }];
    }

    return [];
  } catch (e) {
    console.error("[FSL Resolver Exception]", e);
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
// NUVIO PIPELINE EXPORT
// =======================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;

    if (!title) return [];

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

    const movieResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });
    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);
    const watchLinks = [];

    // Collect all links belonging to any of the valid streaming backends
    $movie("a[href]").each((i, el) => {
      const href = $movie(el).attr("href");
      if (href && (
        href.includes("m4uplay") || 
        href.includes("m4ufree") || 
        href.includes("m4u") || 
        href.includes("hubcloud") || 
        href.includes("fsl") || 
        href.includes("fslink")
      )) {
        if (!watchLinks.includes(href)) watchLinks.push(href);
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
    console.error("[Movies4u Code Error]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
