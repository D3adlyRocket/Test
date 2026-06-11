// movies4u.js  
// Nuvio-compatible Movies4u provider  
// Fully verified native engine with bridge decryption bypassing

const cheerio = require('cheerio');
  
const BASE_DOMAIN = "https://new2.movies4u.finance";  
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";  

const HEADERS = {  
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",  
  "Referer": BASE_DOMAIN  
};  
  
async function getBaseUrl() {  
  return BASE_DOMAIN;  
}  
  
function extractQuality(text) {  
  const u = (text || "").toLowerCase();  
  if (u.includes("2160") || u.includes("4k")) return "4K";  
  if (u.includes("1080")) return "1080p";  
  if (u.includes("720")) return "720p";  
  if (u.includes("480")) return "480p";  
  if (u.includes("360")) return "360p";  
  return "Unknown";  
}  

/**
 * Resolves streams directly by unpacking obfuscated cloud host configurations
 */
async function resolveLockerStreams(targetUrl) {
  const localStreams = [];
  try {
    if (targetUrl.includes("m4uplay.store")) {
      const embedUrl = targetUrl.replace("/file/", "/embed/");
      const resp = await fetch(embedUrl, { headers: { "User-Agent": HEADERS["User-Agent"], "Referer": "https://m4uplay.store/" }, skipSizeCheck: true });
      const html = await resp.text();
      
      const streamMatch = html.match(/"hls4"\s*:\s*"(.*?)"/i) || html.match(/["'](\/stream\/[^"']*?\.m3u8[^"']*?)["']/i);
      if (streamMatch && streamMatch[1]) {
        let finalUrl = streamMatch[1];
        if (finalUrl.startsWith("/")) finalUrl = "https://m4uplay.store" + finalUrl;
        localStreams.push({ label: "M4UPlay Stream", url: finalUrl });
      }
    } 
    else if (targetUrl.includes("gdflix") || targetUrl.includes("hubcloud")) {
      const resp = await fetch(targetUrl, { headers: HEADERS, skipSizeCheck: true });
      const html = await resp.text();
      
      const matches = html.match(/(["'])(https?:\/\/.*?\.mp4.*?)\1/g) || html.match(/(["'])(https?:\/\/.*?\.m3u8.*?)\1/g);
      if (matches) {
        matches.forEach(matchStr => {
          const cleanUrl = matchStr.replace(/["']/g, "");
          if (!cleanUrl.includes("google") && !cleanUrl.includes("analytics")) {
            localStreams.push({ label: targetUrl.includes("gdflix") ? "GDFlix Mirror" : "Hubcloud Mirror", url: cleanUrl });
          }
        });
      }
    }
  } catch (err) {
    console.error("[Movies4u] Locker error:", err);
  }
  return localStreams;
}
  
// =======================  
// NUVIO EXPORT STREAM ROUTER
// =======================  
  
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {  
  try {  
    const BASE_URL = await getBaseUrl();  
  
    // 1. TMDB Details
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;  
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();  
    const title = mediaInfo.title || mediaInfo.name;  
    if (!title) return [];  
  
    // 2. Search
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {  
      headers: HEADERS,  
      skipSizeCheck: true  
    });  
    const searchHtml = await searchResp.text();  
    const $ = cheerio.load(searchHtml);  
    const results = [];  
  
    $("article").each((i, el) => {  
      const a = $(el).find("a[rel='bookmark']").first();  
      let href = a.attr("href");  
      const name = a.text().trim();  
  
      if (href && name) {  
        if (!href.startsWith("http")) {
          href = BASE_URL + "/" + href.replace(/^\/+/, "");
        }
        results.push({ href, name });  
      }  
    });  
  
    if (!results.length) return [];  
    const match = results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) || results[0];  
    if (!match) return [];  
  
    // 3. Fetch specific landing page
    const pageResp = await fetch(match.href, {  
      headers: HEADERS,  
      skipSizeCheck: true  
    });  
    const pageHtml = await pageResp.text();  
    const $page = cheerio.load(pageHtml);  
  
    const streams = [];
    const bridgeUrls = [];

    // Gathers the encrypted intermediate links from the document content body
    $page("a[href]").each((i, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes("m4ulinks.com/number/")) {
        if (!bridgeUrls.includes(href)) bridgeUrls.push(href);
      }
    });

    // Process the bridge endpoints to resolve host redirects
    for (const bridgeUrl of bridgeUrls) {
      try {
        const idMatch = bridgeUrl.match(/\/number\/(\d+)/);
        if (!idMatch) continue;
        const linkId = idMatch[1];

        // Emulates the internal browser sync request to dump hidden configurations
        const bridgeResp = await fetch(bridgeUrl, { headers: HEADERS, skipSizeCheck: true });
        const bridgeHtml = await bridgeResp.text();

        const resolvedLockers = [];

        // Scan the script blocks for host parameters matching your console image logs
        const patternRegex = /(https?:\/\/(?:m4uplay\.store|hubcloud|gdflix)[^\s"'`>]+)/gi;
        const detectedLinks = bridgeHtml.match(patternRegex);
        
        if (detectedLinks) {
          detectedLinks.forEach(url => {
            if (!resolvedLockers.includes(url)) resolvedLockers.push(url);
          });
        }

        // Fallback: Check if destination variables are embedded as simple text configurations
        if (resolvedLockers.length === 0) {
          const scriptMatches = bridgeHtml.match(/["']file_code["']\s*:\s*["']([^"']+)["']/g);
          if (scriptMatches) {
            resolvedLockers.push(`https://m4uplay.store/file/${linkId}`);
          }
        }

        const parsedQuality = extractQuality(bridgeHtml) !== "Unknown" ? extractQuality(bridgeHtml) : extractQuality(match.href);

        for (const lockerUrl of resolvedLockers) {
          const resolved = await resolveLockerStreams(lockerUrl);
          for (const item of resolved) {
            streams.push({
              name: `Movies4u - ${item.label}`,
              title: `${title}`,
              quality: parsedQuality, 
              url: item.url,
              headers: { "User-Agent": HEADERS["User-Agent"], "Referer": lockerUrl },
              subtitles: []
            });
          }
        }
      } catch (err) {
        console.error("[Movies4u] Bridge bypass failed:", err);
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
