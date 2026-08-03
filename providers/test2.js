// 1show.js - Configured with 1show.org endpoint and working TV layout engine

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const DOMAINS_URL = "https://raw.githubusercontent.com/sapariyaneel/nuvio-plugin/refs/heads/main/domains.json";
const FALLBACK_API_HOST = "https://api.1show.org"; 
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": "https://1show.org/",
  "Origin": "https://1show.org"
};

let cachedDomains = null;

async function getDomains() {
  if (cachedDomains) return cachedDomains;
  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    cachedDomains = await resp.json();
  } catch (_) {
    cachedDomains = {};
  }
  return cachedDomains;
}

async function getApiHost() {
  const d = await getDomains();
  return (d["1show"] || d["api.1show.org"] || FALLBACK_API_HOST).replace(/\/+$/, "");
}

/* ========================================================================== */
/*                    ZERO-WIDTH INVERTED SORTING ENGINE                      */
/* ========================================================================== */

function getInvertedSortTag(val, maxBaseline = 999999) {
  const safeVal = Math.max(0, parseInt(val, 10) || 0);
  const inverted = Math.max(0, maxBaseline - safeVal);
  const binaryStr = inverted.toString(2).padStart(20, '0');
  return binaryStr.split('').map(bit => bit === '1' ? "\uFEFF" : "\u200B").join('');
}

function getQualityRank(res) {
  const clean = String(res || '').toLowerCase();
  if (clean.includes("2160") || clean.includes("4k") || clean.includes("uhd")) return 4;
  if (clean.includes("1080") || clean.includes("fhd") || clean.includes("fullhd")) return 3;
  if (clean.includes("720") || clean.includes("hd")) return 2;
  if (clean.includes("480") || clean.includes("sd") || clean.includes("360")) return 1;
  return 0;
}

function parseSizeToMB(sizeStr) {
  if (!sizeStr || sizeStr === "N/A" || sizeStr === "Unknown") return 0;
  const match = String(sizeStr).match(/([\d.]+)\s*(GB|MB)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === "GB") return Math.floor(num * 1024);
  if (unit === "MB") return Math.floor(num);
  return 0;
}

/* ========================================================================== */
/*                           METADATA & HELPERS                               */
/* ========================================================================== */

function getResolutionEmoji(res) {
  const clean = String(res || '').toLowerCase();
  if (clean.includes("2160") || clean.includes("4k") || clean.includes("uhd")) return "🌟 4K";
  if (clean.includes("1080") || clean.includes("fhd")) return "🔥 1080p";
  if (clean.includes("720") || clean.includes("hd")) return "💎 720p";
  if (clean.includes("480") || clean.includes("sd")) return "📱 480p";
  return "📺 " + (res || "1080p");
}

async function getTmdbMetadata(tmdbId, mediaType) {
  try {
    const type = mediaType === "tv" ? "tv" : "movie";
    const resp = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`, { skipSizeCheck: true });
    const meta = await resp.json();
    const title = type === "tv" ? meta.name : meta.title;
    const releaseDate = type === "tv" ? meta.first_air_date : meta.release_date;
    const year = releaseDate ? releaseDate.split("-")[0] : "";
    return { title, year };
  } catch (_) {
    return { title: "", year: "" };
  }
}

function qualityLabelFromHeight(height) {
  if (height >= 2000) return "4K";
  if (height <= 0) return "1080p";
  return `${height}p`;
}

/* ========================================================================== */
/*                          STREAM LAYOUT ENGINE                              */
/* ========================================================================== */

function makeStream(url, quality, displaySize, title, year, mediaType, season, episode, subtitles) {
  const qualityRank = getQualityRank(quality);
  const sizeInMB = parseSizeToMB(displaySize);
  
  const sortTag = getInvertedSortTag((qualityRank * 100000) + sizeInMB, 999999);

  const lineResTag = getResolutionEmoji(quality);
  const cleanTitle = (title || "").replace(/[^a-zA-Z0-9]/g, ".");
  const isTvSeries = mediaType === "tv";
  const sNum = season || 1;
  const eNum = episode || 1;

  const filenameStr = isTvSeries 
    ? `${cleanTitle}.S${String(sNum).padStart(2, '0')}E${String(eNum).padStart(2, '0')}.${quality}.WEB-DL.MKV`
    : `${cleanTitle}.${year || '2026'}.${quality}.WEB-DL.MKV`;

  const line1 = isTvSeries
    ? `🎬 ${title}${year ? ` (${year})` : ""} | S${sNum}E${eNum}`
    : `🎬 ${title}${year ? ` (${year})` : ""}`;
    
  const line2 = `${lineResTag} | 💾 ${displaySize}`;
  const line3 = `🎞️ MKV`;
  const line4 = `🌐 1Show.org`;
  const line5 = filenameStr;

  const headerLayout = `${sortTag}1Show • ${quality}`;
  const fullLayout = [line1, line2, line3, line4, line5].join("\n");

  return {
    qualityRank,
    sizeInMB,
    data: {
      name: headerLayout,
      title: fullLayout,
      description: fullLayout,
      url: url,
      size: displaySize,
      subtitles: subtitles || [],
      behaviorHints: {
        notWebReady: true
      }
    }
  };
}

/* ========================================================================== */
/*                           MAIN PROVIDER LOGIC                              */
/* ========================================================================== */

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    let numericTmdbId = tmdbId;
    if (typeof tmdbId === "string" && tmdbId.trim().toLowerCase().startsWith("tt")) {
      const findUrl = `https://api.themoviedb.org/3/find/${tmdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const findData = await (await fetch(findUrl, { skipSizeCheck: true })).json();
      const results = mediaType === "tv" ? findData.tv_results : findData.movie_results;
      numericTmdbId = results && results.length ? results[0].id : null;
      if (!numericTmdbId) return [];
    }
    numericTmdbId = parseInt(numericTmdbId, 10);
    if (!numericTmdbId) return [];

    const { title, year } = await getTmdbMetadata(numericTmdbId, mediaType);
    const apiHost = await getApiHost();
    const isTv = mediaType === "tv";
    
    const requestBody = {
      mediaType: isTv ? "tv" : "movie",
      id: String(numericTmdbId)
    };
    if (isTv) {
      requestBody.season = season || 1;
      requestBody.episode = episode || 1;
    }

    const resp = await fetch(`${apiHost}/api/get-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...HEADERS },
      body: JSON.stringify(requestBody),
      skipSizeCheck: true
    });

    if (!resp.ok) return [];
    const data = await resp.json().catch(() => null);
    
    if (!data || !data.streams) return [];

    const streamsList = [];
    for (const item of data.streams) {
      if (!item.url) continue;
      
      const quality = qualityLabelFromHeight(item.height || 1080);
      const displaySize = item.size || "Unknown";

      const streamObj = makeStream(
        item.url,
        quality,
        displaySize,
        title || "Unknown Title",
        year || "2026",
        mediaType,
        season,
        episode,
        item.subtitles
      );

      streamsList.push(streamObj.data);
    }

    return streamsList;
  } catch (e) {
    console.error("[1Show.org]", e);
    return [];
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
