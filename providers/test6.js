var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
const cheerio = require("cheerio-without-node-native");
const CryptoJS = require("crypto-js");
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const DEFAULT_API_BASE = "https://id-mapping-api-showbox-proxy.hf.space/api/media";
const WORKING_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Content-Type": "application/json"
};

// Helper to grab corresponding badge emoji for resolution
function getQualityEmoji(quality) {
  switch (quality) {
    case "Original": return "✨";
    case "4K": return "🌟";
    case "1440p": return "⚡";
    case "1080p": return "🔥";
    case "720p": return "💎";
    case "480p": return "🗜️";
    default: return "📼";
  }
}

function parseSingleToken(rawToken) {
  if (!rawToken) return "";
  if (rawToken.startsWith("eyJ")) {
    console.log("[ShowBox] Base64 JWT/JSON token detected. Attempting automatic decryption...");
    try {
      const parsedWords = CryptoJS.enc.Base64.parse(rawToken);
      const decodedStr = parsedWords.toString(CryptoJS.enc.Utf8);
      const parsed = JSON.parse(decodedStr);
      if (parsed && parsed.encrypt_data) {
        const IV_KEY = "wEiphTn!";
        const DES_KEY = "123d6cedf626dy54233aa1w6";
        const key = CryptoJS.enc.Utf8.parse(DES_KEY);
        const iv = CryptoJS.enc.Utf8.parse(IV_KEY);
        const decrypted = CryptoJS.TripleDES.decrypt(
          parsed.encrypt_data,
          key,
          {
            iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          }
        );
        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
        const decryptedJson = JSON.parse(decryptedText);
        if (decryptedJson && decryptedJson.uid) {
          return String(decryptedJson.uid);
        }
      }
    } catch (err) {
      console.error("[ShowBox] Failed to decrypt base64 uiToken:", err.message);
    }
  }
  return rawToken;
}

function getAllUiTokens() {
  try {
    let rawSetting = "";
    if (typeof global !== "undefined" && global.SCRAPER_SETTINGS && global.SCRAPER_SETTINGS.uiToken) {
      rawSetting = String(global.SCRAPER_SETTINGS.uiToken).trim();
    } else if (typeof window !== "undefined" && window.SCRAPER_SETTINGS && window.SCRAPER_SETTINGS.uiToken) {
      rawSetting = String(window.SCRAPER_SETTINGS.uiToken).trim();
    }
    if (!rawSetting) return [];
    return rawSetting.split(",").map(t => t.trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function getOssGroup() {
  try {
    if (typeof global !== "undefined" && global.SCRAPER_SETTINGS && global.SCRAPER_SETTINGS.ossGroup) {
      return String(global.SCRAPER_SETTINGS.ossGroup);
    }
    if (typeof window !== "undefined" && window.SCRAPER_SETTINGS && window.SCRAPER_SETTINGS.ossGroup) {
      return String(window.SCRAPER_SETTINGS.ossGroup);
    }
  } catch (e) {}
  return null;
}

function getApiBase() {
  try {
    if (typeof global !== "undefined" && global.SCRAPER_SETTINGS && global.SCRAPER_SETTINGS.apiBase) {
      return String(global.SCRAPER_SETTINGS.apiBase);
    }
    if (typeof window !== "undefined" && window.SCRAPER_SETTINGS && window.SCRAPER_SETTINGS.apiBase) {
      return String(window.SCRAPER_SETTINGS.apiBase);
    }
  } catch (e) {}
  return DEFAULT_API_BASE;
}

function getQualityFromName(qualityStr) {
  if (!qualityStr) return "Unknown";
  const quality = qualityStr.toUpperCase();
  if (quality === "ORG" || quality === "ORIGINAL") return "Original";
  if (quality === "4K" || quality === "2160P") return "4K";
  if (quality === "1440P" || quality === "2K") return "1440p";
  if (quality === "1080P" || quality === "FHD") return "1080p";
  if (quality === "720P" || quality === "HD") return "720p";
  if (quality === "480P" || quality === "SD") return "480p";
  if (quality === "360P") return "360p";
  if (quality === "240P") return "240p";
  const match = qualityStr.match(/(\d{3,4})[pP]?/);
  if (match) {
    const resolution = parseInt(match[1]);
    if (resolution >= 2160) return "4K";
    if (resolution >= 1440) return "1440p";
    if (resolution >= 1080) return "1080p";
    if (resolution >= 720) return "720p";
    if (resolution >= 480) return "480p";
    if (resolution >= 360) return "360p";
    return "240p";
  }
  return "Unknown";
}

function formatFileSize(sizeStr) {
  if (!sizeStr) return "Unknown Size";
  if (typeof sizeStr === "string" && (sizeStr.includes("GB") || sizeStr.includes("MB") || sizeStr.includes("KB"))) {
    return sizeStr;
  }
  if (typeof sizeStr === "number") {
    const gb = sizeStr / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = sizeStr / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }
  return sizeStr;
}

function getTMDBDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    try {
      const response = yield fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = yield response.json();
      const title = mediaType === "tv" ? data.name : data.title;
      const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
      const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
      return { title, year };
    } catch (e) {
      console.log(`[ShowBox] TMDB details query failed: ${e.message}`);
      return { title: `TMDB ID ${tmdbId}`, year: null };
    }
  });
}

function extractFebBoxShare(showboxId, mediaType, seasonNum, episodeNum, uiToken, cookieLabel, mediaInfo) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const boxType = mediaType === "tv" ? 2 : 1;
      const sharePageUrl = `https://www.febbox.com/mbp/to_share_page?box_type=${boxType}&mid=${showboxId}&json=1`;
      const shareRes = yield fetch(sharePageUrl).then((res) => res.json());
      if (!shareRes || shareRes.code !== 1 || !shareRes.data) return [];
      
      const shareLink = shareRes.data.share_link || shareRes.data.shareLink;
      if (!shareLink) return [];
      const shareKey = shareLink.split("/").pop();
      
      const listUrl = `https://www.febbox.com/file/file_share_list?share_key=${shareKey}`;
      const listRes = yield fetch(listUrl, { headers: { "Accept-Language": "en" } }).then((res) => res.json());
      if (!listRes || listRes.code !== 1 || !listRes.data || !listRes.data.file_list) return [];
      
      let fids = [];
      if (mediaType === "movie") {
        fids = listRes.data.file_list;
      } else {
        const seasonName = `season ${seasonNum}`;
        const seasonFolder = listRes.data.file_list.find((f) => f.file_name && f.file_name.toLowerCase() === seasonName);
        if (!seasonFolder) return [];
        
        const seasonListUrl = `https://www.febbox.com/file/file_share_list?share_key=${shareKey}&parent_id=${seasonFolder.fid}&page=1`;
        const seasonRes = yield fetch(seasonListUrl, { headers: { "Accept-Language": "en" } }).then((res) => res.json());
        if (!seasonRes || seasonRes.code !== 1 || !seasonRes.data || !seasonRes.data.file_list) return [];
        
        const seasonSlug = String(seasonNum).padStart(2, "0");
        const episodeSlug = String(episodeNum).padStart(2, "0");
        fids = seasonRes.data.file_list.filter(
          (f) => f.file_name && (f.file_name.toLowerCase().includes(`s${seasonSlug}e${episodeSlug}`) || f.file_name.toLowerCase().includes(`s${seasonNum}e${episodeNum}`))
        );
      }
      
      const videoHeaders = {
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.8",
        "Connection": "keep-alive",
        "Range": "bytes=0-",
        "Referer": "https://www.febbox.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      };
      const formattedCookie = uiToken.startsWith("ui=") ? uiToken : `ui=${uiToken}`;
      
      for (const file of fids) {
        const qualityUrl = `https://www.febbox.com/console/video_quality_list?fid=${file.fid}&share_key=${shareKey}`;
        const qualityRes = yield fetch(qualityUrl, { headers: { "Cookie": formattedCookie } }).then((res) => res.json()).catch(() => null);
        if (!qualityRes || !qualityRes.html) continue;
        
        const $ = cheerio.load(qualityRes.html);
        $("div.file_quality").each((i, el) => {
          const $quality = $(el);
          const streamUrl = $quality.attr("data-url");
          const qualityLabel = $quality.attr("data-quality");
          const sizeText = $quality.find(".size").text().trim();
          if (streamUrl) {
            const normalizedQuality = getQualityFromName(qualityLabel);
            const qEmoji = getQualityEmoji(normalizedQuality);
            const formattedSize = formatFileSize(sizeText || file.file_size);

            // Subheading Block Layout Design
            let line1 = mediaType === "tv" 
              ? `🎬 ${mediaInfo.title || "Unknown"} - (${mediaInfo.year || ""}) | S${String(seasonNum).padStart(2, "0")} E${String(episodeNum).padStart(2, "0")}`
              : `🍿 ${mediaInfo.title || "Unknown"} - (${mediaInfo.year || ""})`;
            let line2 = `${qEmoji} ${normalizedQuality} | 💾 ${formattedSize}`;
            let line3 = `🔗 ${file.file_name || "Direct File"} | 🍪 ${cookieLabel}`;

            streams.push({
              name: `ShowBox | ${normalizedQuality} | ${cookieLabel}`,
              title: `${line1}\n${line2}\n${line3}`,
              url: streamUrl,
              quality: normalizedQuality,
              size: formattedSize,
              headers: videoHeaders,
              provider: "showbox"
            });
          }
        });
      }
    } catch (e) {
      console.error(`[ShowBox] FebBox share extraction error: ${e.message}`);
    }
    return streams;
  });
}

function processShowBoxResponse(data, mediaInfo, mediaType, seasonNum, episodeNum, cookieLabel) {
  const streams = [];
  try {
    if (!data || !data.success || !data.versions || !Array.isArray(data.versions)) return streams;
    
    data.versions.forEach(function(version, versionIndex) {
      const versionSize = version.size || "Unknown";
      if (version.links && Array.isArray(version.links)) {
        version.links.forEach(function(link) {
          if (!link.url) return;
          const normalizedQuality = getQualityFromName(link.quality || "Unknown");
          const qEmoji = getQualityEmoji(normalizedQuality);
          const linkSize = link.size || versionSize;
          const formattedSize = formatFileSize(linkSize);
          
          let displayProvider = `ShowBox`;
          if (data.versions.length > 1) {
            displayProvider += ` V${versionIndex + 1}`;
          }

          // Subheading Block Layout Design
          let line1 = mediaType === "tv" 
            ? `🎬 ${mediaInfo.title || "Unknown"} - (${mediaInfo.year || ""}) | S${String(seasonNum).padStart(2, "0")} E${String(episodeNum).padStart(2, "0")}`
            : `🍿 ${mediaInfo.title || "Unknown"} - (${mediaInfo.year || ""})`;
          let line2 = `${qEmoji} ${normalizedQuality} | 💾 ${formattedSize}`;
          let line3 = `🔗 Stream Link | 🍪 ${cookieLabel}`;
          
          streams.push({
            name: `${displayProvider} | ${normalizedQuality} | ${cookieLabel}`,
            title: `${line1}\n${line2}\n${line3}`,
            url: link.url,
            quality: normalizedQuality,
            size: formattedSize,
            provider: "showbox",
            speed: link.speed || null
          });
        });
      }
    });
  } catch (error) {
    console.error(`[ShowBox] Error processing response: ${error.message}`);
  }
  return streams;
}

function getStreams(tmdbId, mediaType = "movie", seasonNum = null, episodeNum = null) {
  return __async(this, null, function* () {
    console.log(`[ShowBox] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
    
    const rawTokens = getAllUiTokens();
    const ossGroup = getOssGroup();
    const apiBase = getApiBase();
    
    if (rawTokens.length === 0) {
      console.error("[ShowBox] No UI token (cookie) found in settings.");
      return [];
    }
    
    let allCombinedStreams = [];
    
    try {
      const mediaInfo = yield getTMDBDetails(tmdbId, mediaType);
      
      for (let i = 0; i < rawTokens.length; i++) {
        const cookieLabel = `Cookie ${i + 1}`;
        const currentRawToken = rawTokens[i];
        const uiToken = parseSingleToken(currentRawToken);
        
        if (!uiToken) continue;
        
        console.log(`\n--- Processing ${cookieLabel} ---`);
        let cookieStreams = [];
        let proxyUrl;
        
        if (mediaType === "tv" && seasonNum && episodeNum) {
          if (ossGroup) {
            proxyUrl = `${apiBase}/tv/${tmdbId}/oss=${ossGroup}/${seasonNum}/${episodeNum}?cookie=${encodeURIComponent(uiToken)}`;
          } else {
            proxyUrl = `${apiBase}/tv/${tmdbId}/${seasonNum}/${episodeNum}?cookie=${encodeURIComponent(uiToken)}`;
          }
        } else {
          proxyUrl = `${apiBase}/movie/${tmdbId}?cookie=${encodeURIComponent(uiToken)}`;
        }
        
        let showboxId = null;
        try {
          const response = yield fetch(proxyUrl, { headers: WORKING_HEADERS });
          if (response.ok) {
            const data = yield response.json();
            cookieStreams = processShowBoxResponse(data, mediaInfo, mediaType, seasonNum, episodeNum, cookieLabel);
            if (data.id || data.mid) {
              showboxId = data.id || data.mid;
            } else if (data.data && (data.data.id || data.data.mid)) {
              showboxId = data.data.id || data.data.mid;
            }
          }
        } catch (e) {
          console.log(`[ShowBox] Proxy server lookup failed for ${cookieLabel}: ${e.message}`);
        }
        
        if (showboxId) {
          const directStreams = yield extractFebBoxShare(showboxId, mediaType, seasonNum, episodeNum, uiToken, cookieLabel, mediaInfo);
          if (directStreams.length > 0) {
            cookieStreams = cookieStreams.concat(directStreams);
          }
        }
        
        console.log(`[ShowBox] Found ${cookieStreams.length} links for ${cookieLabel}`);
        allCombinedStreams = allCombinedStreams.concat(cookieStreams);
      }
      
      allCombinedStreams.sort(function(a, b) {
        const qualityOrder = {
          "Original": 6, "4K": 5, "1440p": 4, "1080p": 3, "720p": 2, "480p": 1, "360p": 0, "240p": -1, "Unknown": -2
        };
        return (qualityOrder[b.quality] || -2) - (qualityOrder[a.quality] || -2);
      });
      
      return allCombinedStreams;
    } catch (error) {
      console.error(`[ShowBox] Scraper execution failure: ${error.message}`);
      return [];
    }
  });
}

function onSettings() {
  return __async(this, null, function* () {
    return [
      { type: "header", label: "ShowBox Configuration" },
      {
        type: "text",
        isPassword: true,
        key: "uiToken",
        label: "FebBox UI Tokens (Separated by commas)",
        placeholder: "ui=token1, ui=token2",
        description: "Add multiple tokens separated by commas. Links will display grouped by cookie indicator."
      },
      {
        type: "text",
        key: "ossGroup",
        label: "FebBox OSS Group (Optional)",
        placeholder: "",
        description: "Optional OSS group parameter."
      }
    ];
  });
}

module.exports = { getStreams, onSettings };
