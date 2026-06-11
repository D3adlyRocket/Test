// movies4u.js  
// Patched Nuvio-compatible Movies4u provider (m4uplay.store native)

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
 * Resolves streams directly from the new m4uplay.store layout natively
 */
async function resolveM4uPlayLinks(embedUrl, qualityContext = "1080p") {
  const localStreams = [];
  try {
    // Normalizes file embed layouts to standard viewer format
    let targetUrl = embedUrl;
    if (targetUrl.includes("/file/")) {
      targetUrl = targetUrl.replace("/file/", "/embed/");
    }

    const resp = await fetch(targetUrl, { 
      headers: { "User-Agent": HEADERS["User-Agent"], "Referer": BASE_DOMAIN },
      skipSizeCheck: true 
    });
    const html = await resp.text();
    
    // Scans page elements or script source blocks for explicit file references
    const $ = cheerio.load(html);
    
    // Look for standard video sources or packed source parameters
    const sourceUrls = [];
    $("source, video").each((i, el) => {
      const src = $(el).attr("src");
      if (src && !sourceUrls.includes(src)) sourceUrls.push(src);
    });

    // Fallback regex scan if sources are embedded deep in configuration scripts
    const regexSources = html.match(/(["'])(https?:\/\/.*?\.mp4.*?)\1/g);
    if (regexSources) {
      regexSources.forEach(matchStr => {
        const cleanUrl = matchStr.replace(/["']/g, "");
        if (!sourceUrls.includes(cleanUrl)) sourceUrls.push(cleanUrl);
      });
    }

    for (const fileUrl of sourceUrls) {
      localStreams.push({
        label: `Mirror`,
        url: fileUrl
      });
    }
  } catch (err) {
    console.error("[Movies4u] native stream extraction failed:", err);
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

    if (mediaType === "series" || match.href.includes("/tvshows/") || match.href.includes("/series/")) {
      
      // ─── SERIES PROCESSING BRANCH ───
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
                if (!uniqueDownloadPages.includes(href)) {
                  uniqueDownloadPages.push(href);
                }
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
          
          const targetNodes = $epPage("h5, h4, h3").toArray();

          for (const el of targetNodes) {
            const text = $(el).text().toLowerCase();
            const epMatch = text.match(/episodes?\s*[:\-]?\s*0*(\d+)/i);
            
            if (epMatch && parseInt(epMatch[1]) === (episode || 1)) {
              let nextNode = $(el).next();
              while (nextNode.length && !["h3", "h4", "h5"].includes(nextNode[0].name)) {
                if (nextNode[0].name === "a") {
                  const href = nextNode.attr("href") || "";
                  
                  if (href.includes("m4uplay.store") || href.includes("m4ulinks.com")) {
                    const parsedQuality = extractQuality(downloadPage);
                    const extractedLinks = await resolveM4uPlayLinks(href, parsedQuality);
                    
                    for (const linkItem of extractedLinks) {
                      streams.push({
                        name: `Movies4u (Series) - ${linkItem.label}`,
                        title: `${title} - S${season || 1}E${episode || 1}`,
                        quality: parsedQuality,
                        url: linkItem.url,
                        headers: { "User-Agent": HEADERS["User-Agent"], "Referer": "https://m4uplay.store/" },
                        subtitles: []
                      });
                    }
                  }
                }
                nextNode = nextNode.next();
              }
            }
          }
        } catch (_) {}
      }

    } else {
      
      // ─── MOVIE PROCESSING BRANCH ───
      const uniqueRedirectPages = [];

      $page("a[href]").each((i, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().toLowerCase();
        if (href.includes("m4ulinks.com") && text.includes("download links")) {
          if (!uniqueRedirectPages.includes(href)) {
            uniqueRedirectPages.push(href);
          }
        }
      });

      for (const redirectPage of uniqueRedirectPages) {
        try {
          const innerResp = await fetch(redirectPage, { headers: HEADERS, skipSizeCheck: true });
          const innerHtml = await innerResp.text();
          const $inner = cheerio.load(innerHtml);
          
          const playStoreUrls = [];
          $inner("a[href]").each((i, el) => {
            const href = $(el).attr("href") || "";
            if (href.includes("m4uplay.store") || href.includes("m4ulinks.com/number")) {
              if (!playStoreUrls.includes(href)) playStoreUrls.push(href);
            }
          });

          for (const playUrl of playStoreUrls) {
            const parsedQuality = extractQuality(redirectPage);
            const extractedLinks = await resolveM4uPlayLinks(playUrl, parsedQuality);
            for (const linkItem of extractedLinks) {
              streams.push({
                name: `Movies4u - ${linkItem.label}`,
                title: `${title}`,
                quality: parsedQuality, 
                url: linkItem.url,
                headers: { "User-Agent": HEADERS["User-Agent"], "Referer": "https://m4uplay.store/" },
                subtitles: []
              });
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
  
module.exports = {  
  getStreams  
};
