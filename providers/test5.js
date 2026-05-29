// movies4u.js  
// Fixed Nuvio-compatible Movies4u provider (FIXED QUALITY SYSTEM)

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const HUB_CLOUD_API = "https://hc-zf3c.vercel.app";

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

/**
 * ONLY text-based quality detection (SAFE SOURCE)
 */
function extractQuality(text) {
  const u = (text || "").toLowerCase();

  if (u.includes("2160") || u.includes("4k") || u.includes("uhd")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";

  return "Unknown";
}

/**
 * FIXED: single source of truth for resolution
 */
function resolveQuality(...sources) {
  for (const s of sources) {
    const q = extractQuality(s);
    if (q !== "Unknown") return q;
  }
  return "Unknown";
}

function parseExtraMetadata(text) {
  const norm = (text || "").toUpperCase();

  let lang = "Multi-Audio";
  if (norm.includes("DUAL")) lang = "Multi Audio";
  if (norm.includes("ENGLISH") && !norm.includes("HINDI")) lang = "English";

  const sizeMatch = norm.match(/(\d+(?:\.\d+)?\s*[MGB]B)/i);
  let size = sizeMatch ? sizeMatch[0].replace(/\s+/g, "") : "N/A";

  let format = "MKV";
  if (norm.includes("MP4")) format = "MP4";
  if (norm.includes("HEVC") || norm.includes("X265")) format += " (x265)";
  else if (norm.includes("X264")) format += " (x264)";

  return {
    language: lang,
    size,
    format,
    extras: "Standard Dynamic Range"
  };
}

function cleanServerName(serverText) {
  if (!serverText) return "HubCloud";
  let clean = serverText.toLowerCase();

  if (clean.includes("fsl")) return "FSL Server";
  if (clean.includes("pixel")) return "PixelDrain";
  if (clean.includes("drive")) return "Cloud Drive";

  return "HubCloud Server";
}

async function resolveAllHubCloudLinks(hubCloudUrl) {
  try {
    const apiURL = `${HUB_CLOUD_API}/api/extract?url=${encodeURIComponent(hubCloudUrl)}`;
    const resp = await fetch(apiURL, {
      headers: { Accept: "application/json" },
      skipSizeCheck: true
    });
    const data = await resp.json();
    return data?.links || [];
  } catch {
    return [];
  }
}

async function extractDirectM3u8(playerUrl) {
  try {
    const resp = await fetch(playerUrl, {
      headers: { ...HEADERS, Referer: "https://m4uplay.store/" },
      skipSizeCheck: true
    });

    const html = await resp.text();

    let m3u8 =
      html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
      html.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];

    if (!m3u8) return null;

    return m3u8.replace("master.txt", "master.m3u8");
  } catch {
    return null;
  }
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    const releaseYear = (mediaInfo.release_date || mediaInfo.first_air_date || "").split("-")[0] || "N/A";
    const runTime = mediaInfo.runtime ? `${mediaInfo.runtime} min` : "N/A";

    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {
      headers: HEADERS
    });

    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];

    $("article").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href");
      const name = a.text().trim();

      if (href && name) {
        results.push({ href, name });
      }
    });

    const match =
      results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) ||
      results[0];

    if (!match) return [];

    const pageResp = await fetch(match.href, { headers: HEADERS });
    const pageHtml = await pageResp.text();
    const $page = cheerio.load(pageHtml);

    const rawStreamsList = [];

    const directWatchLinks = [];
    $page("a[href*='m4uplay.store']").each((_, el) => {
      directWatchLinks.push({
        href: $(el).attr("href"),
        text: $(el).text()
      });
    });

    for (const item of directWatchLinks) {
      const directM3u8 = await extractDirectM3u8(item.href);
      if (!directM3u8) continue;

      const quality = resolveQuality(
        item.text,
        item.href,
        match.name
      );

      rawStreamsList.push({
        server: "Player Direct",
        quality: quality === "Unknown" ? "1080p" : quality,
        meta: parseExtraMetadata(item.text + match.name),
        url: directM3u8,
        headers: {
          Referer: "https://m4uplay.store/",
          Origin: "https://m4uplay.store",
          "User-Agent": HEADERS["User-Agent"]
        }
      });
    }

    const qualityWeights = {
      "4K": 100,
      "1080p": 50,
      "720p": 25,
      "480p": 10,
      "360p": 5,
      "Unknown": 0
    };

    rawStreamsList.sort(
      (a, b) =>
        (qualityWeights[b.quality] || 0) - (qualityWeights[a.quality] || 0)
    );

    return rawStreamsList.map(stream => {
      const epInfo = mediaType === "series" ? ` - S${season || 1}E${episode || 1}` : "";

      return {
        name: `Movies4u | ${stream.quality} | [${stream.server}]`,
        title: `🎬 ${title}${epInfo} - ${releaseYear}
⚡ ${stream.quality} | 🌍 ${stream.meta.language} | 💾 ${stream.meta.size}
🎞️ ${stream.meta.format} | ⏱️ ${runTime}`,
        quality: stream.quality,
        url: stream.url,
        headers: stream.headers,
        subtitles: []
      };
    });

  } catch (e) {
    console.error("[Movies4u FIXED ERROR]", e);
    return [];
  }
}

module.exports = { getStreams };
