const cheerio = require('cheerio-without-node-native');
// multimovies.js
// MultiMovies - Hindi/Bollywood/Anime provider via multimovies.autos with WordPress player extraction

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://multimovies.homes";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

let cachedBaseUrl = null;

async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const resp = await fetch(DOMAINS_URL);
    const data = await resp.json();
    cachedBaseUrl = data.MultiMovies || FALLBACK_URL;
  } catch(e) {
    cachedBaseUrl = FALLBACK_URL;
  }
  return cachedBaseUrl;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const BASE_URL = await getBaseUrl();

    // Step 1: Get title from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Step 2: Search MultiMovies
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {
      headers: HEADERS
    });
    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];
    $("div.result-item").each((i, el) => {
      const a = $(el).find("article > div.details > div.title > a");
      const href = a.attr("href");
      const name = a.text().trim();
      if (href && name) results.push({ href, name });
    });

    if (results.length === 0) return [];

    const isMovie = mediaType === "movie";
    const match = results.find(r =>
      r.name.toLowerCase().includes(title.toLowerCase())
    ) || results[0];

    // Step 3: Load content page
    const pageResp = await fetch(match.href, { headers: HEADERS });
    const pageHtml = await pageResp.text();
    const $p = cheerio.load(pageHtml);

    const streams = [];

    if (!isMovie && mediaType === "tv") {
      // TV Series: get episode list
      const episodes = [];
      
      // Fixed: Improved structural scraping for modern Dooplay layouts
      $p("#seasons ul.episodios").each((sIdx, sList) => {
        const seasonNum = sIdx + 1;
        $p(sList).find("li").each((eIdx, epEl) => {
          // Checks both direct links and common structural variations
          const href = $p(epEl).find("div.episodiotitle > a").attr("href") || $p(epEl).find("a").attr("href");
          if (href) {
            episodes.push({ href, season: seasonNum, episode: eIdx + 1 });
          }
        });
      });

      const targetEp = episodes.find(ep =>
        ep.season === parseInt(season || 1) && ep.episode === parseInt(episode || 1)
      ) || episodes[0];

      if (!targetEp) return [];

      // Load episode page and get player options
      const epResp = await fetch(targetEp.href, { headers: HEADERS });
      const epHtml = await epResp.text();
      const $ep = cheerio.load(epHtml);

      const epItems = [];
      $ep("ul#playeroptionsul li").each((i, el) => {
        epItems.push({
          post: $ep(el).attr("data-post"),
          nume: $ep(el).attr("data-nume"),
          type: $ep(el).attr("data-type")
        });
      });

      for (const item of epItems.slice(0, 5)) {
        if (!item.post || !item.nume || (item.nume || "").includes("trailer")) continue;
        const embedUrl = await fetchEmbedUrl(BASE_URL, item.post, item.nume, item.type, targetEp.href);
        if (embedUrl && !embedUrl.includes("youtube")) {
          const resolvedUrl = await resolveEmbed(embedUrl, BASE_URL);
          if (resolvedUrl) {
            streams.push({
              url: resolvedUrl.url,
              quality: extractQuality(resolvedUrl.url),
              title: "MultiMovies",
              headers: resolvedUrl.headers, // Critical addition for stream playback authorization
              subtitles: []
            });
          }
        }
      }

      return streams;
    }

    // Movie: get player options directly
    const playerItems = [];
    $p("ul#playeroptionsul li").each((i, el) => {
      playerItems.push({
        post: $p(el).attr("data-post"),
        nume: $p(el).attr("data-nume"),
        type: $p(el).attr("data-type")
      });
    });

    for (const item of playerItems.slice(0, 5)) {
      if (!item.post || !item.nume || (item.nume || "").includes("trailer")) continue;
      const embedUrl = await fetchEmbedUrl(BASE_URL, item.post, item.nume, item.type, match.href);
      if (embedUrl && !embedUrl.includes("youtube")) {
        const resolvedUrl = await resolveEmbed(embedUrl, BASE_URL);
        if (resolvedUrl) {
          streams.push({
            url: resolvedUrl.url,
            quality: extractQuality(resolvedUrl.url),
            title: "MultiMovies",
            headers: resolvedUrl.headers, // Critical addition for stream playback authorization
            subtitles: []
          });
        }
      }
    }

    return streams;
  } catch (e) {
    console.error("[MultiMovies]", e);
    return [];
  }
}

async function fetchEmbedUrl(baseUrl, post, nume, type, referer) {
  try {
    const resp = await fetch(`${baseUrl}/wp-admin/admin-ajax.php`, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": referer
      },
      body: `action=doo_player_ajax&post=${post}&nume=${nume}&type=${type}`
    });
    const data = await resp.json();
    const embedUrl = data.embed_url || "";

    // Extract real URL from possible HTML iframe wrappers
    const srcMatch = embedUrl.match(/src="([^"]+)"/i) || embedUrl.match(/SRC="([^"]+)"/i);
    if (srcMatch) return srcMatch[1].trim();

    const urlMatch = embedUrl.match(/"(https?[^"]+)"/);
    if (urlMatch) return urlMatch[1].trim();

    return embedUrl.replace(/^"|"$/g, "").trim();
  } catch(e) {
    return null;
  }
}

async function resolveEmbed(url, referer) {
  if (!url || !url.startsWith("http")) return null;

  // Setup strict security context headers targeting the player environment
  const targetOrigin = url.includes("technocosmos.surf") ? "https://plyr.technocosmos.surf" : new URL(url).origin;
  const targetHeaders = {
    ...HEADERS,
    "Referer": url,
    "Origin": targetOrigin
  };

  // If it's already an active manifest stream link
  if (url.includes(".m3u8") || url.includes(".mp4") || url.includes("cf-master")) {
    return { url, headers: targetHeaders };
  }

  try {
    const resp = await fetch(url, { headers: { ...HEADERS, "Referer": referer } });
    const text = await resp.text();

    // 1. Matches your custom disguised master text file format (e.g., cf-master.1780990545.txt)
    const masterTxtMatch = text.match(/(https?:\/\/[^\s"']+\/cf-master\.[^\s"']+\.txt)/i);
    if (masterTxtMatch) {
      return { url: masterTxtMatch[1], headers: targetHeaders };
    }

    // 2. Fallback check for alternative platforms (e.g., deaddrive.xyz)
    if (url.includes("deaddrive.xyz")) {
      const $ = cheerio.load(text);
      const firstServer = $("ul.list-server-items > li").first().attr("data-video");
      if (firstServer) return { url: firstServer, headers: targetHeaders };
    }

    // 3. Fallback to standard formats
    const m3u8 = text.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i);
    if (m3u8) return { url: m3u8[1], headers: targetHeaders };

    const mp4 = text.match(/(https?:\/\/[^\s"']+\.mp4[^\s"']*)/i);
    if (mp4) return { url: mp4[1], headers: targetHeaders };

    return { url, headers: targetHeaders }; 
  } catch(e) {
    return { url, headers: targetHeaders };
  }
}

function extractQuality(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  if (u.includes("360p")) return "360p";
  return "Unknown";
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
