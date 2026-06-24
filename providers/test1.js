/**
 * lordflix - Built from src/lordflix/
 * Generated: 2026-05-10T22:46:01.988Z
 * Enhanced: Added FebBox Share Extractor logic utilizing uiToken
 */
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
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

// src/lordflix/constants.js
var HEADERS = {
  "Accept": "*/*",
  "Origin": "https://lordflix.org",
  "Referer": "https://lordflix.org/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
};
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var LORDFLIX_API = "https://snowhouse.lordflix.club";
var MULTI_DECRYPT_API = "https://enc-dec.app/api";

// src/lordflix/utils.js
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadValues({ headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {}) }, options));
    if (!response.ok)
      throw new Error(`HTTP error ${response.status}`);
    return yield response.text();
  });
}
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const raw = yield fetchText(url, options);
    return JSON.parse(raw);
  });
}
function getTMDBDetails(tmdbId, mediaType, seasonNum = 1, episodeNum = 1) {
  return __async(this, null, function* () {
    var _a, _b;
    try {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      const response = yield fetch(url, { headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error(`TMDB API error`);
      const data = yield response.json();
      
      let runtime = data.runtime || 0;
      
      // Fixed: Directly fetches the specific TV episode details to extract true dynamic runtime (CinemaCity Logic)
      if (mediaType === "tv" && tmdbId) {
        try {
          const epUrl = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNum}/episode/${episodeNum}?api_key=${TMDB_API_KEY}`;
          const epResponse = yield fetch(epUrl, { headers: { "Accept": "application/json" } });
          if (epResponse.ok) {
            const epData = yield epResponse.json();
            if (epData.runtime) runtime = epData.runtime;
          }
        } catch(e) {}
      }

      return {
        title: mediaType === "tv" ? data.name : data.title,
        year: ((_a = mediaType === "tv" ? data.first_air_date : data.release_date) == null ? void 0 : _a.split("-")[0]) || null,
        imdbId: ((_b = data.external_ids) == null ? void 0 : _b.imdb_id) || null,
        runtime: runtime
      };
    } catch(err) {
      return { title: null, year: null, imdbId: null, runtime: 0 };
    }
  });
}

// Helper to safely extract uiToken from settings panel
function getUiToken() {
  try {
    if (typeof global !== "undefined" && global.SCRAPER_SETTINGS && global.SCRAPER_SETTINGS.uiToken) {
      return String(global.SCRAPER_SETTINGS.uiToken).trim();
    }
    if (typeof window !== "undefined" && window.SCRAPER_SETTINGS && window.SCRAPER_SETTINGS.uiToken) {
      return String(window.SCRAPER_SETTINGS.uiToken).trim();
    }
  } catch (e) {}
  return "";
}

// Extract direct FebBox links from a lordflix source file ID mapping 
function extractFebBoxShare(lordflixId, mediaType, seasonNum, episodeNum, uiToken) {
  return __async(this, null, function* () {
    const streams = [];
    if (!uiToken) return streams;
    
    try {
      const boxType = mediaType === "tv" ? 2 : 1;
      const sharePageUrl = `https://www.febbox.com/mbp/to_share_page?box_type=${boxType}&mid=${lordflixId}&json=1`;
      
      console.log(`[Lordflix-FebBox] Requesting share link: ${sharePageUrl}`);
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

      const formattedCookie = uiToken.startsWith("ui=") ? uiToken : `ui=${uiToken}`;
      const videoHeaders = {
        "Accept": "*/*",
        "Referer": "https://www.febbox.com/",
        "User-Agent": HEADERS["User-Agent"]
      };

            // Enhanced Multi-Line Formatting Engine (CinemaCity Layout Style)
      for (const file of fids) {
        const rawTitle = file.file_name || "FebBox Stream";
        const quality = "1080P";
        const audioTag = "Multi-Audio";
        const finalName = `🟣 LordFlix | ${quality} | ${audioTag}`; 

        const format = rawTitle.toLowerCase().includes(".mp4") ? "MP4" : rawTitle.toLowerCase().includes(".mkv") ? "MKV" : "M3U8 / HLS";
        const codecTag = rawTitle.toLowerCase().includes("x265") || rawTitle.toLowerCase().includes("hevc") ? "x265" : "x264";
        
        streams.push({
          name: finalName,
          title: rawTitle,
          url: `https://www.febbox.com/file/download_file?fid=${file.fid}&share_key=${shareKey}`, 
          quality: quality,
          headers: __spreadValues({ "Cookie": formattedCookie }, videoHeaders),
          _meta: {
            isCustom: true,
            title: rawTitle,
            quality: quality,
            audio: audioTag,
            server: "Server 1",
            format: format,
            codec: codecTag,
            runtime: info.runtime
          }
        });
      }

    } catch (e) {
      console.error(`[Lordflix-FebBox] Error extracting share: ${e.message}`);
    }
    return streams;
  });
}

// src/lordflix/index.js
var SERVERS = ["Berlin", "Orion", "Frankfurt", "Phoenix", "Aqua", "Moscow", "Draco", "Comet", "Oslo", "Luna", "LordFlix", "Sakura", "Rio", "Ativa"];
function encodeQuote(str) {
  return encodeURIComponent(str).replace(/%20/g, "+").replace(/\+/g, "%20");
}
function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    const streams = [];
    const uiToken = getUiToken(); // Grab the UI token entered by user

        try {
      // Pass season and episode information downstream to populate details correctly
      const info = yield getTMDBDetails(tmdbId, mediaType, seasonNum, episodeNum);
      if (!info.title || !info.imdbId)
        return streams;

      const typeParam = mediaType === "tv" ? "series" : "movie";
      const titleEnc = encodeQuote(info.title);
      
      let discoveredLordflixId = null;

      yield Promise.all(SERVERS.map((server) => __async(this, null, function* () {
        try {
          let serverUrl = `${LORDFLIX_API}/?title=${titleEnc}&type=${typeParam}&year=${info.year || ""}&imdb=${info.imdbId}&tmdb=${tmdbId}&server=${server}`;
          if (mediaType === "tv")
            serverUrl += `&season=${seasonNum}&episode=${episodeNum}`;
          const encBridgeUrl = `${MULTI_DECRYPT_API}/enc-lordflix?url=${encodeQuote(serverUrl)}`;
          const encBridgeJson = yield fetchJson(encBridgeUrl);
          if (!encBridgeJson || encBridgeJson.status !== 200 || !encBridgeJson.result)
            return;
          const proxyEncUrl = encBridgeJson.result.url;
          const signature = encBridgeJson.result.sign;
          if (!proxyEncUrl || !signature)
            return;
          const remoteEncData = yield fetchText(proxyEncUrl);
          const decResponse = yield fetch(`${MULTI_DECRYPT_API}/dec-lordflix`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: remoteEncData, sign: signature })
          });
          if (!decResponse.ok)
            return;
          const finalJson = yield decResponse.json();
          if (!finalJson || finalJson.status !== 200 || !finalJson.result || finalJson.result.error)
            return;

          // Capture the lordflix media id/mid identifier if exposed in their results payload to bootstrap febbox queries
          if (finalJson.result.id || finalJson.result.mid) {
            discoveredLordflixId = finalJson.result.id || finalJson.result.mid;
          }

          const streamList = finalJson.result.stream;
          if (!streamList || !Array.isArray(streamList) || streamList.length === 0)
            return;
            const topStream = streamList[0];
          if (topStream.type === "hls" && topStream.playlist) {
            const quality = "1080P";
            const audioTag = "Multi-Audio";
            const finalName = `🟣 LordFlix | ${quality} | ${audioTag}`;

            const displayTitle = mediaType === "tv" 
              ? `${info.title} - S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}${info.year ? ` (${info.year})` : ""}` 
              : `${info.title}${info.year ? ` (${info.year})` : ""}`;

              streams.push({
              name: finalName,
              title: displayTitle,
              url: topStream.playlist,
              quality: quality,
              type: "m3u8",
              headers: HEADERS,
              _meta: {
                isCustom: true,
                title: displayTitle,
                quality: quality,
                audio: audioTag,
                server: `[Server: ${server}]`,
                format: "M3U8 / HLS",
                codec: "x264",
                runtime: info.runtime // Maps the extracted duration value directly
              }
            });
          }

        } catch (e) {
        }
      })));

      // If we found a valid media ID mapping and the user passed down a FebBox token, call the share resolver
      if (discoveredLordflixId && uiToken) {
         const directFebBoxStreams = yield extractFebBoxShare(discoveredLordflixId, mediaType, seasonNum, episodeNum, uiToken);
         if (directFebBoxStreams.length > 0) {
            streams.push(...directFebBoxStreams);
         }
      }

            } catch (err) {
      console.error(`[Lordflix] Main Error:`, err.message);
    }

        // Unified TV and Mobile Multi-Line Layout Interceptor
    return streams.map(stream => {
      if (!stream._meta) return stream;
      try {
        const m = stream._meta;
        // Calculate dynamic runtimes precisely
        const minutes = m.runtime || stream.runtime || 0;
        const durationStr = minutes > 0 ? `${minutes} min` : "N/A";

        // Rearranged per requested specification:
        // Line 2: Quality, Audio, Duration (shifted up to replace server)
        // Line 3: Format, Codec
        // Line 4: Server gets its own line completely standalone
        const line1 = "🎬 " + m.title;
        const line2 = "💎 " + m.quality + " | 🔊 " + m.audio + " | ⏳ " + durationStr;
        const line3 = "🎞️ " + m.format + " | 📌 " + m.codec + " • WEB-DL";
        const line4 = "⛓️‍💥 " + m.server;
        
        const unifiedLayoutBlock = line1 + "\n" + line2 + "\n" + line3 + "\n" + line4;

        Object.defineProperties(stream, {
          title: { get: () => unifiedLayoutBlock, enumerable: true, configurable: true },
          description: { get: () => unifiedLayoutBlock, enumerable: true, configurable: true },
          size: { get: () => unifiedLayoutBlock, enumerable: true, configurable: true },
          qualityTag: { get: () => "", enumerable: true, configurable: true }, 
          quality: { get: () => "\x08", enumerable: true, configurable: true }, 
          language: { get: () => "", enumerable: true, configurable: true }
        });
      } catch (e) {}
      return stream;
    });
  });
}

function onSettings() {
  return __async(this, null, function* () {
    return [
      { type: "header", label: "LordFlix Configuration" },
      {
        type: "text",
        isPassword: true,
        key: "uiToken",
        label: "FebBox UI Token (Cookie)",
        placeholder: "ui=...",
        description: "Go to febbox.com, login, and copy your 'ui' cookie value from your browser."
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
