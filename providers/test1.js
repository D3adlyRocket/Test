// ============================================================= //
// Provider Nuvio : DesiFlix (Indian Movies & TV Series)        //
// Version : 1.0.0                                              //
// Endpoint : https://desiflix.stremioaddon.workers.dev         //
// - Header: DesiFlix | Quality | Language                      //
// - Line 1: 🍿 Title - Year (or S/E info)                       //
// - Line 2: 🌟 Quality | 🔈 LangType | 💾 Size / Source        //
// - Line 3: 🎞️ Format • Codec | 🎧 AAC                         //
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

// ─── Metadata & Title Layout Engine ───────────────────────────

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

  var langStr = "Hindi";
  if (searchPool.indexOf("multi") !== -1) langStr = "Multi-Audio";
  else if (searchPool.indexOf("dual") !== -1) langStr = "Dual-Audio";
  else if (searchPool.indexOf("tamil") !== -1) langStr = "Tamil";
  else if (searchPool.indexOf("telugu") !== -1) langStr = "Telugu";
  else if (searchPool.indexOf("malayalam") !== -1) langStr = "Malayalam";
  else if (searchPool.indexOf("kannada") !== -1) langStr = "Kannada";

  var szMatch = searchPool.match(/(\d+(?:\.\d+)?\s*(?:gb|mb))/i);
  var sizeStr = szMatch ? szMatch[1].toUpperCase() : "Direct Stream";

  var line2 = qIcon + " " + normQual + " | 🔈 " + langStr + " | 💾 " + sizeStr;

  // Subheading Line 3
  var formatVal = (streamObj.url && streamObj.url.indexOf(".mp4") !== -1) ? "MP4" : "HTTP";
  var codecVal = "H.264";
  if (searchPool.indexOf("hevc") !== -1 || searchPool.indexOf("x265") !== -1 || searchPool.indexOf("h265") !== -1) {
    codecVal = "H.265";
  }

  var line3 = "🎞️ " + formatVal + " • " + codecVal + " | 🎧 AAC";

  return line1 + "\n" + line2 + "\n" + line3;
}

// ─── Main Stream Method ───────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
  var isTv = mediaType === "tv" || mediaType === "series";
  log("Request: tmdbId=" + tmdbId + " type=" + mediaType + " s=" + season + " e=" + episode);

  var tmdbInfo = await getTMDBDetails(tmdbId, mediaType);
  var queryId = tmdbInfo.imdbId || tmdbId;

  // Build Stremio Addon Resource URL
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
  
  // If query using IMDb ID returned no results, attempt fallback with raw TMDB ID
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

    var rawText = ((st.title || "") + " " + (st.name || "")).toLowerCase();
    
    var normQual = "1080p";
    if (rawText.indexOf("2160") !== -1 || rawText.indexOf("4k") !== -1) normQual = "2160p";
    else if (rawText.indexOf("720") !== -1) normQual = "720p";
    else if (rawText.indexOf("480") !== -1) normQual = "480p";

    var displayLang = "Original";
    if (rawText.indexOf("multi") !== -1) displayLang = "Multi-Audio";
    else if (rawText.indexOf("dual") !== -1) displayLang = "Dual-Audio";
    else if (rawText.indexOf("hindi") !== -1) displayLang = "Hindi";

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

  log("Returning " + out.length + " streams");
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
