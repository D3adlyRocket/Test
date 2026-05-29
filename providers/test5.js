// movies4u.js  
// Fixed Nuvio-compatible Movies4u provider with Custom 4-Line Layout  

const cheerio = require("cheerio");

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

// -------------------- QUALITY ENGINE (FIXED) --------------------

function extractQuality(text) {
  const u = (text || "").toLowerCase();

  if (/\b2160p\b|\b4k\b|\buhd\b/.test(u)) return "4K";
  if (/\b1080p\b/.test(u)) return "1080p";
  if (/\b720p\b/.test(u)) return "720p";
  if (/\b480p\b/.test(u)) return "480p";
  if (/\b360p\b/.test(u)) return "360p";

  return "Unknown";
}

// -------------------- M3U8 QUALITY PARSER (NEW CORE FIX) --------------------

async function parseM3U8Quality(url, headers = {}) {
  try {
    const resp = await fetch(url, {
      headers,
      skipSizeCheck: true
    });

    const text = await resp.text();

    const matches = [...text.matchAll(/RESOLUTION=(\d+)x(\d+)/g)];

    if (!matches.length) return null;

    let best = { w: 0, h: 0 };

    for (const m of matches) {
      const w = parseInt(m[1]);
      const h = parseInt(m[2]);

      if (w * h > best.w * best.h) {
        best = { w, h };
      }
    }

    const height = best.h;

    if (height >= 2160) return "4K";
    if (height >= 1080) return "1080p";
    if (height >= 720) return "720p";
    if (height >= 480) return "480p";

    return "Unknown";
  } catch {
    return null;
  }
}

// -------------------- META ENGINE --------------------

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
  if (norm.includes("HEVC") || norm.includes("X265") || norm.includes("H265")) format += " (x265)";
  else if (norm.includes("X264") || norm.includes("H264")) format += " (x264)";

  const extras = [];
  if (norm.includes("HDR")) extras.push("HDR");
  if (norm.includes("ATMOS") || norm.includes("DOLBY")) extras.push("Dolby");
  if (norm.includes("10BIT")) extras.push("10-Bit");
  if (norm.includes("REMUX")) extras.push("Remux");

  return {
    language: lang,
    size,
    format,
    extras: extras.length ? extras.join(" | ") : "Standard"
  };
}

// -------------------- HUBCLOUD CLEANER --------------------

function cleanServerName(serverText) {
  if (!serverText) return "HubCloud";

  let clean = serverText.toLowerCase();

  if (clean.includes("fsl") || clean.includes("fast")) return "FSL Server";
  if (clean.includes("pixel")) return "PixelDrain";

  clean = clean.replace(/download|links?|button|server|\s+/gi, " ").trim();
  clean = clean.replace(/[\[\]\(\)]/g, "").trim(); 

  return clean.split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") + " Server";
}

// -------------------- HUB RESOLVER --------------------

async function resolveAllHubCloudLinks(hubCloudUrl) {
  try {
    const apiURL = `${HUB_CLOUD_API}/api/extract?url=${encodeURIComponent(hubCloudUrl)}`;
    const resp = await fetch(apiURL, {
      headers: { "Accept": "application/json" },
      skipSizeCheck: true
    });
    const data = await resp.json();
    return data?.links || [];
  } catch {
    return [];
  }
}

// -------------------- DIRECT M3U8 --------------------

async function extractDirectM3u8(playerUrl) {
  try {
    const resp = await fetch(playerUrl, {
      headers: { ...HEADERS, Referer: "https://m4uplay.store/" },
      skipSizeCheck: true
    });

    const html = await resp.text();

    return (
      html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
      null
    );
  } catch {
    return null;
  }
}

// -------------------- STREAM ENGINE --------------------

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

    const $ = cheerio.load(await searchResp.text());  
    const results = [];  

    $("article").each((_, el) => {  
      const a = $(el).find("a").first();  
      const href = a.attr("href");  
      const name = a.text().trim();  

      if (href && name) {
        results.push({ href, name });
      }
    });  

    const match = results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) || results[0];  
    if (!match) return [];  

    const pageHtml = await (await fetch(match.href, { headers: HEADERS })).text();  
    const $page = cheerio.load(pageHtml);  

    const rawStreamsList = [];

    const links = [];

    // tighter DOM context (IMPORTANT FIX)
    $page("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text() || "";

      if (href.includes("m4uplay.store") || href.includes("hubcloud")) {
        links.push({ href, text });
      }
    });

    for (const l of links) {

      const direct = await extractDirectM3u8(l.href);

      if (direct) {

        const m3u8Quality = await parseM3U8Quality(direct, {
          Referer: "https://m4uplay.store/"
        });

        const meta = parseExtraMetadata(l.text);

        rawStreamsList.push({
          server: "M4U Player",
          quality: m3u8Quality || extractQuality(l.text) || "1080p",
          meta,
          url: direct,
          headers: {
            Referer: "https://m4uplay.store/",
            Origin: "https://m4uplay.store",
            "User-Agent": HEADERS["User-Agent"]
          }
        });
      }
    }

    // SORT
    const weights = { "4K": 100, "1080p": 50, "720p": 25, "480p": 10, "360p": 5 };
    rawStreamsList.sort((a, b) => (weights[b.quality] || 0) - (weights[a.quality] || 0));

    return rawStreamsList.map(s => ({
      name: `Movies4u | ${s.quality} | [${s.server}]`,
      title: `🎬 ${title} - ${releaseYear}\n⚡ ${s.quality} | 🌍 ${s.meta.language} | 💾 ${s.meta.size}\n🎞️ ${s.meta.format} | ⏱️ ${runTime}`,
      quality: s.quality,
      url: s.url,
      headers: s.headers,
      subtitles: []
    }));

  } catch (e) {
    console.error("[Movies4u Code Error]", e);
    return [];
  }  
}  

module.exports = { getStreams };
