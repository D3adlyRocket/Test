const PROVIDER_NAME = "4kHDHub";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DOMAINS_JSON_URL = "https://raw.githubusercontent.com/PirateZoro9/asura-providers/main/urls.json";
const TIMEOUT = 12000;

let baseUrl = "https://4khdhub.one";
let cachedDomains = null;
let domainCacheTime = 0;
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000;

// Evade Cloudflare Fingerprinting
const MOBILE_UAS = [
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];
let sessionUA = MOBILE_UAS[0];

async function refreshDomains() {
    if (cachedDomains && Date.now() - domainCacheTime < DOMAIN_CACHE_TTL) return;
    try {
        const res = await fetch(DOMAINS_JSON_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res && res.ok) {
            const data = await res.json();
            if (data && data["4khdhub"]) {
                cachedDomains = data;
                domainCacheTime = Date.now();
                baseUrl = data["4khdhub"];
            }
        }
    } catch (e) {}
}

function getHeaders(extra = {}) {
    return {
        "User-Agent": sessionUA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...extra
    };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT) {
    const merged = { ...options };
    if (!merged.headers) merged.headers = getHeaders();
    
    // QuickJS AbortSignal bypass wrapper
    return Promise.race([
        fetch(url, merged),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
    ]);
}

async function fetchText(url, options) {
    try {
        const res = await fetchWithTimeout(url, options);
        if (res && res.ok) return await res.text();
        return null;
    } catch (e) { return null; }
}

async function fetchJson(url, options) {
    try {
        const res = await fetchWithTimeout(url, options);
        if (res && res.ok) return await res.json();
        return null;
    } catch (e) { return null; }
}

function base64Decode(str) {
    if (typeof atob === 'function') return atob(str);
    const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let res = "", i = 0;
    str = String(str || "").replace(/[^A-Za-z0-9\+\/\=]/g, "");
    while (i < str.length) {
        const e1 = b64.indexOf(str.charAt(i++));
        const e2 = b64.indexOf(str.charAt(i++));
        const e3 = b64.indexOf(str.charAt(i++));
        const e4 = b64.indexOf(str.charAt(i++));
        res += String.fromCharCode((e1 << 2) | (e2 >> 4));
        if (e3 !== 64) res += String.fromCharCode(((e2 & 15) << 4) | (e3 >> 2));
        if (e4 !== 64) res += String.fromCharCode(((e3 & 3) << 6) | e4);
    }
    return res;
}

async function getTMDBInfo(tmdbId, mediaType) {
    const type = (mediaType === "tv" || mediaType === "series") ? "tv" : "movie";
    let title = "", year = "", imdbId = "";
    
    try {
        if (type === "tv") {
            const data = await fetchJson(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`);
            if (data) {
                title = data.name;
                year = (data.first_air_date || "").split("-")[0];
                imdbId = data.external_ids?.imdb_id || "";
            }
        } else {
            const data = await fetchJson(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
            if (data) {
                title = data.title;
                year = (data.release_date || "").split("-")[0];
                imdbId = data.imdb_id || "";
            }
        }
    } catch (e) {}
    
    return { title, year, imdbId, type };
}

async function searchSite(title, year, imdbId, isTv) {
    // 1. WP-JSON Fast Path (Bypasses fuzzy search and HTML parsing completely)
    if (imdbId) {
        try {
            const wpUrl = `${baseUrl}/wp-json/wp/v2/posts?search=${imdbId}`;
            const wpData = await fetchJson(wpUrl);
            if (wpData && wpData.length > 0) {
                console.log(`[${PROVIDER_NAME}] WP-JSON Exact Match: ${imdbId}`);
                return {
                    url: wpData[0].link,
                    title: wpData[0].title?.rendered || title,
                    content: wpData[0].content?.rendered || ""
                };
            }
        } catch (e) {}
    }

    // 2. HTML Fallback Search
    const searchUrl = `${baseUrl}/?s=${encodeURIComponent(title)}`;
    const html = await fetchText(searchUrl);
    if (!html) return null;

    const resultsBlock = html.split('id="main"')[1] || html;
    const linkRegex = /href="(https?:\/\/[^"\/]+)?(\/[^"]+)"/g;
    
    let bestMatch = null;
    const searchNorm = title.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    let match;
    while ((match = linkRegex.exec(resultsBlock)) !== null) {
        const domain = match[1] || "";
        let path = match[2];
        
        if (domain && !domain.includes("4khdhub")) continue;
        if (path.includes("/category/") || path.includes("?")) continue;
        
        const pathIsTv = path.includes("-series-");
        const pathIsMovie = path.includes("-movie-");
        if (isTv && !pathIsTv) continue;
        if (!isTv && !pathIsMovie) continue;

        const slugParts = path.split("/").filter(Boolean).pop().split("-");
        const cleanSlug = slugParts.filter(p => p !== "movie" && p !== "series" && !/^\d+$/.test(p)).join("");
        const slugNorm = cleanSlug.toLowerCase().replace(/[^a-z0-9]/g, "");

        if (slugNorm.includes(searchNorm) || searchNorm.includes(slugNorm)) {
            bestMatch = { url: baseUrl + path, title: title };
            if (year && path.includes(year)) break;
        }
    }

    return bestMatch;
}

function extractHubcloudLinks(html, targetSeason, targetEpisode, isTv) {
    const links = [];
    let searchBlock = html;

    if (isTv) {
        // Isolate to Single Episodes block to prevent Zip pack cross-contamination
        const epTabStart = html.indexOf('id="episodes"') > -1 ? html.indexOf('id="episodes"') : 
                           (html.indexOf('data-tab="episodes"') > -1 ? html.indexOf('data-tab="episodes"') : -1);
                           
        if (epTabStart > -1) {
            searchBlock = html.substring(epTabStart);
            const zipStart = searchBlock.indexOf('id="complete-pack"');
            if (zipStart > -1) searchBlock = searchBlock.substring(0, zipStart);
        }
    }

    // Dynamic domain matcher (handles .one, .link, .pw, etc. instead of foo|bar|to)
    const hubRegex = /https?:\/\/hubcloud\.[a-z0-9]+\/drive\/[a-z0-9]+/ig;
    let match;
    
    while ((match = hubRegex.exec(searchBlock)) !== null) {
        const hubUrl = match[0];
        const pos = match.index;
        const beforeBlock = searchBlock.substring(Math.max(0, pos - 1500), pos);
        
        if (isTv) {
            const seMatch = beforeBlock.match(/S0*(\d+)[.\s_\-]*E0*(\d+)/i) || beforeBlock.match(/Episode\s*0*(\d+)/i);
            if (seMatch) {
                let sNum = targetSeason;
                let eNum = targetEpisode;
                
                if (seMatch[2]) {
                    sNum = parseInt(seMatch[1]);
                    eNum = parseInt(seMatch[2]);
                } else {
                    eNum = parseInt(seMatch[1]);
                }
                
                if (sNum !== targetSeason || eNum !== targetEpisode) continue;
            } else {
                continue;
            }
        }

        const qMatch = beforeBlock.match(/(2160|1080|720|480)\s*p/i) || beforeBlock.match(/(4K|UHD)/i);
        let quality = "HD";
        if (qMatch) {
            quality = (qMatch[1].toUpperCase() === "4K" || qMatch[1].toUpperCase() === "UHD") ? "2160P" : qMatch[1].toUpperCase() + "P";
        }

        if (quality === "480P") continue;

        const sizeMatch = beforeBlock.match(/([\d.]+)\s*(GB|MB)/i);
        const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : "";

        links.push({ url: hubUrl, quality, size });
    }

    return links;
}

async function resolveHubCloud(hubLinkObj, mediaTitle) {
  var streams = [];
  var hubUrl = hubLinkObj.url;
  var q = hubLinkObj.quality;
  var fallbackSize = hubLinkObj.size;
  
  try {
    var hcHtml = await fetchText(hubUrl, { headers: getHeaders({ "Referer": baseUrl + "/" }) });
    if (!hcHtml) return streams;

    var gamerUrl = null;
    var gamerMatch = hcHtml.match(/href="([^"]+gamerxyt\.com[^"]+)"/i);
    if (gamerMatch) gamerUrl = gamerMatch[1].replace(/&amp;/g, "&");
    
    if (!gamerUrl) {
      var xHrefMatch = hcHtml.match(/x-href="([^"]+)"/i);
      if (xHrefMatch) {
        try {
          var decoded = base64Decode(xHrefMatch[1]);
          if (decoded.includes("gamerxyt.com")) gamerUrl = decoded;
        } catch (e) {}
      }
    }

    var targetHtml = hcHtml;
    if (gamerUrl) {
      var gamerHtml = await fetchText(gamerUrl, { headers: getHeaders({ "Referer": hubUrl }) });
      if (gamerHtml) targetHtml = gamerHtml;
    }

    var headerMatch = targetHtml.match(/<div[^>]*class=['"][^'"]*card-header[^'"]*['"][^>]*>([^<]+)</i);
    var filename = headerMatch ? headerMatch[1].trim() : mediaTitle;

    var fslRegex = /href="([^"]+)"[^>]*id="([^"]+)"/gi;
    var fMatch;
    while ((fMatch = fslRegex.exec(targetHtml)) !== null) {
      var finalUrl = fMatch[1];
      var btnId = fMatch[2].toLowerCase();

      if (finalUrl.includes(".zip") || finalUrl.includes(".rar") || finalUrl.startsWith("#")) continue;

      var type = "";
      if (btnId === "fsl" || finalUrl.includes("fsl")) type = "FSL";
      else if (btnId === "s3" || finalUrl.includes("fslv2")) type = "FSLv2";
      else if (finalUrl.includes(".workers.dev")) type = "Worker";

      if (type) {
        if (type === "FSL" && !finalUrl.includes("?s=")) {
          finalUrl += (finalUrl.includes("?") ? "&" : "?") + "s=" + (1 + new Date().getMinutes());
        }

        var sizeForDisplay = fallbackSize || "";
        var displayName = filename ? filename : (type);
        
        // 1. Generate stream object via makeStream layout engine
        var newStream = makeStream(
          displayName,
          type,
          finalUrl,
          q,
          type,
          gamerUrl || hubUrl,
          sizeForDisplay
        );
        
        // 2. Attach clean resolution property to object for absolute mobile sorting
        newStream._resolutionSortTag = String(q || "").toLowerCase();
        
        streams.push(newStream);
      }
    }

    // --- STREAM REORDERING ENGINE (FORCES HIGHEST QUALITY TO TOP) ---
    streams.sort(function(a, b) {
      var resA = a._resolutionSortTag || "";
      var resB = b._resolutionSortTag || "";
      
      var is4KA = resA.indexOf("2160p") !== -1 || resA.indexOf("4k") !== -1;
      var is4KB = resB.indexOf("2160p") !== -1 || resB.indexOf("4k") !== -1;
      
      var is1080A = resA.indexOf("1080p") !== -1;
      var is1080B = resB.indexOf("1080p") !== -1;

      if (is4KA && !is4KB) return -1;
      if (!is4KA && is4KB) return 1;
      
      if (is1080A && !is1080B) return -1;
      if (!is1080A && is1080B) return 1;
      
      return 0;
    });

    // 3. Clean sorting tags so we don't pollute the final output objects
    for (var i = 0; i < streams.length; i++) {
      delete streams[i]._resolutionSortTag;
    }

  } catch (e) {
    console.log("[" + PROVIDER_NAME + "] resolveHubCloud error: " + (e.message || e));
  }

  return streams;
}

// ==================== FLAWLESS STRATIFIED LAYOUT ENGINE ====================
function makeStream(name, title, url, quality, serverType, referer, fileSize) {
  var internalQuality = quality ? quality.toLowerCase() : "1080p";
  var encodedUrl = url.replace(/ /g, "%20");
  
  var cleanNameText = String(name || "").replace(/\./g, " ");
  var cleanTitleText = String(title || "").replace(/\./g, " ");
  var combinedScanText = (cleanNameText + " " + cleanTitleText + " " + encodedUrl).toLowerCase();
  var audioScan = combinedScanText.replace(/[\s\.]+/g, "");

  // 1. STRICT LANGUAGE MATRIX ENGINE
  var shortLangLabel = "English";
  var hasHindi = /\bhindi\b/i.test(combinedScanText);
  var hasEng = /\b(english|eng)\b/i.test(combinedScanText);
  var hasTamil = /\btamil\b/i.test(combinedScanText);
  var hasTelugu = /\btelugu\b/i.test(combinedScanText);
  
  var langCount = 0;
  if (hasHindi) langCount++;
  if (hasEng) langCount++;
  if (hasTamil) langCount++;
  if (hasTelugu) langCount++;

  if (/\b(multi|multi-audio|multi\.audio)\b/i.test(combinedScanText) || langCount >= 3) {
    shortLangLabel = "Multi-Audio";
  } else if (/\b(dual|dual-audio|dual\.audio|dubbed)\b/i.test(combinedScanText) || langCount === 2) {
    shortLangLabel = "Dual-Audio";
  } else {
    if (hasHindi) shortLangLabel = "Hindi";
    else if (hasTamil) shortLangLabel = "Tamil";
    else if (hasTelugu) shortLangLabel = "Telugu";
    else shortLangLabel = "English";
  }

  // 2. SERIES & MOVIE TITLE CLEANING ENGINE
  var cleanDisplayTitle = cleanNameText;
  var seasonEpisodeBlock = "";
  
  var tvMatch = cleanNameText.match(/\b(S\d{1,2}\s*E\d{1,2})\b/i);
  if (tvMatch) {
    seasonEpisodeBlock = " | " + tvMatch[1].toUpperCase().replace(/\s+/g, "");
    var tvIdx = cleanNameText.toLowerCase().indexOf(tvMatch[0].toLowerCase());
    if (tvIdx > 0) cleanDisplayTitle = cleanNameText.substring(0, tvIdx);
  }

  var yearBlock = "";
  var yearMatch = cleanDisplayTitle.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    yearBlock = yearMatch[0];
    var titleEndIdx = cleanDisplayTitle.indexOf(yearBlock);
    if (titleEndIdx > 0) cleanDisplayTitle = cleanDisplayTitle.substring(0, titleEndIdx);
  }

  cleanDisplayTitle = cleanDisplayTitle
    .replace(/AMZN|WEB-DL|AVC|x264|x265|HEVC|STAN|WEBRip|SDR|10bit/gi, "")
    .replace(/[-_()\[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  cleanDisplayTitle = cleanDisplayTitle.replace(/\b\w/g, function (c) { return c.toUpperCase(); });

  // 3. SUBHEADING LINE CONFIGURATIONS
  var qUpper = internalQuality.toUpperCase();
  var qEmoji = (internalQuality === "2160p" || internalQuality.includes("4k")) ? "🌟" : "💎";
  var line2 = qEmoji + " " + qUpper + " | 🌍 " + shortLangLabel + " | 💾 " + (fileSize || "N/A");

  var dynamicHdr = "";
  var showLightning = false;
  if (/\b(hdr10\+|hdr10p)\b/i.test(combinedScanText)) { dynamicHdr = "HDR10+"; showLightning = true; }
  else if (/\bhdr10\b/i.test(combinedScanText)) { dynamicHdr = "HDR10"; showLightning = true; }
  else if (/\bhdr\b/i.test(combinedScanText)) { dynamicHdr = "HDR"; showLightning = true; }
  else if (/\bsdr\b/i.test(combinedScanText)) { dynamicHdr = "SDR"; showLightning = true; }

  var bitDepth = /\b10bit\b/i.test(combinedScanText) ? "🔆 10Bit" : "";
  var dv = /\b(dv|dolby\s*vision)\b/i.test(combinedScanText) ? "🕵️‍♀️ DV" : "";
  var isBluRay = /\bbluray\b/i.test(combinedScanText);
  
  var codecTag = "x264";
  if (/\b(hevc|x265|265)\b/i.test(combinedScanText) || internalQuality === "2160p") codecTag = "HEVC x265";

  var line3Part1Elements = [];
  if (dynamicHdr) line3Part1Elements.push(dynamicHdr);
  if (bitDepth) line3Part1Elements.push(bitDepth);
  var line3Part1 = line3Part1Elements.join(" • ");

  var line3Part2Elements = [];
  if (isBluRay) line3Part2Elements.push("📀 BluRay");
  if (dv) line3Part2Elements.push(dv);
  var line3Part2 = line3Part2Elements.join(" • ");

  var metaParts = [];
  if (line3Part1) metaParts.push(line3Part1);
  if (line3Part2) metaParts.push(line3Part2);

  var line3 = "";
  if (metaParts.length > 0) {
    var prefix = showLightning ? "⚡ " : "";
    line3 = prefix + metaParts.join(" | ") + " | 🎥 " + codecTag;
  } else {
    line3 = "🎥 " + codecTag;
  }

  var formatTag = "🎞️ MKV";
  if (/\bmp4\b/i.test(combinedScanText) || encodedUrl.toLowerCase().split('?')[0].endsWith(".mp4")) {
    formatTag = "🎞️ MP4";
  }

  var audioChannelTag = "DDP 5.1";
  var displayAtmos = /\batmos\b/i.test(combinedScanText);

  if (audioScan.indexOf("ddp51") !== -1 && audioScan.indexOf("truehd") !== -1 && audioScan.indexOf("71") !== -1) {
    audioChannelTag = "DDP 5.1 + TrueHD 7.1";
    displayAtmos = true;
  }
  else if (audioScan.indexOf("ddp51") !== -1 && audioScan.indexOf("ddp71") !== -1) {
    audioChannelTag = "DDP 5.1 + DDP 7.1";
  }
  else if (audioScan.indexOf("ddp51") !== -1 && audioScan.indexOf("aac71") !== -1) {
    audioChannelTag = "DDP 5.1 + AAC 7.1";
  }
  else if (audioScan.indexOf("ddp51") !== -1) {
    audioChannelTag = "DDP 5.1";
  }
  else {
    if (audioScan.indexOf("truehd") !== -1) {
      audioChannelTag = "TrueHD 7.1";
    } else if (audioScan.indexOf("aac") !== -1) {
      audioChannelTag = (audioScan.indexOf("71") !== -1) ? "AAC 7.1" : "AAC 5.1";
    } else {
      audioChannelTag = "DDP 5.1";
    }
  }

  var atmosBlock = displayAtmos ? " • 🔊 Atmos" : "";
  var line4 = formatTag + " | 🎧 " + audioChannelTag + atmosBlock + " |";

  var sourceOrigin = "WEB-DL";
  if (isBluRay) sourceOrigin = "BluRay";
  else if (/\b(webrip|hdrip)\b/i.test(combinedScanText)) sourceOrigin = "WEB-Rip";

  var imaxBlock = /\bimax\b/i.test(combinedScanText) ? " | 👁️ iMAX" : "";
  var line5 = "🔗 " + (serverType || "Worker") + " | ☁️ " + sourceOrigin + imaxBlock;

  // 4. STRATIFIED LAYOUT GENERATION
  var finalName = "4KHDHub | " + qUpper + " | " + shortLangLabel;
  var finalTitle = 
    "🎬 " + cleanDisplayTitle + (yearBlock ? " - (" + yearBlock + ")" : "") + seasonEpisodeBlock + "\n" +
    line2 + "\n" +
    line3 + "\n" +
    line4 + "\n" +
    line5;

  var baseStream = {
    name: finalName,
    title: finalTitle,
    size: finalTitle, 
    url: encodedUrl,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: { request: { "Referer": referer || "https://4khdhub.org/" } }
    }
  };

  try {
    Object.defineProperties(baseStream, {
      qualityTag: { get: function() { return ""; }, enumerable: true, configurable: true },
      quality: { get: function() { return "\x08"; }, enumerable: true, configurable: true },
      language: { get: function() { return ""; }, enumerable: true, configurable: true }
    });
  } catch (e) {}

  return baseStream;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    sessionUA = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];
    await refreshDomains();

    const isTv = (mediaType === "tv" || mediaType === "series");
    let allStreams = [];

    try {
        const media = await getTMDBInfo(tmdbId, mediaType);
        if (!media.title) return allStreams;
        
        const mediaTitle = media.title + (isTv ? ` S${season?.toString().padStart(2, '0')}E${episode?.toString().padStart(2, '0')}` : "");
        console.log(`[${PROVIDER_NAME}] Request: ${mediaTitle}`);

        const match = await searchSite(media.title, media.year, media.imdbId, isTv);
        if (!match) return allStreams;

        const pageHtml = match.content || await fetchText(match.url);
        if (!pageHtml) return allStreams;

        const hubLinks = extractHubcloudLinks(pageHtml, parseInt(season), parseInt(episode), isTv);
        
        const resolvedStreamsArrays = await Promise.all(hubLinks.map(linkObj => resolveHubCloud(linkObj, mediaTitle)));
        allStreams = resolvedStreamsArrays.flat();

        // Secondary fallback container sorter
        allStreams.sort((a, b) => {
            var scanA = (a.title || "").toLowerCase();
            var scanB = (b.title || "").toLowerCase();
            var is4KA = scanA.indexOf("2160p") !== -1 || scanA.indexOf("4k") !== -1;
            var is4KB = scanB.indexOf("2160p") !== -1 || scanB.indexOf("4k") !== -1;
            if (is4KA && !is4KB) return -1;
            if (!is4KA && is4KB) return 1;
            return 0;
        });

    } catch (e) {
        console.log(`[${PROVIDER_NAME}] Fatal Error: ${e.message}`);
    }

    return allStreams;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
