// ============================================================= //
// Provider Nuvio : PersianStremio                               //
// Version : 1.2.0                                              //
// Endpoint : https://persianstremio.vercel.app/manifest.json   //
// ============================================================= //

var PROVIDER_NAME = "PersianStremio";
var PERSIAN_BASE = "https://persianstremio.vercel.app";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var FETCH_TIMEOUT = 12000;

var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function log(msg) { console.log("[" + PROVIDER_NAME + "] " + msg); }
function err(msg) { console.error("[" + PROVIDER_NAME + "] " + msg); }

function raceTimeout(ms) {
  return new Promise(function(_, reject) {
    setTimeout(function() { reject(new Error("Timeout " + ms + "ms")); }, ms);
  });
}

async function fetchJson(url) {
  try {
    var req = fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json"
      }
    });
    var res = await Promise.race([req, raceTimeout(FETCH_TIMEOUT)]);
    if (res && res.ok) return await res.json();
  } catch (e) {
    err("fetch failed: " + url + " -> " + (e.message || ""));
  }
  return null;
}

// ─── TMDB Details Fetcher ─────────────────────────────────────

async function getTMDBDetails(tmdbId, mediaType) {
  var isTv = mediaType === "tv" || mediaType === "series";
  var type = isTv ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&append_to_response=external_ids";
  var data = await fetchJson(url);
  if (!data) return { title: "PersianStremio Title", year: "", imdbId: null };

  return {
    title: (isTv ? data.name : data.title) || "PersianStremio Title",
    year: (isTv ? (data.first_air_date || "") : (data.release_date || "")).split("-")[0],
    imdbId: data.imdb_id || (data.external_ids && data.external_ids.imdb_id) || null
  };
}

// ─── Language & Metadata Engine ───────────────────────────────

function parseLanguageInfo(searchPool) {
  var pool = String(searchPool || "").toLowerCase();
  
  if (pool.indexOf("multi") !== -1) {
    return { header: "Multi-Audio", flags: "🌍" };
  }
  
  var hasPersian = pool.indexOf("persian") !== -1 || pool.indexOf("farsi") !== -1 || pool.indexOf("fa") !== -1 || pool.indexOf("dubbed") !== -1;
  var hasEnglish = pool.indexOf("english") !== -1 || pool.indexOf("eng") !== -1 || pool.indexOf("en") !== -1;

  if (pool.indexOf("dual") !== -1 || (hasPersian && hasEnglish)) {
    return { header: "Dual-Audio", flags: "🇺🇸 | 🇮🇷" };
  }
  if (hasPersian) {
    return { header: "Persian", flags: "🇮🇷" };
  }
  if (hasEnglish) {
    return { header: "English", flags: "🇺🇸" };
  }

  return { header: "Dual-Audio", flags: "🇺🇸 | 🇮🇷" };
}

function buildDropdownMetadata(tmdbInfo, normQual, isTv, season, episode, streamObj) {
  var title = tmdbInfo.title || "PersianStremio Title";
  var yearStr = tmdbInfo.year || "";
  
  var rawText = (streamObj.title || "") + " " + (streamObj.name || "") + " " + (streamObj.url || "");
  var searchPool = rawText.toLowerCase();

  // Subheading Line 1: 📜 Movie Name 🔹Year / 📜 Series Name 🔹Year 🔹 S1E1
  var line1 = "📜 " + title;
  if (yearStr) line1 += " 🔹 " + yearStr;
  if (isTv && season != null && episode != null) {
    line1 += " 🔹 S" + season + "E" + episode;
  }

  // Subheading Line 2: ✨ 2160p 💎 1080p 🔹🌙 WEB-DL/WEB-Rip/Blu-Ray
  var qIcon = "💎 ";
  if (normQual.indexOf("2160") !== -1 || normQual.indexOf("4k") !== -1) qIcon = "✨ ";

  var sourceVal = "WEB-DL";
  if (searchPool.indexOf("web-rip") !== -1 || searchPool.indexOf("webrip") !== -1) sourceVal = "WEB-Rip";
  else if (searchPool.indexOf("bluray") !== -1 || searchPool.indexOf("blu-ray") !== -1) sourceVal = "Blu-Ray";

  var line2 = qIcon + normQual + " 🔹🌙 " + sourceVal;

  // Subheading Line 3: ✴️ HDR/HDR10/HDR10+ | 🌈10Bit 🔹🧿 x264/x265/HEVC/DV 🔹💠 Format
  var colorVal = "SDR";
  if (searchPool.indexOf("hdr10+") !== -1) colorVal = "HDR10+";
  else if (searchPool.indexOf("hdr10") !== -1) colorVal = "HDR10";
  else if (searchPool.indexOf("hdr") !== -1) colorVal = "HDR";

  var bitVal = "";
  if (searchPool.indexOf("10bit") !== -1 || searchPool.indexOf("10-bit") !== -1) {
    bitVal = " | 🌈 10Bit";
  }

  var codecVal = "x264";
  if (searchPool.indexOf("dv") !== -1 || searchPool.indexOf("dovi") !== -1 || searchPool.indexOf("dolby vision") !== -1) codecVal = "DV";
  else if (searchPool.indexOf("hevc") !== -1) codecVal = "HEVC";
  else if (searchPool.indexOf("x265") !== -1 || searchPool.indexOf("h265") !== -1) codecVal = "x265";

  var formatVal = (streamObj.url && streamObj.url.indexOf(".mp4") !== -1) ? "MP4" : "MKV";
  var line3 = "✴️ " + colorVal + bitVal + " 🔹🧿 " + codecVal + " 🔹💠 " + formatVal;

  // Subheading Line 4: 🇺🇸 | 🇮🇷 🔹 🔊 DDP5.1/DD/TrueHD 🔹 🎧 Atmos
  var langInfo = parseLanguageInfo(searchPool);
  
  var audioCodec = "AAC";
  if (searchPool.indexOf("truehd") !== -1) audioCodec = "TrueHD";
  else if (searchPool.indexOf("ddp5.1") !== -1 || searchPool.indexOf("ddp 5.1") !== -1) audioCodec = "DDP5.1";
  else if (searchPool.indexOf("dd5.1") !== -1 || searchPool.indexOf("5.1") !== -1 || searchPool.indexOf("dd") !== -1) audioCodec = "DD";

  var line4 = langInfo.flags + " 🔹 🔊 " + audioCodec;
  if (searchPool.indexOf("atmos") !== -1) {
    line4 += " 🔹 🎧 Atmos";
  }

  // Subheading Line 5: 🏛️ URL file name
  var rawFileName = streamObj.url ? streamObj.url.split("/").pop() : PROVIDER_NAME;
  try {
    rawFileName = decodeURIComponent(rawFileName);
  } catch (e) {}

  var line5 = "🏛️ " + (streamObj.title || rawFileName || PROVIDER_NAME);

  return line1 + "\n" + line2 + "\n" + line3 + "\n" + line4 + "\n" + line5;
}

// ─── Main Stream Method ───────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
  var isTv = mediaType === "tv" || mediaType === "series";
  log("Request: tmdbId=" + tmdbId + " type=" + mediaType + " s=" + season + " e=" + episode);

  var tmdbInfo = await getTMDBDetails(tmdbId, mediaType);
  var queryId = tmdbInfo.imdbId || tmdbId;

  var streamEndpoint = "";
  if (isTv) {
    var sNum = season != null ? season : 1;
    var eNum = episode != null ? episode : 1;
    streamEndpoint = PERSIAN_BASE + "/stream/series/" + queryId + ":" + sNum + ":" + eNum + ".json";
  } else {
    streamEndpoint = PERSIAN_BASE + "/stream/movie/" + queryId + ".json";
  }

  log("Fetching streams from: " + streamEndpoint);
  var resData = await fetchJson(streamEndpoint);
  
  if ((!resData || !resData.streams || !resData.streams.length) && tmdbInfo.imdbId) {
    var fallbackEndpoint = isTv 
      ? PERSIAN_BASE + "/stream/series/" + tmdbId + ":" + (season || 1) + ":" + (episode || 1) + ".json"
      : PERSIAN_BASE + "/stream/movie/" + tmdbId + ".json";
    log("Retrying with fallback endpoint: " + fallbackEndpoint);
    resData = await fetchJson(fallbackEndpoint);
  }

  if (!resData || !resData.streams || !resData.streams.length) {
    log("No streams returned from PersianStremio");
    return [];
  }

  var out = [];
  var seen = {};

  for (var i = 0; i < resData.streams.length; i++) {
    var st = resData.streams[i];
    var streamUrl = st.url || st.externalUrl;
    if (!streamUrl || seen[streamUrl]) continue;
    seen[streamUrl] = true;

    var rawText = ((st.title || "") + " " + (st.name || "") + " " + streamUrl).toLowerCase();
    
    var normQual = "1080p";
    if (rawText.indexOf("2160") !== -1 || rawText.indexOf("4k") !== -1) normQual = "2160p";
    else if (rawText.indexOf("720") !== -1) normQual = "720p";
    else if (rawText.indexOf("480") !== -1) normQual = "480p";

    var langInfo = parseLanguageInfo(rawText);
    var metadata = buildDropdownMetadata(tmdbInfo, normQual, isTv, season, episode, st);

    out.push({
      name: "🌸 " + PROVIDER_NAME + " | " + normQual + " | " + langInfo.header,
      title: metadata,
      size: metadata,
      description: metadata,
      url: streamUrl,
      quality: "",
      language: "",
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": PERSIAN_BASE + "/"
      }
    });
  }

  // ── Priority & Resolution Sorter ──────────────────────────────
  function getResolutionScore(nameStr) {
    var pool = nameStr.toLowerCase();
    if (pool.indexOf("2160p") !== -1 || pool.indexOf("4k") !== -1) return 2160;
    if (pool.indexOf("1080p") !== -1) return 1080;
    if (pool.indexOf("720p") !== -1) return 720;
    if (pool.indexOf("480p") !== -1) return 480;
    return 0;
  }

  out.sort(function(a, b) {
    return getResolutionScore(b.name) - getResolutionScore(a.name);
  });

  log("Returning " + out.length + " sorted streams");
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
