/**
 * Movies4u Provider for StreamPlay Architecture
 * Updated with redundant search fallbacks, flexible selector parsing, and full logging.
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
    console.warn("[HubCloud Extractor] Extractor fallback used for:", url);
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
 * Utility: Extract direct S3/R2 storage link from Cloudflare Worker wrapper
 */
function unwrapWorkerUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (url.includes("workers.dev") && url.includes("?url=")) {
    try {
      const targetParam = url.split("?url=")[1];
      if (targetParam) {
        return decodeURIComponent(targetParam);
      }
    } catch (_) {}
  }
  return url;
}

/**
 * Fetch helper with standard headers & referrer
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
 * Get media details from TMDB
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
 * Active base domain lookup
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
 * Hybrid Search: Try search.php API first, fall back to standard HTML search (?s=)
 */
async function searchMovies4u(base, query) {
  // Strategy 1: search.php API endpoint
  try {
    const searchUrl = `${base}/search.php?q=${encodeURIComponent(query)}`;
    const text = await fetchText(searchUrl, base);
    const data = JSON.parse(text);
    const hits = (data.hits || []).map((hit) => hit?.document).filter(Boolean);
    if (hits.length > 0) return hits;
  } catch (err) {
    console.warn(`[Movies4u] API search failed, falling back to HTML search: ${err.message}`);
  }

  // Strategy 2: WordPress Standard HTML Search fallback
  try {
    const htmlUrl = `${base}/?s=${encodeURIComponent(query)}`;
    const html = await fetchText(htmlUrl, base);
    
    let $;
    try {
      const cheerio = require("cheerio") || require("cheerio-without-node-native");
      $ = cheerio.load(html);
    } catch (_) {
      return [];
    }

    const results = [];
    $("article, .post-item, .result-item").each((_, el) => {
      const linkEl = $(el).find("a[href]").first();
      const permalink = linkEl.attr("href");
      const title = linkEl.text() || $(el).find(".entry-title, .title").text();
      if (permalink) {
        results.push({ post_title: title.trim(), permalink });
      }
    });

    return results;
  } catch (err) {
    console.error(`[Movies4u] HTML fallback search failed: ${err.message}`);
    return [];
  }
}

/**
 * Select closest post match
 */
function selectBestResult(results, media, mediaType) {
  if (!results || !results.length) return null;

  if (media.imdbId) {
    const match = results.find((item) => item.imdb_id === media.imdbId);
    if (match) return match;
  }

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
 * Extracts intermediate stream pages (HubCloud, GDFlix, Drive, etc.)
 */
function extractHubCloudLinksFromHtml(html, pageUrl) {
  const links = [];

  // Match pattern expands beyond hubcloud to capture alternate host domains Movies4u uses
  const urlPattern = /https?:\/\/[^\s"'<>]+(?:hubcloud|gdflix|drivebot|hubdrive|filepress)[^\s"'<>]+/gi;
  let match;

  while ((match = urlPattern.exec(html)) !== null) {
    const cleanUrl = match[0].replace(/\\/g, "");
    links.push({
      url: cleanUrl,
      text: "Stream Candidate Link",
      referer: pageUrl
    });
  }

  // Also check standard anchor tags if regex didn't catch specific formatted buttons
  try {
    const cheerio = require("cheerio") || require("cheerio-without-node-native");
    const $ = cheerio.load(html);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text() || "";
      if (href && /(hubcloud|gdflix|drivebot|hubdrive)/i.test(href)) {
        links.push({
          url: href,
          text: text.trim(),
          referer: pageUrl
        });
      }
    });
  } catch (_) {}

  // Deduplicate discovered candidate links
  const seen = new Set();
  return links.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

/**
 * Primary Candidate Discovery Function
 */
async function discoverCandidates(tmdbId, mediaType, season = 1, episode = 1) {
  try {
    const base = await getMovies4uBase();
    console.log(`[Movies4u] Base Domain: ${base}`);

    const media = await getMediaDetails(tmdbId, mediaType);
    console.log(`[Movies4u] Target Media: "${media.title}" (${media.year}) | IMDB: ${media.imdbId}`);

    let searchResults = media.imdbId ? await searchMovies4u(base, media.imdbId) : [];
    if (!searchResults.length) {
      searchResults = await searchMovies4u(base, media.title);
    }

    console.log(`[Movies4u] Found ${searchResults.length} search results.`);

    const matchedPost = selectBestResult(searchResults, media, mediaType);
    if (!matchedPost || !matchedPost.permalink) {
      console.warn(`[Movies4u] No matching post title found for search query.`);
      return [];
    }

    const postUrl = matchedPost.permalink.startsWith("http")
      ? matchedPost.permalink
      : `${base}/${matchedPost.permalink.replace(/^\//, "")}`;

    console.log(`[Movies4u] Fetching Post Page: ${postUrl}`);
    const postHtml = await fetchText(postUrl, base);

    const candidateLinks = extractHubCloudLinksFromHtml(postHtml, postUrl);
    console.log(`[Movies4u] Extracted ${candidateLinks.length} candidate links from page.`);

    return candidateLinks.map((link) => ({
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
 * Resolve candidates to playable stream links
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
        url: unwrappedUrl,
        file: unwrappedUrl,
        proxiedUrl: rawUrl !== unwrappedUrl ? rawUrl : undefined
      };
    });
  } catch (err) {
    console.error(`[Movies4u Resolve] Failed to resolve candidate: ${err.message}`);
    return [];
  }
}

/**
 * Main module execution function
 */
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const candidates = await discoverCandidates(tmdbId, mediaType, season, episode);
    if (!candidates.length) return [];

    const resolvedStreams = await mapConcurrent(candidates, 4, resolveCandidate);
    const flatStreams = resolvedStreams.flat().filter(Boolean);
    const finalStreams = uniqueExactStreams(flatStreams);

    console.log(`[Movies4u] Successfully generated ${finalStreams.length} stream links.`);
    return finalStreams;
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
