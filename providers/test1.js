// ============================================================= //
// Provider Nuvio : DesiFlix (Indian Movies & TV Series)        //
// Version : 1.2.0                                              //
// Endpoint : https://desiflix.stremioaddon.workers.dev         //
// - Quality Priority Sorted: 2160p -> 1080p -> 720p -> 480p     //
// ============================================================= //

var PROVIDER_NAME = "DesiFlix";
var DESIFLIX_BASE = "https://desiflix.stremioaddon.workers.dev";
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
  if (!data) return { title: "DesiFlix Title", year: "", imdbId: null };

  return {
    title: (isTv ? data.name : data.title) || "DesiFlix Title",
    year: (isTv ? (data.first_air_date || "") : (data.release_date || "")).split("-")[0],
    imdbId: data.imdb_id || (data.external_ids && data.external_ids.imdb_id) || null
  };
}

// ─── Language & Metadata Engine ───────────────────────────────

function parseLanguage(searchPool) {
  if (searchPool.indexOf("multi") !== -1) return "Multi-Audio";
  
  var hasEnglish = searchPool.indexOf("english") !== -1 || searchPool.indexOf("eng") !== -1;
  var hasHindi = searchPool.indexOf("hindi") !== -1 || searchPool.indexOf("hin") !== -1;
  
  if ((hasEnglish && hasHindi) || searchPool.indexOf("dual") !== -1) {
    return "Dual-Audio";
  }
  if (hasHindi) return "Hindi";
  if (hasEnglish) return "English";
  if (searchPool.indexOf("tamil") !== -1) return "Tamil";
  if (searchPool.indexOf("telugu") !== -1) return "Telugu";
  if (searchPool.indexOf("malayalam") !== -1) return "Malayalam";
  if (searchPool.indexOf("kannada") !== -1) return "Kannada";
  
  return "Original";
}

function buildDropdownMetadata(tmdbInfo, normQual, isTv, season, episode, streamObj) {
  var title = tmdbInfo.title || "DesiFlix Title";
  var yearStr = tmdbInfo.year ? " (" + tmdbInfo.year + ")" : "";
  
  var rawText = (streamObj.title || "") + " " + (streamObj.name || "") + " " + (streamObj.url || "");
  var searchPool = rawText.toLowerCase();

  // Subheading Line 1
  var line1 = "🍿 " + title + yearStr;
  if (isTv && season != null && episode != null) {
    line1 += " | S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0");
  }

  // Subheading Line 2
  var qIcon = "💎";
  if (normQual.indexOf("2160") !== -1 || normQual.indexOf("4k") !== -1) qIcon = "🌟";
  else if (normQual.indexOf("1080") !== -1) qIcon = "🔥";

  var langStr = parseLanguage(searchPool);
  var szMatch = searchPool.match(/(\d+(?:\.\d+)?\s*(?:gb|mb))/i);
  var sizeStr = szMatch ? szMatch[1].toUpperCase() : "Variable Size";

  var line2 = qIcon + " " + normQual + " | 💾 " + sizeStr + " | 🔊 " + langStr;

  // Subheading Line 3
  var codecVal = "x264";
  if (searchPool.indexOf("hevc") !== -1 && (searchPool.indexOf("x265") !== -1 || searchPool.indexOf("h265") !== -1)) {
    codecVal = "HEVC x265";
  } else if (searchPool.indexOf("hevc") !== -1) {
    codecVal = "HEVC x264";
  } else if (searchPool.indexOf("x265") !== -1 || searchPool.indexOf("h265") !== -1) {
    codecVal = "x265";
  }

  var audioCodec = "AAC";
  if (searchPool.indexOf("ddp5.1") !== -1 || searchPool.indexOf("ddp 5.1") !== -1) audioCodec = "DDP5.1";
  else if (searchPool.indexOf("dd5.1") !== -1 || searchPool.indexOf("5.1") !== -1) audioCodec = "DD5.1";
  else if (searchPool.indexOf("7.1") !== -1) audioCodec = "7.1";
  else if (searchPool.indexOf("truehd") !== -1) audioCodec = "TrueHD";

  var atmosTag = searchPool.indexOf("atmos") !== -1 ? " | 🔊 Atmos" : "";
  var line3 = "🎥 " + codecVal + " | 🎧 " + audioCodec + atmosTag;

  // Subheading Line 4
  var sourceVal = "📥 WEB-DL";
  if (searchPool.indexOf("web-rip") !== -1 || searchPool.indexOf("webrip") !== -1) sourceVal = "🌐 WEB-RIP";
  else if (searchPool.indexOf("bluray") !== -1) sourceVal = "💿 BluRay";
  else if (searchPool.indexOf("hdrip") !== -1) sourceVal = "📺 HD-RIP";

  var formatVal = (streamObj.url && streamObj.url.indexOf(".mp4") !== -1) ? "MP4" : "MKV";

  var colorVal = "SDR";
  if (searchPool.indexOf("10bit") !== -1 || searchPool.indexOf("10-bit") !== -1) {
    colorVal = searchPool.indexOf("hdr") !== -1 ? "10bit HDR" : "10bit";
  } else if (searchPool.indexOf("hdr10+") !== -1) {
    colorVal = "HDR10+";
  } else if (searchPool.indexOf("hdr") !== -1) {
    colorVal = "HDR";
  } else if (searchPool.indexOf("dv") !== -1 || searchPool.indexOf("dolby vision") !== -1) {
    colorVal = "Dolby Vision";
  }

  var line4 = sourceVal + " | 📦 " + formatVal + " | 🌈 " + colorVal;

  // Subheading Line 5
  var line5 = "📎 " + PROVIDER_NAME;

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
    streamEndpoint = DESIFLIX_BASE + "/stream/series/" + queryId + ":" + sNum + ":" + eNum + ".json";
  } else {
    streamEndpoint = DESIFLIX_BASE + "/stream/movie/" + queryId + ".json";
  }

  log("Fetching streams from: " + streamEndpoint);
  var resData = await fetchJson(streamEndpoint);
  
  if ((!resData || !resData.streams || !resData.streams.length) && tmdbInfo.imdbId) {
    var fallbackEndpoint = isTv 
      ? DESIFLIX_BASE + "/stream/series/" + tmdbId + ":" + (season || 1) + ":" + (episode || 1) + ".json"
      : DESIFLIX_BASE + "/stream/movie/" + tmdbId + ".json";
    log("Retrying with fallback endpoint: " + fallbackEndpoint);
    resData = await fetchJson(fallbackEndpoint);
  }

  if (!resData || !resData.streams || !resData.streams.length) {
    log("No streams returned from DesiFlix");
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

    var displayLang = parseLanguage(rawText);
    var metadata = buildDropdownMetadata(tmdbInfo, normQual, isTv, season, episode, st);

    out.push({
      name: PROVIDER_NAME + " | " + normQual + " | " + displayLang,
      title: metadata,
      size: metadata,
      description: metadata,
      url: streamUrl,
      quality: "",
      language: "",
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": DESIFLIX_BASE + "/"
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
