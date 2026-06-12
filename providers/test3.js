// movies4u.js  
// Nuvio-compatible Movies4u provider  
// Authenticated Session Engine - Powered by Live DevTools Cookie Sync

const cheerio = require('cheerio');
  
const BASE_DOMAIN = "https://new2.movies4u.finance";  
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";  

// Your verified browser session authorization token block
const MY_BROWSER_COOKIE = "_ga=GA1.1.2135254525.1781217316; _ym_uid=1781217317890235155; _ym_d=1781217317; _ym_isad=1; _ym_visorc=b; lang=1; _ga_48ZJD1VPGZ=GS2.1.s1781220570$o2$g1$t1781225849$j33$l0$h0; _ga_8WRLTXV0TK=GS2.1.s1781220570$o2$g1$t1781225849$j33$l0$h0";

const BROWSER_HEADERS = {  
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",  
  "Accept": "*/*",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  "Referer": "https://m4uplay.store/",
  "Origin": "https://m4uplay.store",
  "Cookie": MY_BROWSER_COOKIE // Masquerades the backend scraper as your live verified device window
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
  return "720p";  
}  

/**
 * Reverses Dean Edwards JavaScript obfuscation blocks programmatically
 */
function unpackJavascript(packedCode) {
  try {
    const pattern = /eval\(function\(p,a,c,k,e,d\).*?return p\}.*?\('(.*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(.*?)'\.split\('|'\)/s;
    const matches = packedCode.match(pattern);
    if (!matches) return packedCode;

    let [_, p, a, c, k] = matches;
    a = parseInt(a, 10);
    c = parseInt(c, 10);
    k = k.split('|');

    const e = (c) => (c < a ? '' : e(Math.floor(c / a))) + String.fromCharCode(c % a + 29);
    
    while (c--) {
      if (k[c]) {
        const regex = new RegExp('\\b' + e(c) + '\\b', 'g');
        p = p.replace(regex, k[c]);
      }
    }
    return p;
  } catch (err) {
    return packedCode;
  }
}

/**
 * Resolves streams by mimicking the verified player context configurations
 */
async function resolveLockerStreams(targetUrl) {
  const localStreams = [];
  try {
    if (targetUrl.includes("m4uplay.store")) {
      const tokenMatch = targetUrl.match(/\/file\/([a-zA-Z0-9]+)/) || targetUrl.match(/\/embed\/([a-zA-Z0-9]+)/);
      if (!tokenMatch) return [];
      const fileCode = tokenMatch[1];

      const embedUrl = `https://m4uplay.store/embed/${fileCode}`;
      const resp = await fetch(embedUrl, { headers: BROWSER_HEADERS, skipSizeCheck: true });
      const html = await resp.text();
      
      // Force unpack any client-side JavaScript restrictions hidden on the page layout
      const unpackedHtml = unpackJavascript(html);

      // Extract the absolute master stream targets verified by your network logs
      const streamMatch = unpackedHtml.match(/["'](https?:\/\/m4uplay\.store\/stream\/[^"']*?\.m3u8[^"']*?)["']/i) ||
                          unpackedHtml.match(/["'](\/stream\/[^"']*?\.m3u8[^"']*?)["']/i) ||
                          unpackedHtml.match(/"file"\s*:\s*"([^"]+)"/);
                          
      if (streamMatch && streamMatch[1]) {
        let finalUrl = streamMatch[1];
        if (finalUrl.startsWith("/")) finalUrl = "https://m4uplay.store" + finalUrl;
        
        localStreams.push({ 
          label: "M4UPlay Stream", 
          url: finalUrl 
        });
      }
    } 
    else if (targetUrl.includes("gdflix") || targetUrl.includes("hubcloud")) {
      const resp = await fetch(targetUrl, { headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] }, skipSizeCheck: true });
      const html = await resp.text();
      
      const matches = html.match(/(["'])(https?:\/\/.*?\.mp4.*?)\1/g) || html.match(/(["'])(https?:\/\/.*?\.m3u8.*?)\1/g);
      if (matches) {
        matches.forEach(matchStr => {
          const cleanUrl = matchStr.replace(/["']/g, "");
          if (!cleanUrl.includes("google") && !cleanUrl.includes("analytics")) {
            const providerLabel = targetUrl.includes("gdflix") ? "GDFlix Mirror" : "Hubcloud Mirror";
            localStreams.push({ label: providerLabel, url: cleanUrl });
          }
        });
      }
    }
  } catch (err) {
    console.error("[Movies4u] Endpoint verification failure:", err);
  }
  return localStreams;
}
  
// =======================  
// NUVIO CORE STREAM CONNECTOR
// =======================  
  
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {  
  try {  
    const BASE_URL = await getBaseUrl();  
  
    // 1. Map Target via TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;  
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();  
    const title = mediaInfo.title || mediaInfo.name;  
    if (!title) return [];  
  
    // 2. Query Index Catalog
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {  
      headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] },  
      skipSizeCheck: true  
    });  
    const searchHtml = await searchResp.text();  
    const $ = cheerio.load(searchHtml);
