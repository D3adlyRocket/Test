// movies4u.js  
// Nuvio-compatible Movies4u provider with Local Text-Block Mapping Layout  
  
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

// Helper to extract tech properties directly from mapped local link text structures
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

    // ─── OPTION A: DIRECT STREAMS FROM PAGE BODY ───
    $page("a.btn.btn-zip, a[href*='m4uplay.store']").each((i, el) => {
      const href = $page(el).attr("href");
      // Find the heading right above this link to map resolution details locally
      let parentText = $page(el).closest('p, div').prevAll('h1,h2,h3,h4,h5,p').first().text() || "";
      let elementText = $page(el).text() || "";
      let combinedContext = elementText + " " + parentText;

      if (href) {
        rawStreamsList.push({
          type: "direct_m3u8",
          url: href,
          context: combinedContext
        });
      }
    });

    // ─── OPTION B & C: MULTI-RESOLUTION LANDING REDIRECT PAGES ───
    const structuralRedirectBlocks = [];
    
    // Look for heading blocks on the landing page (e.g., "Download Mario Movie [720p]")
    $page("h1, h2, h3, h4, h5, p").each((i, el) => {
      const blockText = $page(el).text();
      
      // Look inside the immediate elements following this resolution tag
      let siblingNode = $page(el).next();
      let limit = 0;
      
      while (siblingNode.length && limit < 4) {
        const foundLink = siblingNode.find("a[href*='m4ulinks.com']").first().attr("href") || 
                          (siblingNode[0].name === "a" && siblingNode.attr("href").includes("m4ulinks.com") ? siblingNode.attr("href") : "");
        
        if (foundLink) {
          if (!structuralRedirectBlocks.some(b => b.href === foundLink)) {
            structuralRedirectBlocks.push({
              href: foundLink,
              mappedContext: blockText // We save the exact block text containing the resolution and size!
            });
          }
        }
        siblingNode = siblingNode.next();
        limit++;
      }
    });

    // Fallback if structured headers aren't parsed neatly
    if (structuralRedirectBlocks.length === 0) {
      $page("a[href*='m4ulinks.com']").each((i, el) => {
        const href = $page(el).attr("href");
        const parentText = $page(el).parent().text() || "";
        const surroundingText = $page(el).closest('div, p').text() || "";
        structuralRedirectBlocks.push({
          href: href,
          mappedContext: parentText + " " + surroundingText
        });
      });
    }

    // Process the mapped blocks
    for (const block of structuralRedirectBlocks) {
      try {
        // Only crawl relevant episode links if looking for a series
        if (mediaType === "series") {
          const seasonLower = block.mappedContext.toLowerCase();
          const sMatch = seasonLower.match(/season\s*0*(\d+)/i);
          if (sMatch && parseInt(sMatch[1]) !== (season || 1)) continue;
        }

        const innerResp = await fetch(block.href, { headers: HEADERS, skipSizeCheck: true });
        const innerHtml = await innerResp.text();
        const $inner = cheerio.load(innerHtml);
        
        const collectedEndpoints = [];
        $inner("a[href*='hubcloud'], a[href*='hub-cloud'], a[href*='m4uplay.store']").each((i, el) => {
          const targetHref = $inner(el).attr("href");
          const itemText = $inner(el).text() || "";
          if (targetHref && !collectedEndpoints.some(e => e.href === targetHref)) {
            collectedEndpoints.push({ href: targetHref, label: itemText });
          }
        });

        for (const endpoint of collectedEndpoints) {
          // Carry the mapped block text down to the final links
          const finalMappedString = endpoint.label + " " + block.mappedContext;

          if (endpoint.href.includes("m4uplay.store")) {
            const directM3u8 = await extractDirectM3u8(endpoint.href);
            if (directM3u8) {
              const meta = parseExtraMetadata(finalMappedString);
              let detectedQuality = extractQuality(finalMappedString);
              if (detectedQuality === "Unknown") detectedQuality = "1080p";

              rawStreamsList.push({
                server: "M4U Player",
                quality: detectedQuality,
                meta: meta,
                url: directM3u8,
                headers: { Referer: "https://m4uplay.store/", Origin: "https://m4uplay.store", "User-Agent": HEADERS["User-Agent"] }
              });
            }
          } else {
            // It's a HubCloud link—extract the direct download nodes
            const cloudLinks = await resolveAllHubCloudLinks(endpoint.href);
            for (const linkItem of cloudLinks) {
              const contextualSearchString = linkItem.label + " " + finalMappedString;
              const meta = parseExtraMetadata(contextualSearchString);
              let detectedQuality = extractQuality(contextualSearchString);
              if (detectedQuality === "Unknown") detectedQuality = "1080p";

              rawStreamsList.push({
                server: cleanServerName(linkItem.label || "HubCloud"),
                quality: detectedQuality,
                meta: meta,
                url: linkItem.url,
                headers: { "User-Agent": HEADERS["User-Agent"] }
              });
            }
          }
        }
      } catch (_) {}
    }

    // Filter duplicates and map outputs
    const uniquelyMappedOutputs = [];
    const absoluteTrackers = new Set();

    for (const item of rawStreamsList) {
      if (item.url && !absoluteTrackers.has(item.url)) {
        absoluteTrackers.add(item.url);
        uniquelyMappedOutputs.push(item);
      }
    }

    // Sort Quality descending
    const qualityWeights = { "4K": 100, "1080p": 50, "720p": 25, "480p": 10, "360p": 5, "Unknown": 0 };
    uniquelyMappedOutputs.sort((a, b) => (qualityWeights[b.quality] || 0) - (qualityWeights[a.quality] || 0));

    // Map straight to layout
    return uniquelyMappedOutputs.map(stream => {
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
