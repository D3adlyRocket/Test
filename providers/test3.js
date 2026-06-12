// movies4u.js  
// Nuvio-compatible Movies4u provider  
// Pivot Engine: Targeting Live Hubcloud & GDFlix Assets Directly

const cheerio = require('cheerio');
  
const BASE_DOMAIN = "https://new2.movies4u.finance";  
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";  

const HEADERS = {  
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",  
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
  return "720p";  
}  

/**
 * Scrapes direct downloadable video streams straight out of Hubcloud or GDFlix HTML wrappers
 */
async function resolveCloudLocker(url) {
  const links = [];
  try {
    const resp = await fetch(url, { headers: { "User-Agent": HEADERS["User-Agent"] }, skipSizeCheck: true });
    const html = await resp.text();
    
    // Look for real video download attributes or raw media stream links (.mp4 or .m3u8)
    const matches = html.match(/(["'])(https?:\/\/.*?\.(?:mp4|m3u8)[^"']*?)\1/gi);
    if (matches) {
      matches.forEach(m => {
        const clean = m.replace(/["']/g, "");
        if (!clean.includes("analytics") && !clean.includes("google")) {
          links.push(clean);
        }
      });
    }
  } catch (e) {
    console.error("Locker processing error:", e);
  }
  return links;
}
  
// =======================  
// NUVIO STREAM ROUTER ENTRY
// =======================  
  
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {  
  try {  
    const BASE_URL = await getBaseUrl();  
  
    // 1. Resolve TMDB Details
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;  
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();  
    const title = mediaInfo.title || mediaInfo.name;  
    if (!title) return [];  
  
    // 2. Query Movies4u Site Index
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, { headers: HEADERS, skipSizeCheck: true });  
    const searchHtml = await searchResp.text();  
    const $ = cheerio.load(searchHtml);  
    const results = [];  
  
    $("article").each((i, el) => {  
      const a = $(el).find("a[rel='bookmark']").first();  
      let href = a.attr("href");  
      const name = a.text().trim();  
      if (href && name) results.push({ href, name });  
    });  
  
    if (!results.length) return [];  
    const match = results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) || results[0];  
  
    // 3. Process the Movie Landing Page
    const pageResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });  
    const pageHtml = await pageResp.text();  
    const $page = cheerio.load(pageHtml);  
  
    const streams = [];
    const bridgeUrls = [];

    // Extract out the active transit redirects pointing to m4ulinks
    $page("a[href]").each((i, el) => {
      const href = $page(el).attr("href") || "";
      if (href.includes("m4ulinks.com/number/")) {
        if (!bridgeUrls.includes(href)) bridgeUrls.push(href);
      }
    });

    // 4. Trace the bridge pages to harvest active cloud instances
    for (const bridgeUrl of bridgeUrls) {
      try {
        const bridgeResp = await fetch(bridgeUrl, { headers: HEADERS, skipSizeCheck: true });
        const bridgeHtml = await bridgeResp.text();

        // Regex pattern designed to immediately match the real .foo and .dev lockers present in the HTML output
        const lockerRegex = /(https?:\/\/(?:hubcloud|gdflix)\.[a-z0-9]{2,6}\/[^\s"'`>]+)/gi;
        const foundLockers = bridgeHtml.match(lockerRegex) || [];
        const uniqueLockers = [...new Set(foundLockers)];

        const quality = extractQuality(bridgeHtml);

        for (const lockerUrl of uniqueLockers) {
          const directUrls = await resolveCloudLocker(lockerUrl);
          
          directUrls.forEach(videoUrl => {
            const hostLabel = lockerUrl.includes("gdflix") ? "GDFlix FastMirror" : "Hubcloud CloudPlay";
            streams.push({
              name: `Movies4u - ${hostLabel}`,
              title: title,
              quality: quality, 
              url: videoUrl,
              headers: { "User-Agent": HEADERS["User-Agent"], "Referer": lockerUrl },
              subtitles: []
            });
          });
        }
      } catch (err) {
        console.error("Bridge tracking exception:", err);
      }
    }  
    return streams;  
  
  } catch (e) {  
    console.error("[Movies4u Fatal Error]", e);  
    return [];  
  }  
}  
  
module.exports = { getStreams };
