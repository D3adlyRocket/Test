// movies4u.js  
// Nuvio-compatible Movies4u provider  
// Armed with automatic P.A.C.K.E.R. JavaScript Decryption Engine

const cheerio = require('cheerio');
  
const BASE_DOMAIN = "https://new2.movies4u.finance";  
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";  

const BROWSER_HEADERS = {  
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",  
  "Accept": "*/*",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  "Referer": "https://m4uplay.store/",
  "Origin": "https://m4uplay.store"
};  

/**
 * Reverses Dean Edwards JavaScript obfuscation programmatically
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
  
function extractQuality(text) {  
  const u = (text || "").toLowerCase();  
  if (u.includes("2160") || u.includes("4k")) return "4K";  
  if (u.includes("1080")) return "1080p";  
  if (u.includes("720")) return "720p";  
  if (u.includes("480")) return "480p";  
  return "Unknown";  
}  

/**
 * Resolves streams by mimicking the player's runtime context
 */
async function resolveLockerStreams(targetUrl) {
  const localStreams = [];
  try {
    if (targetUrl.includes("m4uplay.store")) {
      const tokenMatch = targetUrl.match(/\/file\/([a-zA-Z0-9]+)/) || targetUrl.match(/\/embed\/([a-zA-Z0-9]+)/);
      if (!tokenMatch) return [];
      const fileCode = tokenMatch[1];

      // 1. Fetch the embedded media structure
      const embedUrl = `https://m4uplay.store/embed/${fileCode}`;
      const resp = await fetch(embedUrl, { headers: BROWSER_HEADERS, skipSizeCheck: true });
      const html = await resp.text();
      
      // 2. Automatically locate and unpack the encrypted script block
      const unpackedHtml = unpackJavascript(html);

      // 3. Scan the decrypted text parameters for the structural paths discovered via DevTools
      const streamMatch = unpackedHtml.match(/["'](https?:\/\/m4uplay\.store\/stream\/[^"']*?\.m3u8[^"']*?)["']/i) ||
                          unpackedHtml.match(/["'](\/stream\/[^"']*?\.m3u8[^"']*?)["']/i) ||
                          unpackedHtml.match(/"file"\s*:\s*"([^"]+)"/);
                          
      if (streamMatch && streamMatch[1]) {
        let finalUrl = streamMatch[1];
        if (finalUrl.startsWith("/")) finalUrl = "https://m4uplay.store" + finalUrl;
        
        localStreams.push({ 
          label: "M4UPlay Stream Server", 
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
    console.error("[Movies4u] Dynamic decrypt failure:", err);
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
      headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] },  
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
      headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] },  
      skipSizeCheck: true  
    });  
    const pageHtml = await pageResp.text();  
    const $page = cheerio.load(pageHtml);  
  
    const streams = [];
    const bridgeUrls = [];

    $page("a[href]").each((i, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes("m4ulinks.com/number/") || href.includes("m4uplay.store/file/")) {
        if (!bridgeUrls.includes(href)) bridgeUrls.push(href);
      }
    });

    for (const bridgeUrl of bridgeUrls) {
      try {
        let activeLockerUrl = bridgeUrl;

        if (activeLockerUrl.includes("m4ulinks.com")) {
          const idMatch = activeLockerUrl.match(/\/number\/([a-zA-Z0-9]+)/);
          if (!idMatch) continue;
          const extractedId = idMatch[1];
          activeLockerUrl = `https://m4uplay.store/file/${extractedId}`;
        }

        const parsedQuality = extractQuality(match.href);
        const resolved = await resolveLockerStreams(activeLockerUrl);
        
        for (const item of resolved) {
          streams.push({
            name: `Movies4u - ${item.label}`,
            title: `${title}`,
            quality: parsedQuality, 
            url: item.url,
            headers: BROWSER_HEADERS,
            subtitles: []
          });
        }
      } catch (err) {
        console.error("[Movies4u] Tracing extraction failure:", err);
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
