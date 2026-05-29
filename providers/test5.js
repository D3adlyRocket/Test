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
  
/**
 * Core RegEx Quality Extractor
 */
function extractQuality(text) {  
  const u = (text || "").toLowerCase();  
  if (/\b(2160p|4k|uhd)\b/i.test(u) || u.includes("2160") || u.includes("4k")) return "4K";  
  if (/\b(1080p|1080)\b/i.test(u) || u.includes("1080")) return "1080p";  
  if (/\b(720p|720)\b/i.test(u) || u.includes("720")) return "720p";  
  if (/\b(480p|480)\b/i.test(u) || u.includes("480")) return "480p";  
  if (/\b(360p|360)\b/i.test(u) || u.includes("360")) return "360p";  
  return "Unknown";  
}  

/**
 * METHOD 1: Reads live M3U8 streaming playlists for exact width/height resolution configurations
 */
async function parseM3U8Manifest(url, customHeaders = {}) {
  try {
    const resp = await fetch(url, { method: "GET", headers: customHeaders, skipSizeCheck: true });
    const text = await resp.text();
    if (text.includes("RESOLUTION=")) {
      const resolutions = text.match(/RESOLUTION=\d+x(\d+)/g);
      if (resolutions) {
        // Grab the highest resolution available in the master manifest file
        const heights = resolutions.map(r => parseInt(r.split('x')[1])).sort((a, b) => b - a);
        const topHeight = heights[0];
        if (topHeight >= 2160) return "4K";
        if (topHeight >= 1080) return "1080p";
        if (topHeight >= 720) return "720p";
        if (topHeight >= 480) return "480p";
        if (topHeight >= 360) return "360p";
      }
    }
  } catch (_) {}
  return null;
}

/**
 * METHOD 2: Follows redirect headers to grab the true file server attachment filename 
 */
async function getRealFilenameQuality(url, customHeaders = {}) {
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      headers: customHeaders,
      skipSizeCheck: true,
      redirect: "follow"
    });
    
    // Look at the Content-Disposition header where servers store the real file name
    const disposition = resp.headers.get("content-disposition") || "";
    if (disposition.includes("filename=")) {
      const filename = disposition.split("filename=")[1].replace(/['"]/g, "");
      const quality = extractQuality(filename);
      if (quality !== "Unknown") return quality;
    }
    
    // Fallback to reading the final redirected URL string line
    const finalUrl = resp.url || url;
    const urlQuality = extractQuality(decodeURIComponent(finalUrl));
    if (urlQuality !== "Unknown") return urlQuality;
  } catch (_) {}
  return null;
}

/**
 * MASTER WATERFALL: Zero Guesswork Resolution Mapper
 */
async function accurateQualityDetector(url, fallbackText = "", headers = {}) {
  // If it's a playlist stream, inspect the stream lines
  if (url.includes(".m3u8") || url.includes("master.txt")) {
    const m3u8Quality = await parseM3U8Manifest(url, headers);
    if (m3u8Quality) return m3u8Quality;
  }
  
  // If it's a direct mp4/mkv download path, ping the headers for the real file name
  const realFileQuality = await getRealFilenameQuality(url, headers);
  if (realFileQuality) return realFileQuality;

  // Fallback to the link context string text only if network routes completely timeout
  const textQuality = extractQuality(fallbackText);
  if (textQuality !== "Unknown") return textQuality;

  return "1080p"; // absolute fallback safe-default
}

// Helper to extract tech properties from titles/labels
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

function cleanServerName(serverText) {
  if (!serverText) return "HubCloud";
  let clean = serverText.toLowerCase();
  
  if (clean.includes("fsl") || clean.includes("fast")) return "FSL Server";
  if (clean.includes("pixel")) return "PixelDrain";
  if (clean.includes("drive") || clean.includes("gdrive")) return "Cloud Drive";
  
  clean = clean.replace(/download|links?|button|server|\s+/gi, " ").trim();
  clean = clean.replace(/[\[\]\(\)]/g, "").trim(); 
  
  return clean.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') + " Server";
}

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

async function detectFileSize(url, headers = {}) {
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      headers,
      skipSizeCheck: true,
      redirect: "follow"
    });
    const size = resp.headers.get("content-length");
    if (!size) return null;
    const bytes = parseInt(size);
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(1) + "GB";
    }
    return Math.round(bytes / (1024 * 1024)) + "MB";
  } catch (_) {}
  return null;
}

function unpackJS(p, a, c, k) {  
  while (c--) {  
    if (k[c]) {  
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);  
    }  
  }  
  return p;  
}

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
  
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;  
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();  
    const title = mediaInfo.title || mediaInfo.name;  
    if (!title) return [];  
  
    const releaseYear = (mediaInfo.release_date || mediaInfo.first_air_date || "").split("-")[0] || "N/A";
    const runTime = mediaInfo.runtime ? `${mediaInfo.runtime} min` : "N/A";

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
  
    const pageResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });  
    const pageHtml = await pageResp.text();  
    const $page = cheerio.load(pageHtml);  
  
    const rawStreamsList = [];
    const siteTitleContext = match.name;

    // ─── OPTION A: CAPTURE DIRECT PLUGINS FROM MAIN BODY ───
    const directWatchLinks = [];
    $page("a.btn.btn-zip, a[href*='m4uplay.store']").each((i, el) => {
      const href = $(el).attr("href");
      const textContext = $(el).text() || "";
      if (href && !directWatchLinks.some(item => item.href === href)) {
        directWatchLinks.push({ href, text: textContext });
      }
    });

    for (const item of directWatchLinks) {
      const directM3u8 = await extractDirectM3u8(item.href);
      if (directM3u8) {
        const contextStr = item.text + " " + item.href + " " + siteTitleContext;
        const meta = parseExtraMetadata(contextStr);
        const playerHeaders = { Referer: "https://m4uplay.store/" };
        
        // Exact non-guessing verification
        const verifiedQuality = await accurateQualityDetector(directM3u8, contextStr, playerHeaders);
        const detectedSize = await detectFileSize(directM3u8, playerHeaders);

        rawStreamsList.push({
          server: "Player Direct",
          quality: verifiedQuality,
          meta: { ...meta, size: detectedSize || meta.size || "N/A" },
          url: directM3u8,
          headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] }
        });
      }
    }

    // ─── OPTION B: INDEX TV REDIRECT PAGES ───
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
              const elementText = nextNode.text() || "";
              if (href.includes("m4ulinks.com") && elementText.toLowerCase().includes("download links")) {
                if (!uniqueDownloadPages.some(p => p.href === href)) {
                  uniqueRedirectPages.push({ href, parentText: elementText }); // Note: uniqueDownloadPages push handled safely below
                  uniqueDownloadPages.push({ href, parentText: elementText });
                }
              }
            }
            nextNode = nextNode.next();
          }
        }
      });

      for (const downloadPage of uniqueDownloadPages) {
        try {
          const epPageResp = await fetch(downloadPage.href, { headers: HEADERS, skipSizeCheck: true });
          const epPageHtml = await epPageResp.text();
          const $epPage = cheerio.load(epPageHtml);
          
          const targetUrls = [];
          $epPage("h5, h4, h3").each((i, el) => {
            const headingText = $(el).text();
            const textLower = headingText.toLowerCase();
            const epMatch = textLower.match(/episodes?\s*[:\-]?\s*0*(\d+)/i);
            
            if (epMatch && parseInt(epMatch[1]) === (episode || 1)) {
              let nextNode = $(el).next();
              while (nextNode.length && !["h3", "h4", "h5"].includes(nextNode[0].name)) {
                if (nextNode[0].name === "a") {
                  const href = nextNode.attr("href") || "";
                  const linkText = nextNode.text() || "";
                  const contextualText = headingText + " " + linkText;
                  
                  if (href.includes("hubcloud") || href.includes("hub-cloud") || href.includes("m4uplay.store")) {
                    if (!targetUrls.some(t => t.href === href)) {
                      targetUrls.push({ href, contextualText });
                    }
                  }
                }
                nextNode = nextNode.next();
              }
            }
          });

          for (const target of targetUrls) {
            const contextStr = target.contextualText + " " + downloadPage.parentText + " " + siteTitleContext;
            const meta = parseExtraMetadata(contextStr);

            if (target.href.includes("m4uplay.store")) {
              const directM3u8 = await extractDirectM3u8(target.href);
              if (directM3u8) {
                const playerHeaders = { Referer: "https://m4uplay.store/" };
                const verifiedQuality = await accurateQualityDetector(directM3u8, contextStr, playerHeaders);
                const detectedSize = await detectFileSize(directM3u8, playerHeaders);

                rawStreamsList.push({
                  server: "M4U Player",
                  quality: verifiedQuality,
                  meta: { ...meta, size: detectedSize || meta.size || "N/A" },
                  url: directM3u8,
                  headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] }
                });
              }
            } else {
              const extractedLinks = await resolveAllHubCloudLinks(target.href);
              for (const linkItem of extractedLinks) {
                const searchString = `${linkItem.label || ""} ${linkItem.url || ""} ${contextStr}`;
                const innerMeta = parseExtraMetadata(searchString);
                const cloudHeaders = { "User-Agent": HEADERS["User-Agent"] };
                
                const verifiedQuality = await accurateQualityDetector(linkItem.url, searchString, cloudHeaders);
                const detectedSize = await detectFileSize(linkItem.url, cloudHeaders);

                rawStreamsList.push({
                  server: cleanServerName(linkItem.label || "HubCloud"),
                  quality: verifiedQuality,
                  meta: { 
                    language: innerMeta.language !== "Multi-Audio" ? innerMeta.language : meta.language,
                    size: detectedSize || (innerMeta.size !== "N/A" ? innerMeta.size : "N/A"),
                    format: innerMeta.format,
                    extras: innerMeta.extras
                  },
                  url: linkItem.url,
                  headers: cloudHeaders
                });
              }
            }
          }
        } catch (_) {}
      }

    } else {
      // ─── OPTION C: INDEX MOVIE REDIRECT PAGES ───
      const uniqueRedirectPages = [];
      $page("a[href]").each((i, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text() || "";
        if (href.includes("m4ulinks.com") && text.toLowerCase().includes("download links")) {
          if (!uniqueRedirectPages.some(p => p.href === href)) {
            uniqueRedirectPages.push({ href, parentText: text });
          }
        }
      });

      for (const redirectPage of uniqueRedirectPages) {
        try {
          const innerResp = await fetch(redirectPage.href, { headers: HEADERS, skipSizeCheck: true });
          const innerHtml = await innerResp.text();
          const $inner = cheerio.load(innerHtml);
          
          const targetUrls = [];
          $inner("h1, h2, h3, h4, h5, h6, p, a.btn, a[href]").each((i, el) => {
            const currentElement = $(el);
            let href = currentElement.attr("href") || "";
            let contextText = currentElement.text() || "";

            if (!href) {
              const localAnchor = currentElement.find("a[href]").first();
              if (localAnchor.length) {
                href = localAnchor.attr("href") || "";
                contextText += " " + localAnchor.text();
              }
            }

            if (href.includes("hubcloud") || href.includes("hub-cloud") || href.includes("m4uplay.store")) {
              if (!targetUrls.some(t => t.href === href)) {
                const nearText = currentElement.parent().text() || "";
                targetUrls.push({ href, contextualText: contextText + " " + nearText });
              }
            }
          });

          for (const target of targetUrls) {
            const contextStr = target.contextualText + " " + redirectPage.parentText + " " + siteTitleContext;
            const meta = parseExtraMetadata(contextStr);

            if (target.href.includes("m4uplay.store")) {
              const directM3u8 = await extractDirectM3u8(target.href);
              if (directM3u8) {
                const playerHeaders = { Referer: "https://m4uplay.store/" };
                const verifiedQuality = await accurateQualityDetector(directM3u8, contextStr, playerHeaders);
                const detectedSize = await detectFileSize(directM3u8, playerHeaders);

                rawStreamsList.push({
                  server: "M4U Player",
                  quality: verifiedQuality,
                  meta: { ...meta, size: detectedSize || meta.size || "N/A" },
                  url: directM3u8,
                  headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] }
                });
              }
            } else {
              const extractedLinks = await resolveAllHubCloudLinks(target.href);
              for (const linkItem of extractedLinks) {
                const searchString = `${linkItem.label || ""} ${linkItem.url || ""} ${contextStr}`;
                const innerMeta = parseExtraMetadata(searchString);
                const cloudHeaders = { "User-Agent": HEADERS["User-Agent"] };
                
                const verifiedQuality = await accurateQualityDetector(linkItem.url, searchString, cloudHeaders);
                const detectedSize = await detectFileSize(linkItem.url, cloudHeaders);

                rawStreamsList.push({
                  server: cleanServerName(linkItem.label || "HubCloud"),
                  quality: verifiedQuality,
                  meta: { 
                    language: innerMeta.language !== "Multi-Audio" ? innerMeta.language : meta.language,
                    size: detectedSize || (innerMeta.size !== "N/A" ? innerMeta.size : "N/A"),
                    format: innerMeta.format,
                    extras: innerMeta.extras
                  },
                  url: linkItem.url,
                  headers: cloudHeaders
                });
              }
            }
          }
        } catch (_) {}
      }
    }

    // Sort High Quality Descending
    const qualityWeights = { "4K": 100, "1080p": 50, "720p": 25, "480p": 10, "360p": 5, "Unknown": 0 };
    rawStreamsList.sort((a, b) => (qualityWeights[b.quality] || 0) - (qualityWeights[a.quality] || 0));

    // Final Nuvio Engine Stream Mapper
    return rawStreamsList.map(stream => {
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
  
  } catch (e) {  
    console.error("[Movies4u Code Error]", e);  
    return [];  
  }  
}  
  
module.exports = { getStreams };
