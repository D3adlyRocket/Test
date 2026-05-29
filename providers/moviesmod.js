// movies4u.js  
// Fixed Nuvio-compatible Movies4u provider  
  
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
  if (u.includes("2160") || u.includes("4k")) return "4K";  
  if (u.includes("1080")) return "1080p";  
  if (u.includes("720")) return "720p";  
  if (u.includes("480")) return "480p";  
  if (u.includes("360")) return "360p";  
  return "Unknown";  
}  

/**
 * Uses the external Vercel Extractor API to get direct FSL/CDN download links
 */
async function resolveAllHubCloudLinks(hubCloudUrl) {
  try {
    const apiURL = `${HUB_CLOUD_API}/api/extract?url=${encodeURIComponent(hubCloudUrl)}`;
    const resp = await fetch(apiURL, {
      headers: { "Accept": "application/json" },
      skipSizeCheck: true
    });
    const data = await resp.json();
    if (data && data.links && data.links.length > 0) {
      return data.links;
    }
  } catch (err) {
    console.error("[Movies4u] HubCloud resolution failed:", err);
  }
  return [];
}

/**
 * Unpacks Dean Edwards p.a.c.k.e.d JS code blocks natively
 */
function unpackJS(p, a, c, k) {  
  while (c--) {  
    if (k[c]) {  
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);  
    }  
  }  
  return p;  
}

/**
 * Scrapes direct player host configurations from m4uplay player instances
 */
async function extractDirectM3u8(playerUrl) {
  try {
    const resp = await fetch(playerUrl, {
      headers: { ...HEADERS, Referer: "https://m4uplay.store/" },
      skipSizeCheck: true
    });
    const html = await resp.text();
    
    let m3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] || 
               html.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
                
    if (!m3u8) {
      const rel = html.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];
      if (rel) m3u8 = "https://m4uplay.store" + rel;
    }
    
    // Packed JS Handling
    if (!m3u8) {
      const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\).*?\}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)/s);
      if (packedMatch) {
        const unpacked = unpackJS(packedMatch[1], parseInt(packedMatch[2]), parseInt(packedMatch[3]), packedMatch[4].split("|"));
        m3u8 = unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] || 
               unpacked.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
        if (!m3u8) {
          const rel = unpacked.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];
          if (rel) m3u8 = "https://m4uplay.store" + rel;
        }
      }
    }
    
    if (m3u8) {
      return m3u8.replace("master.txt", "master.m3u8");
    }
  } catch (e) {
    console.error("[Movies4u] Player direct parsing failed:", e);
  }
  return null;
}
  
// =======================  
// NUVIO EXPORT STREAM ROUTER
// =======================  
  
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {  
  try {  
    const BASE_URL = await getBaseUrl();  
  
    // 1. Fetch Title via TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;  
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();  
    const title = mediaInfo.title || mediaInfo.name;  
    if (!title) return [];  
  
    // 2. Search on Movies4u base site
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {  
      headers: HEADERS,  
      skipSizeCheck: true  
    });  
    const searchHtml = await searchResp.text();  
    const $ = cheerio.load(searchHtml);  
    const results = [];  
  
    $("article").each((i, el) => {  
      const a = $(el).find("h2 a, h3 a, a[rel='bookmark']").first();  
      let href = a.attr("href");  
      const name = a.text().trim();  
  
      if (href && name) {  
        if (!href.startsWith("http")) href = BASE_URL + "/" + href.replace(/^\/+/, "");
        results.push({ href, name });  
      }  
    });  
  
    if (!results.length) return [];  
    const match = results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) || results[0];  
    if (!match) return [];  
  
    // 3. Fetch primary page target
    const pageResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });  
    const pageHtml = await pageResp.text();  
    const $page = cheerio.load(pageHtml);  
  
    const streams = [];

    // ─── OPTION A: CAPTURE DIRECT BTN-ZIP BUTTONS SEEN DIRECTLY ON THE PAGE ───
    const directWatchLinks = [];
    $page("a.btn.btn-zip, a[href*='m4uplay.store']").each((i, el) => {
      const href = $(el).attr("href");
      if (href && !directWatchLinks.includes(href)) {
        directWatchLinks.push(href);
      }
    });

    for (const playerUrl of directWatchLinks) {
      const directM3u8 = await extractDirectM3u8(playerUrl);
      if (directM3u8) {
        streams.push({
          name: "Movies4u - Player Direct",
          title: `${title}`,
          quality: extractQuality(playerUrl + " " + directM3u8),
          url: directM3u8,
          headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] },
          subtitles: []
        });
      }
    }

    // ─── OPTION B: STANDARD ROUTING (SERIES/MOVIES VIA REDIRECT INDICES) ───
    if (mediaType === "series" || match.href.includes("/tvshows/") || match.href.includes("/series/")) {
      
      const uniqueDownloadPages = [];
      $page("h4").each((i, el) => {
        const headingText = $(el).text().toLowerCase();
        const seasonMatch = headingText.match(/season\s*0*(\d+)/i);
        
        if (seasonMatch && parseInt(seasonMatch[1]) === (season || 1)) {
          let nextNode = $(el).next();
          while (nextNode.length && !["h2", "h3", "h4"].includes(nextNode[0].name)) {
            if (nextNode[0].name === "a") {
              const href = nextNode.attr("href") || "";
              if (href.includes("m4ulinks.com") && nextNode.text().toLowerCase().includes("download links")) {
                if (!uniqueDownloadPages.includes(href)) uniqueDownloadPages.push(href);
              }
            }
            nextNode = nextNode.next();
          }
        }
      });

      for (const downloadPage of uniqueDownloadPages) {
        try {
          const epPageResp = await fetch(downloadPage, { headers: HEADERS, skipSizeCheck: true });
          const epPageHtml = await epPageResp.text();
          const $epPage = cheerio.load(epPageHtml);
          
          const targetUrls = [];
          $epPage("h5, h4, h3").each((i, el) => {
            const text = $(el).text().toLowerCase();
            const epMatch = text.match(/episodes?\s*[:\-]?\s*0*(\d+)/i);
            
            if (epMatch && parseInt(epMatch[1]) === (episode || 1)) {
              let nextNode = $(el).next();
              while (nextNode.length && !["h3", "h4", "h5"].includes(nextNode[0].name)) {
                if (nextNode[0].name === "a") {
                  const href = nextNode.attr("href") || "";
                  if (href.includes("hubcloud") || href.includes("hub-cloud") || href.includes("m4uplay.store")) {
                    if (!targetUrls.includes(href)) targetUrls.push(href);
                  }
                }
                nextNode = nextNode.next();
              }
            }
          });

          for (const rawUrl of targetUrls) {
            if (rawUrl.includes("m4uplay.store")) {
              const directM3u8 = await extractDirectM3u8(rawUrl);
              if (directM3u8) {
                streams.push({
                  name: "Movies4u (Series) - Player Direct",
                  title: `${title} - S${season || 1}E${episode || 1}`,
                  quality: extractQuality(downloadPage),
                  url: directM3u8,
                  headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] },
                  subtitles: []
                });
              }
            } else {
              const extractedLinks = await resolveAllHubCloudLinks(rawUrl);
              for (const linkItem of extractedLinks) {
                streams.push({
                  name: `Movies4u (Series) - ${linkItem.label || 'Direct'}`,
                  title: `${title} - S${season || 1}E${episode || 1}`,
                  quality: extractQuality(downloadPage),
                  url: linkItem.url,
                  headers: { "User-Agent": HEADERS["User-Agent"] },
                  subtitles: []
                });
              }
            }
          }
        } catch (_) {}
      }

    } else {
      
      const uniqueRedirectPages = [];
      $page("a[href]").each((i, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().toLowerCase();
        if (href.includes("m4ulinks.com") && text.includes("download links")) {
          if (!uniqueRedirectPages.includes(href)) uniqueRedirectPages.push(href);
        }
      });

      for (const redirectPage of uniqueRedirectPages) {
        try {
          const innerResp = await fetch(redirectPage, { headers: HEADERS, skipSizeCheck: true });
          const innerHtml = await innerResp.text();
          const $inner = cheerio.load(innerHtml);
          
          const targetUrls = [];
          $inner("a[href]").each((i, el) => {
            const href = $(el).attr("href") || "";
            if (href.includes("hubcloud") || href.includes("hub-cloud") || href.includes("m4uplay.store")) {
              if (!targetUrls.includes(href)) targetUrls.push(href);
            }
          });

          for (const rawUrl of targetUrls) {
            if (rawUrl.includes("m4uplay.store")) {
              const directM3u8 = await extractDirectM3u8(rawUrl);
              if (directM3u8) {
                streams.push({
                  name: "Movies4u - Player Direct",
                  title: `${title}`,
                  quality: extractQuality(redirectPage),
                  url: directM3u8,
                  headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] },
                  subtitles: []
                });
              }
            } else {
              const extractedLinks = await resolveAllHubCloudLinks(rawUrl);
              for (const linkItem of extractedLinks) {
                streams.push({
                  name: `Movies4u - ${linkItem.label || 'Direct'}`,
                  title: `${title}`,
                  quality: extractQuality(redirectPage),
                  url: linkItem.url,
                  headers: { "User-Agent": HEADERS["User-Agent"] },
                  subtitles: []
                });
              }
            }
          }
        } catch (_) {}
      }
    }
  
    return streams;  
  
  } catch (e) {  
    console.error("[Movies4u Code Error]", e);  
    return [];  
  }  
}  
  
// =======================  
// REQUIRED FOR NUVIO  
// =======================  
  
module.exports = {  
  getStreams  
};
