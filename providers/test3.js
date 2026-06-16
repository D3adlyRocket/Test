/**
 * afds - Built from src/afds/
 * Generated: 2026-06-03T07:43:43.344Z
 */
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

// src/afds/index.js
console.log("[AFDS] Initializing provider");
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://afds.pages.dev";
var API_BASE = "https://tga-hd.api.hashhackers.com";
var DEVIL_AUTH_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIU";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": USER_AGENT,
  "Referer": BASE_URL,
  "Origin": BASE_URL
};
if (DEVIL_AUTH_TOKEN)
  HEADERS["Authorization"] = `Bearer ${DEVIL_AUTH_TOKEN}`;

function formatBytes(bytes) {
  if (!+bytes)
    return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a, _b;
    try {
      let id = String(tmdbId);
      let s = season;
      let e = episode;
      let isTV = mediaType === "tv" || mediaType === "series";
      if (id.includes(":")) {
        const parts = id.split(":");
        id = parts[0];
        s = s || parts[1];
        e = e || parts[2];
        isTV = true;
      }
      let tmdbUrl = `https://api.themoviedb.org/3/${isTV ? "tv" : "movie"}/${id}?api_key=${TMDB_API_KEY}`;
      if (isTV && id.startsWith("tt")) {
        tmdbUrl = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      }
      const metaRes = yield fetch(tmdbUrl);
      const meta = yield metaRes.json();
      let baseName = "";
      if (isTV && id.startsWith("tt")) {
        baseName = (_b = (_a = meta.tv_results) == null ? void 0 : _a[0]) == null ? void 0 : _b.name;
      } else {
        baseName = isTV ? meta.name : meta.title;
      }
      if (!baseName)
        return [];
      const simpleName = baseName.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      let searchQuery = simpleName;
      let tvFilter = "";
      if (isTV && s && e) {
        const padS = String(parseInt(s)).padStart(2, "0");
        const padE = String(parseInt(e)).padStart(2, "0");
        tvFilter = `s${padS}e${padE}`;
        searchQuery = `${simpleName} ${tvFilter}`;
      }
      const apiUrl = `${API_BASE}/mix_media_files/search?q=${encodeURIComponent(searchQuery)}&page=1`;
      const searchRes = yield fetch(apiUrl, { headers: HEADERS });
      const searchData = yield searchRes.json();
      if (!searchData || !searchData.files || searchData.files.length === 0)
        return [];
        
      const matchName = simpleName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const promises = [];

      // Loop through found files, filter them, and build simultaneous API requests
      for (const file of searchData.files) {
        const name = file.file_name;
        const matchFile = name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (/\.zip$|\.rar$/i.test(name) || /part[0-9]/i.test(name) || /\.flac$|\.mp3$/i.test(name))
          continue;
        if (!matchFile.includes(matchName))
          continue;
        if (isTV && tvFilter && !matchFile.includes(tvFilter))
          continue;
          
        let quality = "SD";
        if (/4k|2160p/i.test(name))
          quality = "4K";
        else if (/1080p/i.test(name))
          quality = "1080p";
        else if (/720p/i.test(name))
          quality = "720p";
          
        const fileSize = formatBytes(parseInt(file.file_size));
        const cleanName = name.replace(/\.(mkv|mp4|avi|mov|m4v|ts|webm)$/i, "");
        
        let codec = "";
        if (/x265|h265|hevc|hev\b/i.test(name))
          codec = "HEVC";
        else if (/x264|h264|avc/i.test(name))
          codec = "H264";
        else if (/av1/i.test(name))
          codec = "AV1";
          
        let hdr = "";
        if (/dolby.?vision|\bDV\b(?!D)/i.test(name))
          hdr = "DV";
        else if (/hdr10\+/i.test(name))
          hdr = "HDR10+";
        else if (/hdr10/i.test(name))
          hdr = "HDR10";
        else if (/hdr/i.test(name))
          hdr = "HDR";
          
        let audio = "";
        if (/atmos/i.test(name))
          audio = "Atmos";
        else if (/ddp.?5\.?1/i.test(name))
          audio = "DDP5.1";
        else if (/ac3.?5.?1/i.test(name))
          audio = "AC3 5.1";
        else if (/dts/i.test(name))
          audio = "DTS";
        else if (/aac/i.test(name))
          audio = "AAC";
          
        const languages = [];
        if (/hindi/i.test(name))
          languages.push("Hindi");
        if (/english|eng/i.test(name))
          languages.push("ENG");
        if (/tamil/i.test(name))
          languages.push("Tamil");
        if (/telugu/i.test(name))
          languages.push("Telugu");
        if (/malayalam/i.test(name))
          languages.push("Malayalam");
        if (/kannada/i.test(name))
          languages.push("Kannada");
          
        const details = [fileSize];
        if (codec) details.push(codec);
        if (hdr) details.push(hdr);
        if (audio) details.push(audio);
        if (languages.length) details.push(languages.join("+"));

        // Push an independent promise tasks array to resolve later
        const genLinkUrl = `${API_BASE}/genLink?type=files&id=${file.id}`;
        promises.push(
          fetch(genLinkUrl, { headers: HEADERS })
            .then(res => res.json())
            .then(linkData => {
              const realPlayableUrl = linkData.url || linkData.link || linkData.download_url;
              if (realPlayableUrl) {
                return {
                  name: `${cleanName}\n${details.join(" \u2022 ")}`,
                  url: realPlayableUrl, // The perfect, working apranet link!
                  quality
                };
              }
              return null;
            })
            .catch(() => null) // Ignore item failures gracefully
        );
      } 

      // Execute all link fetches simultaneously
      const resolvedStreams = yield Promise.all(promises);
      
      // Filter out any broken or null links and return
      return resolvedStreams.filter(stream => stream !== null);

    } catch (e) {
      console.log(`[AFDS] Crash: ${e.message}`);
      return [];
    }
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
