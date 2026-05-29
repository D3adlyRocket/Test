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

// Helper to extract tech properties from titles/labels
function parseExtraMetadata(text) {
  const norm = (text || "").toUpperCase();
  
  // 1. Languages
  let lang = "Hindi-English"; // Movies4u Default
  if (norm.includes("DUAL")) lang = "Dual Audio";
  if (norm.includes("ENGLISH") && !norm.includes("HINDI")) lang = "English";
  
  // 2. Sizes (Enhanced fallback parsing for hidden size blocks)
  const sizeMatch = norm.match(/(\d+(?:\.\d+)?\s*[MGB]B)/i);
  let size = sizeMatch ? sizeMatch[0].replace(/\s+/g, "") : "N/A";
  
  // Try matching plain text numbers if they are explicitly surrounded by file indicators
  if (size === "N/A") {
    const backupSizeMatch = norm.match(/GB_|\s(\d+\.\d+)GB/i);
    if (backupSizeMatch) size = backupSizeMatch[1] + "GB";
  }
  
  // 3. Formats & Codecs
  let format = "MKV";
  if (norm.includes("MP4")) format = "MP4";
  if (norm.includes("HEVC") || norm.includes("X265") || norm.includes("H265")) format += " (x265)";
  else if (norm.includes("X264") || norm.includes("H264")) format += " (x264)";

  // 4. Extra Features
  const extras = [];
  if (norm.includes("HDR")) extras.push("HDR");
  if (norm.includes("DOLBY") || norm.includes("DV") || norm.includes("VISION") || norm.includes("ATMOS") || norm.includes("DD5")) extras.push("Dolby Vision/5.1");
  if (norm.includes("10BIT")) extras.push("10-Bit");
  if (norm.includes("REMUX")) extras.push("Remux");
  
  return {
    language: lang,
    size: size,
    format: format,
    extras: extras.length > 0 ? extras.join(" | ") : "Standard Dynamic Range"
  };
}

/**
 * Cleans up messy raw HubCloud server text strings into readable output like [FSL Server]
 */
function cleanServerName(serverText) {
  if (!serverText) return "HubCloud";
  let clean = serverText.toLowerCase();
  
  if (clean.includes("fsl") || clean.includes("fast")) return "FSL Server";
  if (clean.includes("pixel")) return "PixelDrain";
  if (clean.includes("drive") || clean.includes("gdrive")) return "Cloud Drive";
  
  // Strip common packaging text wrappers
  clean = clean.replace(/download|links?|button|server|\s+/gi, " ").trim();
  clean = clean.replace(/[\[\]\(\)]/g, "").trim(); 
  
  return clean.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') + " Server";
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
  
    // Map basic metadata out of TMDB
    const releaseYear = (mediaInfo.release_date || mediaInfo.first_air_date || "").split("-")[0] || "N/A";
    const runTime = mediaInfo.runtime ? `${mediaInfo.runtime} min` : "N/A";

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
  
    const rawStreamsList = [];

    // ─── OPTION A: CAPTURE DIRECT PLUGINS FROM MAIN BODY ───
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
        let quality = extractQuality(playerUrl + " " + directM3u8);
        const meta = parseExtraMetadata(playerUrl + " " + directM3u8);
        
        rawStreamsList.push({
          server: "Player Direct",
          quality: quality,
          meta: meta,
          url: directM3u8,
          headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] }
        });
      }
    }

    // ─── OPTION B: INDEX REDIRECT PAGES ───
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
            let quality = extractQuality(downloadPage + " " + rawUrl);
            const meta = parseExtraMetadata(downloadPage + " " + rawUrl);

            if (rawUrl.includes("m4uplay.store")) {
              const directM3u8 = await extractDirectM3u8(rawUrl);
              if (directM3u8) {
                if (quality === "Unknown") quality = extractQuality(rawUrl + " " + directM3u8);
                rawStreamsList.push({
                  server: "M4U Player",
                  quality: quality,
                  meta: meta,
                  url: directM3u8,
                  headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] }
                });
              }
            } else {
              const extractedLinks = await resolveAllHubCloudLinks(rawUrl);
              for (const linkItem of extractedLinks) {
                // Read straight from final video object parameters to override text missing errors
                const searchString = `${linkItem.label || ""} ${linkItem.url || ""} ${downloadPage}`;
                const innerMeta = parseExtraMetadata(searchString);
                let finalQuality = extractQuality(searchString);
                if (finalQuality === "Unknown") finalQuality = quality;
                
                rawStreamsList.push({
                  server: cleanServerName(linkItem.label || "HubCloud"),
                  quality: finalQuality,
                  meta: { 
                    language: innerMeta.language !== "Hindi-English" ? innerMeta.language : meta.language,
                    size: innerMeta.size !== "N/A" ? innerMeta.size : meta.size,
                    format: innerMeta.format,
                    extras: innerMeta.extras
                  },
                  url: linkItem.url,
                  headers: { "User-Agent": HEADERS["User-Agent"] }
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
            let quality = extractQuality(redirectPage + " " + rawUrl);
            const meta = parseExtraMetadata(redirectPage + " " + rawUrl);

            if (rawUrl.includes("m4uplay.store")) {
              const directM3u8 = await extractDirectM3u8(rawUrl);
              if (directM3u8) {
                if (quality === "Unknown") quality = extractQuality(rawUrl + " " + directM3u8);
                rawStreamsList.push({
                  server: "M4U Player",
                  quality: quality,
                  meta: meta,
                  url: directM3u8,
                  headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] }
                });
              }
            } else {
              const extractedLinks = await resolveAllHubCloudLinks(rawUrl);
              for (const linkItem of extractedLinks) {
                // Read straight from final video object parameters to override text missing errors
                const searchString = `${linkItem.label || ""} ${linkItem.url || ""} ${redirectPage}`;
                const innerMeta = parseExtraMetadata(searchString);
                let finalQuality = extractQuality(searchString);
                if (finalQuality === "Unknown") finalQuality = quality;

                rawStreamsList.push({
                  server: cleanServerName(linkItem.label || "HubCloud"),
                  quality: finalQuality,
                  meta: { 
                    language: innerMeta.language !== "Hindi-English" ? innerMeta.language : meta.language,
                    size: innerMeta.size !== "N/A" ? innerMeta.size : meta.size,
                    format: innerMeta.format,
                    extras: innerMeta.extras
                  },
                  url: linkItem.url,
                  headers: { "User-Agent": HEADERS["User-Agent"] }
                });
              }
            }
          }
        } catch (_) {}
      }
    }

    // ─── SORTING LOGIC (Force 4K/2160p to top perfectly) ───
    const qualityWeights = { "4K": 5, "1080p": 4, "720p": 3, "480p": 2, "360p": 1, "Unknown": 0 };
    rawStreamsList.sort((a, b) => (qualityWeights[b.quality] || 0) - (qualityWeights[a.quality] || 0));

    // ─── FINAL OUTPUT FORMATTING WITH CLEAN [FSL Server] HEADERS ───
    const finalStreams = rawStreamsList.map(stream => {
      const epInfo = (mediaType === "series") ? ` - S${season || 1}E${episode || 1}` : "";
      
      return {
        name: `Movies4u | ${stream.quality} | [${stream.server}]`,
        title: `🎬 ${title}${epInfo} - ${releaseYear}\n⚡ ${stream.quality} | 🌍 ${stream.meta.language} | 💾 ${stream.meta.size}\n🎞️ ${stream.meta.format} | ⏱️ ${runTime} | 🛠️ ${stream.meta.extras}`,
        quality: stream.quality,
        url: stream.url,
        headers: stream.headers,
        subtitles: []
      };
    });
  
    return finalStreams;  
  
  } catch (e) {  
    console.error("[Movies4u Code Error]", e);  
    return [];  
  }  
}  
  
module.exports = {  
  getStreams  
};
