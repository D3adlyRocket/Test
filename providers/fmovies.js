/**
 * fmovies - High-Res Only Edition (720p+)
 * Removes all 480p/360p content.
 */

const MIN_RESOLUTION = 720; // Only allow 720, 1080, 2160

const PLAYBACK_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Referer": "https://www.fmovies.gd/",
  "Origin": "https://www.fmovies.gd"
};

// Aurora requires these exact headers to prevent "Playback Error"
const AURORA_HEADERS = {
  "Origin": "https://www.fmovies.gd",
  "Referer": "https://www.fmovies.gd/",
  "User-Agent": "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36",
  "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"',
  "X-Requested-With": "com.android.browser"
};

/**
 * Filter: Checks if quality is a number >= 720
 */
function isHighRes(qualityStr) {
  const match = String(qualityStr).match(/(\d{3,4})/);
  if (!match) return false; // Remove "SD" or unknown labels
  const res = parseInt(match[1], 10);
  return res >= MIN_RESOLUTION;
}

function createStream(source, server, media) {
  // If the source doesn't meet our resolution requirement, return null
  if (!isHighRes(source.quality)) return null;

  return {
    name: `Fmovies ${server.name} [${server.language}]`,
    title: `${media.title} (${source.quality})`,
    url: source.url,
    quality: source.quality,
    headers: server.name === "Aurora" ? AURORA_HEADERS : PLAYBACK_HEADERS,
    provider: "fmovies"
  };
}

async function getStreams(tmdbIdOrMedia, mediaType = "movie", season = null, episode = null) {
  try {
    // ... (Media fetching logic remains same as previous) ...
    
    // Example logic for the Aurora Server
    const auroraStream = {
        url: "https://fast.vidplus.dev/file2/...", // This would be dynamically generated
        quality: "1080p"
    };

    const results = [];
    
    // Apply the filter while processing sources
    const validAurora = createStream(auroraStream, {name: "Aurora", language: "Eng"}, media);
    if (validAurora) results.push(validAurora);

    // Fetch from Yoru/Vyse and filter them similarly
    // const filteredYoru = yoruSources.map(s => createStream(s, yoruServer, media)).filter(Boolean);

    return results.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
  } catch (e) {
    return [];
  }
}

module.exports = { getStreams };
