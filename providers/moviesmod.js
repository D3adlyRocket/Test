// movies4u.js  
// Fixed Nuvio-compatible Movies4u provider  
  
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";  
const FALLBACK_URL = "https://new1.movies4u.finance";  
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";  
const HUB_CLOUD_API = "https://hc-zf3c.vercel.app";

const HEADERS = {  
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",  
  "Referer": FALLBACK_URL  
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
async function resolveHubCloud(hubCloudUrl) {
  try {
    const apiURL = `${HUB_CLOUD_API}/api/extract?url=${encodeURIComponent(hubCloudUrl)}`;
    const resp = await fetch(apiURL, {
      headers: { "Accept": "application/json" },
      skipSizeCheck: true
    });
    const data = await resp.json();
    if (data && data.links && data.links.length > 0) {
      // Return the first valid resolved FSL/direct stream asset
      return data.links[0].url;
    }
  } catch (err) {
    console.error("[Movies4u] HubCloud resolution failed:", err);
  }
  return null;
}
  
// =======================  
// NUVIO EXPORT STREAM ROUTER
// =======================  
  
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {  
  try {  
    const BASE_URL = await getBaseUrl();  
  
    // 1. Fetch TMDB details to get accurate Title
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
  
    // Fall back to first result if explicit name match misses
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

    // Check whether we are treating this context as a Movie or a TV Show
    if (mediaType === "series" || match.href.includes("/tvshows/") || match.href.includes("/series/")) {
      
      // ─── SERIES PROCESSING BRANCH ───
      let targetDownloadPage = null;
      
      // Locate the H4 node related to our target Season
      $page("h4").each((i, el) => {
        const headingText = $(el).text().toLowerCase();
        const seasonMatch = headingText.match(/season\s*0*(\d+)/i);
        
        if (seasonMatch && parseInt(seasonMatch[1]) === (season || 1)) {
          // Find next matching sibling link that points to m4ulinks
          let nextNode = $(el).next();
          while (nextNode.length && !["h2", "h3", "h4"].includes(nextNode[0].name)) {
            if (nextNode[0].name === "a") {
              const href = nextNode.attr("href") || "";
              if (href.includes("m4ulinks.com") && nextNode.text().toLowerCase().includes("download links")) {
                targetDownloadPage = href;
                break;
              }
            }
            nextNode = nextNode.next();
          }
        }
      });

      if (!targetDownloadPage) return [];

      // Fetch internal Episode/Hubcloud collection page
      const epPageResp = await fetch(targetDownloadPage, { headers: HEADERS, skipSizeCheck: true });
      const epPageHtml = await epPageResp.text();
      const $epPage = cheerio.load(epPageHtml);
      
      let hubCloudUrl = null;

      // Look for the header matching our exact episode number (e.g., Episode 1, Episode 02)
      $epPage("h5, h4, h3").each((i, el) => {
        const text = $(el).text().toLowerCase();
        const epMatch = text.match(/episodes?\s*[:\-]?\s*0*(\d+)/i);
        
        if (epMatch && parseInt(epMatch[1]) === (episode || 1)) {
          let nextNode = $(el).next();
          while (nextNode.length && !["h3", "h4", "h5"].includes(nextNode[0].name)) {
            if (nextNode[0].name === "a") {
              const href = nextNode.attr("href") || "";
              if (href.includes("hubcloud") || href.includes("hub-cloud")) {
                hubCloudUrl = href;
                break;
              }
            }
            nextNode = nextNode.next();
          }
        }
      });

      if (hubCloudUrl) {
        const finalStreamUrl = await resolveHubCloud(hubCloudUrl);
        if (finalStreamUrl) {
          streams.push({
            name: "Movies4u (Series)",
            title: `${title} - S${season || 1}E${episode || 1}`,
            quality: extractQuality(targetDownloadPage),
            url: finalStreamUrl,
            headers: { "User-Agent": HEADERS["User-Agent"] },
            subtitles: []
          });
        }
      }

    } else {
      
      // ─── MOVIE PROCESSING BRANCH ───
      const uniqueRedirectPages = [];

      // Extract raw direct m4ulinks from post body matching download criteria
      $page("a[href]").each((i, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().toLowerCase();
        if (href.includes("m4ulinks.com") && text.includes("download links")) {
          if (!uniqueRedirectPages.includes(href)) {
            uniqueRedirectPages.push(href);
          }
        }
      });

      // Parse found link elements to gather HubCloud nodes
      for (const redirectPage of uniqueRedirectPages.slice(0, 3)) {
        try {
          const innerResp = await fetch(redirectPage, { headers: HEADERS, skipSizeCheck: true });
          const innerHtml = await innerResp.text();
          const $inner = cheerio.load(innerHtml);
          
          let hubCloudUrl = null;
          $inner("a[href]").each((i, el) => {
            const href = $(el).attr("href") || "";
            if (href.includes("hubcloud") || href.includes("hub-cloud")) {
              hubCloudUrl = href;
            }
          });

          if (hubCloudUrl) {
            const finalStreamUrl = await resolveHubCloud(hubCloudUrl);
            if (finalStreamUrl) {
              streams.push({
                name: "Movies4u",
                title: `${title}`,
                quality: extractQuality(redirectPage),
                url: finalStreamUrl,
                headers: { "User-Agent": HEADERS["User-Agent"] },
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
  
// =======================  
// REQUIRED FOR NUVIO  
// =======================  
  
module.exports = {  
  getStreams  
};
