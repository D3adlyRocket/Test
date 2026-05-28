// movies4u.js
// Completely Self-Contained Native Resolver - No External API Dependencies

const cheerio = require("cheerio");

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

// Enhanced headers to look exactly like an organic browser click sequence
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Connection": "keep-alive"
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
  return "1080p"; // Default high quality for Nuvio player stability
}

/**
 * Native HubCloud and FSL Token Decoder
 * Manually parses hidden forms and submits required POST validation states
 */
async function nativeHubcloudDecoder(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    const domainBase = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // Step 1: Request the landing gate page
    const res = await fetch(targetUrl, { headers: HEADERS, skipSizeCheck: true });
    const html = await res.text();
    let $ = cheerio.load(html);

    // Look for form validation wrappers used by m4uplay / m4ulinks
    const form = $("form");
    if (form.length > 0) {
      const formAction = form.attr("action") || "";
      const targetAction = formAction.startsWith("http") ? formAction : `${domainBase}${formAction.startsWith('/') ? '' : '/'}${formAction}`;
      
      // Collect internal security tokens dynamically
      const bodyParams = new URLSearchParams();
      form.find("input").each((_, input) => {
        const name = $(input).attr("name");
        const value = $(input).attr("value") || "";
        if (name) bodyParams.append(name, value);
      });

      // Step 2: Mimic form submission click event
      const finalResp = await fetch(targetAction, {
        method: "POST",
        headers: {
          ...HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": targetUrl
        },
        body: bodyParams.toString(),
        skipSizeCheck: true
      });

      const finalHtml = await finalResp.text();
      const $final = cheerio.load(finalHtml);

      // Search for video elements or raw stream URLs inside script signatures
      let videoUrl = $final("a.btn-success, a:contains('Stream'), video source").attr("href") || $final("video source").attr("src");
      
      if (!videoUrl) {
        // Safe regex lookup fallback for absolute cloud asset parameters
        const scriptMatch = finalHtml.match(/["'](https?:\/\/[^"']+\.(?:mp4|m3u8|mkv)[^"']*)["']/i);
        if (scriptMatch) videoUrl = scriptMatch[1];
      }

      if (videoUrl) {
        return [{
          url: videoUrl,
          quality: extractQuality(finalHtml + videoUrl),
          title: "Movies4u Premium Link",
          subtitles: []
        }];
      }
    }

    // Direct Anchor link fallback loop
    let fallbackAnchor = $("a:contains('Download'), .btn-primary, a.btn-zip").attr("href");
    if (fallbackAnchor) {
      if (!fallbackAnchor.startsWith("http")) fallbackAnchor = `${domainBase}${fallbackAnchor.startsWith('/') ? '' : '/'}${fallbackAnchor}`;
      return [{
        url: fallbackAnchor,
        quality: "1080p",
        title: "Movies4u Mirror Link",
        subtitles: []
      }];
    }

    return [];
  } catch (err) {
    console.error("[Native Decoder Exception]", err);
    return [];
  }
}

// ==========================================
// PIPELINE STREAM HANDLER
// ==========================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    // 1. Fetch TMDB Data
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Query Search Index
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

    // 3. Extract Stream Containers from Post Page
    const movieResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });
    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);
    const watchLinks = [];

    $movie("a[href]").each((_, el) => {
      const href = $movie(el).attr("href");
      if (!href) return;
      
      const lowerHref = href.toLowerCase();

      // Instantly drop setup binaries and standalone apps
      if (lowerHref.includes(".apk") || lowerHref.includes("telegram.me") || lowerHref.includes("joincloud")) {
        return;
      }

      // Intercept valid wrapper extensions
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
    
    // Process unique wrapper structures natively
    for (const watchLink of watchLinks.slice(0, 4)) {
      try {
        // Decode wrapper links natively without relying on any external APIs
        const resolvedStreams = await nativeHubcloudDecoder(watchLink);
        
        if (resolvedStreams && resolvedStreams.length > 0) {
          for (const stream of resolvedStreams) {
            // Final validation step to prevent dead structural code leaking to Nuvio
            if (stream.url && !stream.url.includes("m4ulinks.com") && !stream.url.includes("m4uplay.store")) {
              streams.push({
                ...stream,
                name: "Movies4u",
                subtitles: []
              });
            }
          }
        }
      } catch (e) {
        console.log("[stream execution exception]", e);
      }
    }

    return streams;

  } catch (e) {
    console.error("[Movies4u Fatal System Failure]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
