const PROVIDER_NAME = "🟡 PlayIMDb"; 
const BASE_API = "https://streamdata.vaplayer.ru/api.php"; 
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706"; 

const HEADERS = { 
  "Origin": "https://nextgencloudfabric.com", 
  "Referer": "https://nextgencloudfabric.com/", 
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" 
}; 

async function fetchWithTimeout(url, options) { 
  var timeout = 10000; 
  var signal = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(timeout) : null; 
  var mergedOpts = { ...options, headers: { ...HEADERS, ...(options?.headers || {}) } }; 
  if (signal) mergedOpts.signal = signal; 
  return await fetch(url, mergedOpts); 
} 

async function fetchJson(url, options) { 
  try { 
    var res = await fetchWithTimeout(url, options || {}); 
    if (res.ok) return await res.json(); 
    return null; 
  } catch (e) { 
    console.log("[" + PROVIDER_NAME + "] fetchJson error: " + e); 
    return null; 
  } 
} 

function formatBytes(bytes) { 
  if (!bytes || isNaN(bytes)) return "Variable Size"; 
  const units = ["B", "KB", "MB", "GB"]; 
  let i = 0; 
  while (bytes >= 1024 && i < units.length - 1) { 
    bytes /= 1024; 
    i++; 
  } 
  return `${bytes.toFixed(2)} ${units[i]}`; 
} 

function calculateCalculatedFallbackSize(quality, durationText) { 
  const mins = parseInt(durationText) || 90; 
  const norm = String(quality || "").toLowerCase(); 
  let bitrateKbps = 5200; 
  if (norm.includes("4k") || norm.includes("2160")) bitrateKbps = 16000; 
  else if (norm.includes("1080") || norm.includes("fhd")) bitrateKbps = 5200; 
  else if (norm.includes("720") || norm.includes("hd")) bitrateKbps = 2500; 
  else if (norm.includes("480") || norm.includes("sd")) bitrateKbps = 1200; 
  const dynamicVariance = 0.94 + ((mins % 9) / 100); 
  const calculatedBytes = ((bitrateKbps * dynamicVariance) * 1000 / 8) * (mins * 60); 
  return formatBytes(calculatedBytes); 
} 

async function getTmdbMetadata(id, type, season, episode) { 
  let fallbackName = "Unknown Title"; 
  let fallbackDuration = type === "tv" ? "45 min" : "90 min"; 
  try { 
    const endpoint = type === "movie" ? "movie" : "tv"; 
    const url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}`; 
    const response = await fetch(url); 
    if (!response.ok) return { name: fallbackName, year: "N/A", duration: fallbackDuration }; 
    const data = await response.json(); 
    let duration = fallbackDuration; 
    if (type === "movie" && data.runtime) { 
      duration = `${data.runtime} min`; 
    } else if (type === "tv") { 
      const epUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`; 
      const epRes = await fetch(epUrl); 
      if (epRes.ok) { 
        const epData = await epRes.json(); 
        if (epData.runtime) duration = `${epData.runtime} min`; 
        else if (data.episode_run_time && data.episode_run_time.length > 0) { 
          duration = `${data.episode_run_time[0]} min`; 
        } 
      } 
    } 
    return { 
      name: data.title || data.name || fallbackName, 
      year: (data.release_date || data.first_air_date || "").split("-")[0] || "N/A", 
      duration: duration 
    }; 
  } catch (e) { 
    return { name: fallbackName, year: "N/A", duration: fallbackDuration }; 
  } 
} 

async function getStreams(tmdbId, mediaType, season, episode) { 
  var streams = []; 
  try { 
    var isTv = mediaType === "tv" || mediaType === "series"; 
    var normType = isTv ? "tv" : "movie"; 
    if (!tmdbId) { 
      console.log("[" + PROVIDER_NAME + "] Missing TMDB ID"); 
      return streams; 
    } 

    var meta = await getTmdbMetadata(tmdbId, normType, season, episode); 
    var url = BASE_API + "?tmdb=" + tmdbId + "&type=" + normType; 
    if (isTv) { 
      if (!season || !episode) return streams; 
      url += "&season=" + season + "&episode=" + episode; 
    } 

    console.log("[" + PROVIDER_NAME + "] Fetching stream data from API: " + url); 
    var data = await fetchJson(url, { headers: HEADERS }); 
    if (data && (data.status_code == 200 || data.status_code === "200") && data.data && data.data.stream_urls) { 
      
      // 1. Determine Display Quality 
      var qualityStr = "1080p FHD"; 
      var rawQuality = "1080P"; 
      var scanText = String(data.data.file_name || '').toLowerCase();

      if (scanText.includes("2160p") || scanText.includes("4k")) { 
        qualityStr = "4K UHD"; 
        rawQuality = "2160P"; 
      } else if (scanText.includes("1080p")) { 
        qualityStr = "1080p FHD"; 
        rawQuality = "1080P"; 
      } else if (scanText.includes("720p")) { 
        qualityStr = "720p HD"; 
        rawQuality = "720P"; 
      } 

      // 2. Size calculation based on real runtime duration metrics 
      var sizeStr = calculateCalculatedFallbackSize(rawQuality, meta.duration); 

      // 3. Smart Language Mapping Engine
      var audioTypeHeader = "Original-Audio";
      var layoutLanguageDropdown = "Original";

      if (scanText.includes("dual") || (scanText.includes("hindi") && scanText.includes("english"))) {
        audioTypeHeader = "Dual-Audio";
        layoutLanguageDropdown = "English • Hindi";
      } else if (scanText.includes("multi")) {
        audioTypeHeader = "Multi-Audio";
        layoutLanguageDropdown = "Multilingual";
      } else if (scanText.includes("hindi")) {
        audioTypeHeader = "Hindi-Audio";
        layoutLanguageDropdown = "Hindi";
      } else if (scanText.includes("english")) {
        audioTypeHeader = "English-Audio";
        layoutLanguageDropdown = "English";
      }

      data.data.stream_urls.forEach((streamUrl, idx) => { 
        var lowerStream = streamUrl.toLowerCase();
        
        // 4. Resolve Server Name 
        var serverName = "Server " + (idx + 1); 
        if (lowerStream.includes("putgate.com")) serverName = "PutGate"; 
        else if (lowerStream.includes("onlinevisibilitysystem")) serverName = "Vis System"; 
        else if (lowerStream.includes("quietmidnight")) serverName = "Quiet Mid"; 
        else if (lowerStream.includes("smartincome")) serverName = "Smart Inc"; 
        else if (lowerStream.includes("remoteincome")) serverName = "Remote Inc"; 

        // 5. Detect Container Format Extensions 
        var format = "MKV"; 
        if (lowerStream.includes(".mp4")) format = "MP4"; 
        else if (lowerStream.includes(".m3u8")) format = "M3U8"; 

        var mediaLabel = meta.name + (isTv ? " S" + season + "E" + episode : ""); 

        var headerName = PROVIDER_NAME + " | " + qualityStr + " | " + audioTypeHeader; 
        
        var dropdownTitle = "🎬 " + mediaLabel + " - " + meta.year + "\n" + 
                            "⚡ " + rawQuality + " | 🌍 " + layoutLanguageDropdown + " | 💾 " + sizeStr + "\n" + 
                            "🎞️ " + format + " | ⏱️ " + meta.duration + " | 📌 " + serverName; 

        // Explicitly defining quality properties inside object mapping forces player layout to clear alternative text fields
        var streamObj = { 
          name: headerName, 
          title: dropdownTitle, 
          url: streamUrl, 
          quality: rawQuality,
          resolution: rawQuality,
          type: "url",
          behaviorHints: { notWebReady: true },
          headers: HEADERS 
        }; 

        if (data.default_subs && Array.isArray(data.default_subs) && data.default_subs.length > 0) { 
          streamObj.subtitles = data.default_subs.map(sub => { 
            return { id: sub.code || sub.lang, url: sub.url, lang: sub.lang }; 
          }); 
        } 
        streams.push(streamObj); 
      }); 
    } 
  } catch (e) { 
    console.log("[" + PROVIDER_NAME + "] Error: " + e.message); 
  } 
  return streams; 
} 

if (typeof module !== 'undefined' && module.exports) { 
  module.exports = { getStreams }; 
} else { 
  global.getStreams = getStreams; 
}
