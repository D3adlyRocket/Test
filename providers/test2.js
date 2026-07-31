/**
 * Movies4u Provider for StreamPlay Architecture
 * Handles searching, candidate extraction, HubCloud extraction, and Worker URL unwrapping.
 */

// Helper: Safety fallbacks for standalone usage or custom bundlers
const getDomains = typeof require_domains === "function" ? require_domains : () => ({
  MOVIES4U_FALLBACK: "https://new2.movies4u.clinic",
  TMDB_API: "https://api.themoviedb.org/3",
  PHISHER_DOMAINS: "https://raw.githubusercontent.com/phisher98/Phisher-Domains/main/domains.json"
});

const getStreamsUtils = typeof require_streams === "function" ? require_streams : () => ({
  uniqueExactStreams: (streams) => {
    const seen = new Set();
    return streams.filter((stream) => {
      const key = stream.url || stream.file;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
  mapConcurrent: async (items, limit, fn) => {
    const results = [];
    const executing = [];
    for (const item of items) {
      const p = Promise.resolve().then(() => fn(item));
      results.push(p);
      if (limit <= items.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }
    }
    return Promise.all(results);
  }
});

const getExtractor = typeof require_extractor === "function" ? require_extractor : () => ({
  extractHubCloud: async (url, referer) => {
    console.warn("[HubCloud Extractor] Module missing. Returning candidate URL.");
    return [{ file: url, quality: "auto", type: "hls" }];
  }
});

// Initialize dependencies
const DOMAINS = getDomains();
const { uniqueExactStreams, mapConcurrent } = getStreamsUtils();
const { extractHubCloud } = getExtractor();

const MOVIES4U_FALLBACK = DOMAINS.MOVIES4U_FALLBACK || "https://new2.movies4u.clinic";
const TMDB_API = DOMAINS.TMDB_API || "https://api.themoviedb.org/3";
const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

/**
 * Utility: Unwrap Cloudflare Worker proxies to extract direct storage S3/R2 URLs
 */
function unwrapWorkerUrl(url) {
  if (!url || typeof url !== "string") return url;

  // Checks for proxy pattern (e.g., workers.dev/.../file.mkv?url=https://...)
  if (url.includes("workers.dev") && url.includes("?url=")) {
    try {
      const targetParam = url.split("?url=")[1];
      if (targetParam) {
        return decodeURIComponent(targetParam);
      }
    } catch (_) {
      // Return original URL if decoding fails
    }
  }
  return url;
}

/**
 * Fetch text response with full header configuration
 */
async function fetchText(url, referer) {
  const reqHeaders = { ...HEADERS };
  if (referer) reqHeaders["Referer"] = referer;

  const response = await fetch(url, { headers: reqHeaders, redirect: "follow" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

/**
 * Fetch TMDB media details (title, year, IMDB ID)
 */
async function getMediaDetails(tmdbId, mediaType) {
  const endpoint = mediaType === "tv" ? "tv" : "movie";
  const url = `${TMDB_API}/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=external_ids`;
  const text = await fetchText(url);
  const data = JSON.parse(text);

  return {
    title: mediaType === "tv" ? data.name : data.title,
    year: Number(String(mediaType === "tv" ? data.first_air_date : data.release_date).slice(0, 4)) || null,
    imdbId: data.imdb_id || data?.external_ids?.imdb_id || null
  };
}

/**
 * Resolve active domain base URL for Movies4u
 */
async function getMovies4uBase() {
  if (!DOMAINS.PHISHER_DOMAINS) return MOVIES4U_FALLBACK;
  try {
    const response = await fetchText(DOMAINS.PHISHER_DOMAINS);
    const domains = JSON.parse(response);
    if (domains.movies4u) {
      return String(domains.movies4u).replace(/\/$/, "");
    }
  } catch (_) {}
  return MOVIES4U_FALLBACK;
}

/**
 * Query Movies4u internal search endpoint
 */
async function searchMovies4u(base, query) {
  try {
    const searchUrl = `${base}/search.php?q=${encodeURIComponent(query)}`;
    const text = await fetchText(searchUrl, base);
    const data = JSON.parse(text);
    return (data.hits || []).map((hit) => hit?.document).filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Match search results against metadata
 */
function selectBestResult(results, media, mediaType) {
  if (!results || !results.length) return null;

  // Match 1: IMDB ID match
  if (media.imdbId) {
    const match = results.find((item) => item.imdb_id === media.imdbId);
    if (match) return match;
  }

  // Match 2: Title and year heuristics
  const title = String(media.title || "").toLowerCase();
  const year = String(media.year || "");

  return results.find((item) => {
    const postTitle = String(item.post_title || "").toLowerCase();
    const titleMatch = postTitle.includes(title);
    const yearMatch = !year || postTitle.includes(year);
    const typeMatch = mediaType !== "tv" || /season|series|episode/i.test(postTitle);
    return titleMatch && yearMatch && typeMatch;
  }) || results[0];
}

/**
 * Parse HTML to extract HubCloud intermediate links
 */
function extractHubCloudLinksFromHtml(html, pageUrl) {
  let $;
  try {
    const cheerio = require("cheerio") || require("cheerio-without-node-native");
    $ = cheerio.load(html);
  } catch (_) {
    // Fallback regex parsing if Cheerio is unavailable
    const links = [];
    const hrefRegex = /href=["']([^"']*hubcloud[^"']*)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      links.push({ url: match[1], text: "HubCloud Link", referer: pageUrl });
    }
    return links;
  }

  const links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text() || "";
    if (href && /hubcloud/i.test(href)) {
      links.push({
        url: href,
        text: text.trim(),
        referer: pageUrl
      });
    }
  });

  return links;
}

/**
 * Search and find stream candidate links
 */
async function discoverCandidates(tmdbId, mediaType, season = 1, episode = 1) {
  try {
    const base = await getMovies4uBase();
    const media = await getMediaDetails(tmdbId, mediaType);

    let searchResults = media.imdbId ? await searchMovies4u(base, media.imdbId) : [];
    if (!searchResults.length) {
      searchResults = await searchMovies4u(base, media.title);
    }

    const matchedPost = selectBestResult(searchResults, media, mediaType);
    if (!matchedPost || !matchedPost.permalink) return [];

    const postUrl = matchedPost.permalink.startsWith("http")
      ? matchedPost.permalink
      : `${base}/${matchedPost.permalink.replace(/^\//, "")}`;

    const postHtml = await fetchText(postUrl, base);
    const hubcloudLinks = extractHubCloudLinksFromHtml(postHtml, postUrl);

    return hubcloudLinks.map((link) => ({
      provider: "movies4u",
      url: link.url,
      referer: link.referer,
      text: link.text
    }));
  } catch (err) {
    console.error(`[Movies4u Candidates] Error: ${err.message}`);
    return [];
  }
}

/**
 * Resolve candidate URL via HubCloud extractor and unwrap Worker proxies
 */
async function resolveCandidate(candidate) {
  if (!candidate || !candidate.url) return [];
  try {
    const streams = await extractHubCloud(candidate.url, candidate.referer);
    
    return streams.map((stream) => {
      const rawUrl = stream.url || stream.file;
      const unwrappedUrl = unwrapWorkerUrl(rawUrl);

      return {
        ...stream,
        provider: "movies4u",
        url: unwrappedUrl,                      // Direct clean storage link (e.g. cloudflarestorage.com)
        file: unwrappedUrl,
        proxiedUrl: rawUrl !== unwrappedUrl ? rawUrl : undefined // Preserves worker proxy URL if needed for fallbacks
      };
    });
  } catch (_) {
    return [];
  }
}

/**
 * Main module execution function
 */
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const candidates = await discoverCandidates(tmdbId, mediaType, season, episode);
    const resolvedStreams = await mapConcurrent(candidates, 4, resolveCandidate);
    const flatStreams = resolvedStreams.flat().filter(Boolean);
    return uniqueExactStreams(flatStreams);
  } catch (err) {
    console.error(`[Movies4u] Failed to get streams: ${err.message}`);
    return [];
  }
}

module.exports = {
  discoverCandidates,
  resolveCandidate,
  getStreams,
  unwrapWorkerUrl
};
