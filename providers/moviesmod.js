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
  let lang = "Multi-Audio"; 
  if (norm.includes("DUAL")) lang = "Multi Audio";
  if (norm.includes("ENGLISH") && !norm.includes("HINDI")) lang = "English";
  
  // 2. Sizes (Upgraded matching patterns for various web environments)
  const sizeMatch = norm.match(/(\d+(?:\.\d+)?\s*[MGB]B)/i);
  let size = sizeMatch ? sizeMatch[0].replace(/\s+/g, "") : "N/A";
  
  if (size === "N/A") {
    const backupMatch = norm.match(/(\d+\.\d+)\s?G/);
    if (backupMatch) size = backupMatch[1] + "GB";
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
 * Detects quality directly from m3u8 master playlists
 */
async function detectM3U8Quality(url, headers = {}) {
  try {
    // PRIORITY 1 → filename/url itself
    const fromUrl = extractQuality(url);

    if (fromUrl !== "Unknown") {
      return fromUrl;
    }

    const resp = await fetch(url, {
      headers,
      skipSizeCheck: true
    });

    const text = await resp.text();

    // PRIORITY 2 → exact stream height matches
    const matches = [...text.matchAll(/RESOLUTION=\d+x(\d+)/gi)]
      .map(m => parseInt(m[1]))
      .filter(Boolean);

    if (!matches.length) return null;

    // Instead of taking max quality blindly,
    // choose the MOST COMMON quality in playlist
    const counts = {};

    for (const r of matches) {
      counts[r] = (counts[r] || 0) + 1;
    }

    const mostCommon = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])[0][0];

    const height = parseInt(mostCommon);

    if (height >= 2160) return "4K";
    if (height >= 1080) return "1080p";
    if (height >= 720) return "720p";
    if (height >= 480) return "480p";

  } catch (_) {}

  return null;
}

/**
 * Detects real file size using content-length header
 */
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

/**
 * Extract metadata from filenames/URLs
 */
function extractMetadataFromUrl(url) {
  const decoded = decodeURIComponent(url);

  return {
    quality: extractQuality(decoded),
    meta: parseExtraMetadata(decoded)
  };
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

  let quality = extractQuality(item.text + " " + item.href + " " + siteTitleContext);

  const meta = parseExtraMetadata(
    item.text + " " + item.href + " " + siteTitleContext
  );

  // NEW: Extract from actual URL
  const urlMeta = extractMetadataFromUrl(directM3u8);

  // NEW: Detect real stream quality
  const detectedQuality = await detectM3U8Quality(
    directM3u8,
    {
      Referer: "https://m4uplay.store/"
    }
  );

  // NEW: Detect actual file size
  const detectedSize = await detectFileSize(
    directM3u8,
    {
      Referer: "https://m4uplay.store/"
    }
  );

  rawStreamsList.push({
          server: "Player Direct",
          quality: quality !== "Unknown" ? quality: (urlMeta.quality !== "Unknown" ? urlMeta.quality: (detectedQuality || "1080p")
      ),
          meta: { ...meta, ...urlMeta.meta,
  size: urlMeta.meta.size || meta.size
},
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
              const elementText = nextNode.text() || "";
              if (href.includes("m4ulinks.com") && elementText.toLowerCase().includes("download links")) {
                if (!uniqueDownloadPages.some(p => p.href === href)) {
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
                  // Capture surrounding content block details (like resolution info embedded inside headers/paragraphs)
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
            let quality = extractQuality(target.contextualText + " " + downloadPage.parentText + " " + siteTitleContext);
            const meta = parseExtraMetadata(target.contextualText + " " + downloadPage.parentText + " " + siteTitleContext);

            if (target.href.includes("m4uplay.store")) {
              const directM3u8 = await extractDirectM3u8(target.href);
              if (directM3u8) {

  const urlMeta = extractMetadataFromUrl(directM3u8);

  const detectedQuality = await detectM3U8Quality(
    directM3u8,
    {
      Referer: "https://m4uplay.store/"
    }
  );

  const detectedSize = await detectFileSize(
    directM3u8,
    {
      Referer: "https://m4uplay.store/"
    }
  );

  if (quality === "Unknown") {
    quality = extractQuality(
      target.href + " " + directM3u8
    );
  }
                rawStreamsList.push({
                  server: "M4U Player",
                  quality: quality !== "Unknown" ? quality: (urlMeta.quality !== "Unknown" ? urlMeta.quality: (detectedQuality || "1080p")
      ),
                  meta: { ...meta, ...urlMeta.meta, size: detectedSize || urlMeta.meta.size || meta.size
},
                  url: directM3u8,
                  headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] }
                });
              }
            } else {
              const extractedLinks = await resolveAllHubCloudLinks(target.href);
              for (const linkItem of extractedLinks) {
                const searchString = `${linkItem.label || ""} ${linkItem.url || ""} ${target.contextualText} ${downloadPage.parentText} ${siteTitleContext}`;
                const innerMeta = parseExtraMetadata(searchString);
                let finalQuality = extractQuality(searchString);
                if (finalQuality === "Unknown") finalQuality = quality !== "Unknown" ? quality : "1080p";
                const urlMeta = extractMetadataFromUrl(linkItem.url);

const detectedSize = await detectFileSize(
  linkItem.url,
  {
    "User-Agent": HEADERS["User-Agent"]
  }
);
                rawStreamsList.push({
                  server: cleanServerName(linkItem.label || "HubCloud"),
                  quality: urlMeta.quality !== "Unknown" ? urlMeta.quality : finalQuality,
                  meta: { 
                    language: innerMeta.language !== "Multi-Audio" ? innerMeta.language : meta.language,
                    size: detectedSize || (innerMeta.size !== "N/A" ? innerMeta.size : (urlMeta.meta.size !== "N/A" ? urlMeta.meta.size: (meta.size !== "N/A" ? meta.size : "1.4GB"))),
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
          // Search for structured buttons/headers containing resolution details
          $inner("h1, h2, h3, h4, h5, h6, p, a.btn, a[href]").each((i, el) => {
            const currentElement = $(el);
            let href = currentElement.attr("href") || "";
            let contextText = currentElement.text() || "";

            // If it's a structural container (like an h4 pointing to a block of download buttons), 
            // merge it with downstream child nodes or button text
            if (!href) {
              const localAnchor = currentElement.find("a[href]").first();
              if (localAnchor.length) {
                href = localAnchor.attr("href") || "";
                contextText += " " + localAnchor.text();
              }
            }

            if (href.includes("hubcloud") || href.includes("hub-cloud") || href.includes("m4uplay.store")) {
              if (!targetUrls.some(t => t.href === href)) {
                // Look around the DOM tree slightly for size tags (e.g., text directly matching size expressions)
                const nearText = currentElement.parent().text() || "";
                targetUrls.push({ href, contextualText: contextText + " " + nearText });
              }
            }
          });

          for (const target of targetUrls) {
            let quality = extractQuality(target.contextualText + " " + redirectPage.parentText + " " + siteTitleContext);
            const meta = parseExtraMetadata(target.contextualText + " " + redirectPage.parentText + " " + siteTitleContext);

            if (target.href.includes("m4uplay.store")) {
              const directM3u8 = await extractDirectM3u8(target.href);
              if (directM3u8) {

  const urlMeta = extractMetadataFromUrl(directM3u8);

  const detectedQuality = await detectM3U8Quality(
    directM3u8,
    {
      Referer: "https://m4uplay.store/"
    }
  );

  const detectedSize = await detectFileSize(
    directM3u8,
    {
      Referer: "https://m4uplay.store/"
    }
  );

  if (quality === "Unknown") {
    quality = extractQuality(
      target.href + " " + directM3u8
    );
  }
                rawStreamsList.push({
                  server: "M4U Player",
                  quality:
  quality !== "Unknown"
    ? quality
    : (
        urlMeta.quality !== "Unknown"
          ? urlMeta.quality
          : (detectedQuality || "1080p")
      ),
                  meta: { ...meta, ...urlMeta.meta, size: urlMeta.meta.size || meta.size
},
                  url: directM3u8,
                  headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] }
                });
              }
            } else {
              const extractedLinks = await resolveAllHubCloudLinks(target.href);
              for (const linkItem of extractedLinks) {
                const searchString = `${linkItem.label || ""} ${linkItem.url || ""} ${target.contextualText} ${redirectPage.parentText} ${siteTitleContext}`;
                const innerMeta = parseExtraMetadata(searchString);
                let finalQuality = extractQuality(searchString);
                if (finalQuality === "Unknown") finalQuality = quality !== "Unknown" ? quality : "1080p";
              const urlMeta = extractMetadataFromUrl(linkItem.url);

              const detectedSize = await detectFileSize(
                linkItem.url,
  {
                "User-Agent": HEADERS["User-Agent"]
  }
);
                rawStreamsList.push({
                  server: cleanServerName(linkItem.label || "HubCloud"),
                  quality: urlMeta.quality !== "Unknown" ? urlMeta.quality : finalQuality,
                  meta: { 
                    language: innerMeta.language !== "Multi-Audio" ? innerMeta.language : meta.language,
                    size: detectedSize || (innerMeta.size !== "N/A" ? innerMeta.size : (urlMeta.meta.size !== "N/A" ? urlMeta.meta.size : (meta.size !== "N/A" ? meta.size : "1.4GB"))),
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

    // ─── STRICT CORRECTED SORTING LOGIC (High Quality Array Descending) ───
    const qualityWeights = { "4K": 100, "1080p": 50, "720p": 25, "480p": 10, "360p": 5, "Unknown": 0 };
    rawStreamsList.sort((a, b) => {
      return (qualityWeights[b.quality] || 0) - (qualityWeights[a.quality] || 0);
    });

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
