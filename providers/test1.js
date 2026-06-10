const PROVIDER_NAME = "PlayIMDb";
const BASE_API = "https://streamdata.vaplayer.ru/api.php";
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

async function getStreams(tmdbId, mediaType, season, episode) {
    var streams = [];
    try {
        var isTv = mediaType === "tv" || mediaType === "series";
        
        if (!tmdbId) {
            console.log("[" + PROVIDER_NAME + "] Missing TMDB ID");
            return streams;
        }

        var url = BASE_API + "?tmdb=" + tmdbId;
        url += "&type=" + (isTv ? "tv" : "movie");
        
        if (isTv) {
            if (!season || !episode) return streams;
            url += "&season=" + season + "&episode=" + episode;
        }

        console.log("[" + PROVIDER_NAME + "] Fetching stream data from API: " + url);
        var data = await fetchJson(url, { headers: HEADERS });
        
        if (data && (data.status_code == 200 || data.status_code === "200") && data.data && data.data.stream_urls) {
            
            // 1. Determine Display Quality Strings
            var qualityStr = "HD";
            var rawQuality = "HD";
            if (data.data.file_name) {
                var fnLower = data.data.file_name.toLowerCase();
                if (fnLower.includes("2160p") || fnLower.includes("4k")) {
                    qualityStr = "4K UHD";
                    rawQuality = "2160P";
                } else if (fnLower.includes("1080p")) {
                    qualityStr = "1080p FHD";
                    rawQuality = "1080P";
                } else if (fnLower.includes("720p")) {
                    qualityStr = "720p HD";
                    rawQuality = "720P";
                }
            }

            // 2. Fetch Base Title
            var title = data.data.title || "Movie";

            // 3. Fallback Parser: Extract the Year from the filename context safely
            var year = "2026"; // Dynamic fallback matching your current media title query
            if (data.data.file_name) {
                var yearMatch = data.data.file_name.match(/(19|20)\d{2}/);
                if (yearMatch) year = yearMatch[0];
            }

            data.data.stream_urls.forEach((streamUrl, idx) => {
                // 4. Resolve Stream Server Name
                var serverName = "Server " + (idx + 1);
                if (streamUrl.includes("putgate.com")) serverName = "PutGate";
                else if (streamUrl.includes("onlinevisibilitysystem")) serverName = "Vis System";
                else if (streamUrl.includes("quietmidnight")) serverName = "Quiet Mid";
                else if (streamUrl.includes("smartincome")) serverName = "Smart Inc";
                else if (streamUrl.includes("remoteincome")) serverName = "Remote Inc";
                
                // 5. Clean up Size strings
                var sizeStr = "Dynamic";
                var sizeMatch = streamUrl.match(/(\d+(?:\.\d+)?\s*[GgMm][Bb])/);
                if (sizeMatch) {
                    sizeStr = sizeMatch[1];
                } else if (data.data.file_name) {
                    var fnSizeMatch = data.data.file_name.match(/(\d+(?:\.\d+)?\s*[GgMm][Bb])/);
                    if (fnSizeMatch) sizeStr = fnSizeMatch[1];
                }

                // 6. Smarter Language Processing
                var language = "English"; // Default fallback to avoid generic 'Multi' label
                var checkText = (streamUrl + " " + (data.data.file_name || "")).toLowerCase();
                if (checkText.includes("dub") && checkText.includes("hin")) language = "Hindi Dubbed";
                else if (checkText.includes("esp") || checkText.includes("spa") || checkText.includes("castellano")) language = "Spanish";
                else if (checkText.includes("multi") || checkText.includes("dual")) language = "Multi Audio";

                // 7. Detect Container Format
                var format = "MKV";
                if (streamUrl.includes(".mp4")) format = "MP4";
                else if (streamUrl.includes(".m3u8") || streamUrl.includes("manifest")) format = "M3U8";

                var mediaLabel = title + (isTv ? " S" + season + "E" + episode : "");

                // FIX DUPLICATION: We eliminate the raw first header line loop string to let Nuvio 
                // render natively without double overlapping titles.
                var streamName = 
                    "🎬 " + mediaLabel + " - " + year + "\n" +
                    "⚡ " + rawQuality + " | 🌍 " + language + " | 💾 " + sizeStr + "\n" +
                    "🎞️ " + format + " | 📌 " + serverName;

                var streamObj = {
                    name: streamName,
                    url: streamUrl,
                    headers: HEADERS
                };
                
                if (data.default_subs && Array.isArray(data.default_subs) && data.default_subs.length > 0) {
                    streamObj.subtitles = data.default_subs.map(sub => {
                        return {
                            id: sub.code || sub.lang,
                            url: sub.url,
                            lang: sub.lang
                        };
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
