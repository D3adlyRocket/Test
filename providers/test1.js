const PROVIDER_NAME = "PlayIMDb"; 
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

async function getImdbRatingFallback(imdbId) {
  if (!imdbId) return null;
  try {
    // Hits an official alternative OMDB database instance for actual real-time IMDb data syncing
    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=575e921d`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.imdbRating && data.imdbRating !== "N/A") {
        return Number(data.imdbRating).toFixed(1);
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function getTmdbMetadata(id, type, season, episode) { 
  let fallbackName = "Unknown Title"; 
  let fallbackDuration = type === "tv" ? "45 min" : "90 min"; 
  try { 
    const endpoint = type === "movie" ? "movie" : "tv"; 
    const url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`; 
    const response = await fetch(url); 
    if (!response.ok) return { name: fallbackName, year: "N/A", duration: fallbackDuration, rating: "N/A" }; 
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

    let imdbId = data.imdb_id || (data.external_ids && data.external_ids.imdb_id) || null;
    let finalRating = "N/A";
    
    if (imdbId) {
      const realImdbScore = await getImdbRatingFallback(imdbId);
      if (realImdbScore) {
        finalRating = realImdbScore;
      } else if (data.vote_average) {
        // Safe fall back back to rounded scale index if database is unreachable
        finalRating = Number(data.vote_average).toFixed(1);
      }
    } else if (data.vote_average) {
      finalRating = Number(data.vote_average).toFixed(1);
    }

    return { 
      name: data.title || data.name || fallbackName, 
      year: (data.release_date || data.first_air_date || "").split("-")[0] || "N/A", 
      duration: duration,
      rating: finalRating
    }; 
  } catch (e) { 
    return { name: fallbackName, year: "N/A", duration: fallbackDuration, rating: "N/A" }; 
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

      var mediaLabel = meta.name || "Unknown Title";
      var year = meta.year || "N/A";
      var ratingStr = meta.rating !== "N/A" ? " | ⭐ " + meta.rating : "";

      data.data.stream_urls.forEach((streamUrl, idx) => { 
        var lowerStream = streamUrl.toLowerCase();
        
        var serverLabel = "Server " + (idx + 1); 

        var format = "MKV";
        if (lowerStream.includes(".mp4")) format = "MP4";
        if (lowerStream.includes(".m3u8")) format = "M3U8";

        var finalHeaderName = PROVIDER_NAME + " | " + qualityStr + " | " + audioTypeHeader;

        var line1 = isTv ? "🎬 " + mediaLabel + " - S" + season + "E" + episode + " (" + year + ")" : "🎬 " + mediaLabel + " - " + year;
        var line2 = "💎 " + rawQuality + " | 🌍 " + layoutLanguageDropdown + ratingStr;
        var line3 = "🎞️ " + format + " | ⏱️ " + meta.duration + " | 📌 " + serverLabel;
        var multiLineUnifiedTitle = line1 + "\n" + line2 + "\n" + line3;

        var streamObj = {
          name: finalHeaderName,             
          title: multiLineUnifiedTitle,   
          url: streamUrl,
          quality: rawQuality.toLowerCase(), 
          type: "direct"
        };

        streamObj.headers = HEADERS;

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
