// movies4u.js  
// Fixed Nuvio-compatible Movies4u provider with Custom 4-Line Layout  

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
  
function extractQuality(text) {  
  const u = (text || "").toLowerCase();  
  if (u.includes("2160") || u.includes("4k") || u.includes("uhd")) return "4K";  
  if (u.includes("1080")) return "1080p";  
  if (u.includes("720")) return "720p";  
  if (u.includes("480")) return "480p";  
  if (u.includes("360")) return "360p";  
  return "Unknown";  
}  

// ✅ FIXED: REAL M3U8 QUALITY DETECTOR
async function detectM3U8Quality(url, headers = {}) {
  try {
    const resp = await fetch(url, { headers, skipSizeCheck: true });
    const text = await resp.text();

    const matches = [...text.matchAll(/RESOLUTION=(\d+)x(\d+)/g)];

    if (matches.length) {
      let best = { h: 0 };

      for (const m of matches) {
        const h = parseInt(m[2]);
        if (h > best.h) best = { h };
      }

      if (best.h >= 2160) return "4K";
      if (best.h >= 1080) return "1080p";
      if (best.h >= 720) return "720p";
      if (best.h >= 480) return "480p";
      return "SD";
    }

    return extractQuality(url);
  } catch {
    return null;
  }
}

// Helper to extract tech properties
function parseExtraMetadata(text) {
  const norm = (text || "").toUpperCase();
  
  let lang = "Multi-Audio"; 
  if (norm.includes("DUAL")) lang = "Multi Audio";
  if (norm.includes("ENGLISH") && !norm.includes("HINDI")) lang = "English";
  
  const sizeMatch = norm.match(/(\d+(?:\.\d+)?\s*[MGB]B)/i);
  let size = sizeMatch ? sizeMatch[0].replace(/\s+/g, "") : "N/A";
  
  if (size === "N/A") {
    const backupMatch = norm.match(/(\d+\.\d+)\s?G/);
    if (backupMatch) size = backupMatch[1] + "GB";
  }
  
  let format = "MKV";
  if (norm.includes("MP4")) format = "MP4";
  if (norm.includes("HEVC") || norm.includes("X265")) format += " (x265)";
  else if (norm.includes("X264")) format += " (x264)";

  const extras = [];
  if (norm.includes("HDR")) extras.push("HDR");
  if (norm.includes("DOLBY") || norm.includes("ATMOS")) extras.push("Dolby Vision/5.1");
  if (norm.includes("10BIT")) extras.push("10-Bit");
  if (norm.includes("REMUX")) extras.push("Remux");
  
  return {
    language: lang,
    size,
    format,
    extras: extras.length ? extras.join(" | ") : "Standard Dynamic Range"
  };
}

function cleanServerName(serverText) {
  if (!serverText) return "HubCloud";
  let clean = serverText.toLowerCase();

  if (clean.includes("fsl")) return "FSL Server";
  if (clean.includes("pixel")) return "PixelDrain";
  if (clean.includes("drive")) return "Cloud Drive";

  clean = clean.replace(/download|links?|button|server|\s+/gi, " ").trim();
  clean = clean.replace(/[\[\]\(\)]/g, "").trim(); 

  return clean.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') + " Server";
}

async function resolveAllHubCloudLinks(url) {
  try {
    const apiURL = `${HUB_CLOUD_API}/api/extract?url=${encodeURIComponent(url)}`;
    const resp = await fetch(apiURL, { headers: { Accept: "application/json" } });
    const data = await resp.json();
    return data.links || [];
  } catch {
    return [];
  }
}

async function extractDirectM3u8(playerUrl) {
  try {
    const resp = await fetch(playerUrl, {
      headers: { ...HEADERS, Referer: "https://m4uplay.store/" }
    });

    const html = await resp.text();

    return (
      html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
      html.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0] ||
      null
    )?.replace("master.txt", "master.m3u8");

  } catch {
    return null;
  }
}

// =======================  
// STREAM ROUTER
// =======================  

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {  
  try {  
    const BASE_URL = await getBaseUrl();  

    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;  
    const mediaInfo = await (await fetch(tmdbUrl)).json();  

    const title = mediaInfo.title || mediaInfo.name;  
    if (!title) return [];  

    const releaseYear = (mediaInfo.release_date || mediaInfo.first_air_date || "").split("-")[0] || "N/A";  
    const runTime = mediaInfo.runtime ? `${mediaInfo.runtime} min` : "N/A";  

    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, { headers: HEADERS });  
    const searchHtml = await searchResp.text();  
    const $ = cheerio.load(searchHtml);  

    const results = [];  
    $("article").each((_, el) => {  
      const a = $(el).find("a").first();  
      const href = a.attr("href");  
      const name = a.text().trim();  
      if (href && name) results.push({ href, name });  
    });  

    if (!results.length) return [];  

    const match = results[0];  

    const pageResp = await fetch(match.href, { headers: HEADERS });  
    const pageHtml = await pageResp.text();  
    const $page = cheerio.load(pageHtml);  

    const streams = [];  

    const links = [];  
    $page("a[href*='m4uplay.store']").each((_, el) => {
      links.push({
        href: $(el).attr("href"),
        text: $(el).text()
      });
    });

    for (const l of links) {
      const direct = await extractDirectM3u8(l.href);
      if (!direct) continue;

      const urlMeta = parseExtraMetadata(direct);
      const detected = await detectM3U8Quality(direct, {
        Referer: "https://m4uplay.store/"
      });

      const finalQuality =
        detected ||
        extractQuality(l.text + direct) ||
        "1080p";

      streams.push({
        name: `Movies4u | ${finalQuality}`,
        title: `${title} (${releaseYear})`,
        quality: finalQuality,
        url: direct,
        headers: { Referer: "https://m4uplay.store/" }
      });
    }

    streams.sort((a, b) => {
      const w = { "4K": 100, "1080p": 80, "720p": 60, "480p": 40 };
      return (w[b.quality] || 0) - (w[a.quality] || 0);
    });

    return streams;

  } catch (e) {
    console.error(e);
    return [];
  }
}

module.exports = { getStreams };
