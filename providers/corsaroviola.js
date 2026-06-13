const cheerio = require('cheerio-without-node-native');
// multimovies.js
// MultiMovies - Hindi/Bollywood/Anime provider via WordPress player iframe extraction

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

    // Step 1: Resolve Title from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Step 2: Search MultiMovies Entry
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, { headers: HEADERS });
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

    // Step 3: Load Content Landing Page
    const pageResp = await fetch(match.href, { headers: HEADERS });
    const pageHtml = await pageResp.text();
    const $p = cheerio.load(pageHtml);

    let targetUrl = match.href;

    // Handle TV Series Structure routing down to specific episodes
    if (!isMovie && mediaType === "tv") {
      const episodes = [];
      $p("#seasons ul.episodios").each((sIdx, sList) => {
        const seasonNum = sIdx + 1;
        $p(sList).find("li").each((eIdx, epEl) => {
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
      targetUrl = targetEp.href;
    }

    // Step 4: Extract embedded Player sources directly from DOM
    // This bypasses broken AJAX POST actions by tracking iframes directly
    const contentResp = await fetch(targetUrl, { headers: HEADERS });
    const contentHtml = await contentResp.text();
    const $c = cheerio.load(contentHtml);

    const playerUrls = [];

    // Extract raw iframes
    $c("iframe").each((i, el) => {
      const src = $c(el).attr("src") || $c(el).attr("data-src");
      if (src && src.startsWith("http")) playerUrls.push(src);
    });

    // Fallback extract alternative player setups embedded in custom DOM elements
    $c("ul#playeroptionsul li").each((i, el) => {
      const embedCode = $c(el).attr("data-embed") || "";
      const srcMatch = embedCode.match(/src="([^"]+)"/i) || embedCode.match(/SRC="([^"]+)"/i);
      if (srcMatch && srcMatch[1].startsWith("http")) {
        playerUrls.push(srcMatch[1].trim());
      }
    });

    const streams = [];

    // Step 5: Process and decrypt target player streams
    for (const url of playerUrls.slice(0, 6)) {
      if (url.includes("youtube.com") || url.includes("youtu.be")) continue;

      const streamResult = await resolveEmbed(url, targetUrl);
      if (streamResult) {
        streams.push({
          url: streamResult.url,
          quality: extractQuality(streamResult.url),
          title: streamResult.title,
          headers: streamResult.headers, // Critical payload authorization headers parsed from your intercepts
          subtitles: []
        });
      }
    }

    return streams;
  } catch (e) {
    console.error("[MultiMovies Engine Failure]", e);
    return [];
  }
}

async function resolveEmbed(embedUrl, parentReferer) {
  try {
    // Standard contextual handshake setup
    const initialHeaders = { ...HEADERS, "Referer": parentReferer };
    const resp = await fetch(embedUrl, { headers: initialHeaders });
    const text = await resp.text();

    // The definitive collection of regex patterns matching your captured endpoints
    const patterns = [
      {
        name: "MultiMovies Native",
        regex: /(https?:\/\/multimovieshg\.com\/stream\/[^\s"']+)/i,
        headerGenerator: (url) => ({ "Referer": "https://multimovieshg.com/" })
      },
      {
        name: "SmoothPre Mirror",
        regex: /(https?:\/\/smoothpre\.com\/stream\/[^\s"']+)/i,
        headerGenerator: (url) => ({ "Referer": "https://smoothpre.com/" })
      },
      {
        name: "SprintCDN Edge",
        regex: /(https?:\/\/[^\s"']+\.sprintcdn\.[^\s"']+\/master\.m3u8[^\s"']*)/i,
        headerGenerator: (url) => ({ "Referer": "https://nzn3.org/", "Origin": "https://nzn3.org" })
      },
      {
        name: "Obfuscated Master",
        regex: /(https?:\/\/[^\s"']+\/cf-master\.[^\s"']+\.txt)/i,
        headerGenerator: (url) => ({ "Referer": embedUrl, "Origin": new URL(embedUrl).origin })
      },
      {
        name: "Global Manifest Fallback",
        regex: /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i,
        headerGenerator: (url) => ({ "Referer": embedUrl })
      }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const streamUrl = match[1];
        return {
          url: streamUrl,
          title: pattern.name,
          headers: {
            ...HEADERS,
            ...pattern.headerGenerator(streamUrl)
          }
        };
      }
    }

    // Direct fallback if embedUrl itself is an exposed direct link
    if (embedUrl.includes(".m3u8") || embedUrl.includes(".mp4")) {
      return {
        url: embedUrl,
        title: "Direct Embed Link",
        headers: { ...HEADERS, "Referer": parentReferer }
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

function extractQuality(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p") || u.includes("index-f1") || u.includes("master.m3u8")) return "1080p"; 
  if (u.includes("720p") || u.includes("index-f2")) return "720p";
  if (u.includes("480p")) return "480p";
  if (u.includes("360p")) return "360p";
  return "Auto Quality";
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
