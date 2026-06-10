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
        console.log("[" + PROVIDER_NAME + "] Data received: " + JSON.stringify(data));
        
        if (data && (data.status_code == 200 || data.status_code === "200") && data.data && data.data.stream_urls) {
            
            var qualityStr = "HD";
            if (data.data.file_name) {
                var fnLower = data.data.file_name.toLowerCase();
                if (fnLower.includes("2160p") || fnLower.includes("4k")) {
                    qualityStr = "2160P";
                } else if (fnLower.includes("1080p")) {
                    qualityStr = "1080P";
                } else if (fnLower.includes("720p")) {
                    qualityStr = "720P";
                }
            }

            data.data.stream_urls.forEach((streamUrl, idx) => {
                var serverName = "Server " + (idx + 1);
                if (streamUrl.includes("putgate.com")) serverName = "PutGate";
                else if (streamUrl.includes("onlinevisibilitysystem")) serverName = "Vis System";
                else if (streamUrl.includes("quietmidnight")) serverName = "Quiet Mid";
                else if (streamUrl.includes("smartincome")) serverName = "Smart Inc";
                else if (streamUrl.includes("remoteincome")) serverName = "Remote Inc";
                
                var title = data.data.title || "";
                var streamName = title + (isTv ? " S" + season + "E" + episode : "") + " - " + PROVIDER_NAME + " | " + qualityStr + " (" + serverName + ")";

                var streamObj = {
                    name: streamName,
                    url: streamUrl,
                    headers: HEADERS
                };
                
                // Add subtitles if available natively in the JSON
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
            
            // Sort streams so PutGate is prioritized if needed, but array order is usually fine
        }

    } catch (e) {
        console.log("[" + PROVIDER_NAME + "] Error: " + e.message);
    }
    return streams;
}

if (require.main === module) {
  (async () => {
    const streams = await getStreams(
      "872585", // Oppenheimer TMDB ID
      "movie"
    );

    console.log(JSON.stringify(streams, null, 2));
  })();
}

module.exports = { getStreams };
