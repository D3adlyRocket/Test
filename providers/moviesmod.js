// Vixsrc Scraper - 2026 Updated Logic
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const BASE_URL = 'https://vixsrc.to';

function makeRequest(url, options = {}) {
    const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': BASE_URL + '/',
        ...options.headers
    };

    return fetch(url, {
        method: options.method || 'GET',
        headers: defaultHeaders,
        ...options
    }).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    });
}

async function extractStreamFromPage(mediaType, contentId, seasonNum, episodeNum) {
    // 2026 Update: Vixsrc now prefers the /embed/ path for direct stream data
    const path = mediaType === 'movie' 
        ? `/embed/movie/${contentId}` 
        : `/embed/tv/${contentId}/${seasonNum}/${episodeNum}`;
    
    const vixsrcUrl = `${BASE_URL}${path}`;
    console.log(`[Vixsrc] Targeted URL: ${vixsrcUrl}`);

    try {
        const response = await makeRequest(vixsrcUrl);
        const html = await response.text();

        // Check for Cloudflare Block
        if (html.includes("cf-challenge") || html.includes("Just a moment...")) {
            console.error("[Vixsrc] Blocked by Cloudflare. Manual solve or Proxy required.");
            return null;
        }

        let masterPlaylistUrl = null;

        // 1. Logic for dynamic Token/Expires/URL combo
        // The site often uses 'src' or 'file' instead of 'url' now
        const urlMatch = html.match(/url["']?\s*:\s*["']([^"']+)["']/i) || html.match(/src["']?\s*:\s*["']([^"']+)["']/i);
        const tokenMatch = html.match(/token["']?\s*:\s*["']([^"']+)["']/i);
        const expiresMatch = html.match(/expires["']?\s*:\s*["']([^"']+)["']/i);

        if (urlMatch && tokenMatch) {
            const baseUrl = urlMatch[1];
            const token = tokenMatch[1];
            const expires = expiresMatch ? expiresMatch[1] : "";

            // Constructing with 2026 parameter requirements
            masterPlaylistUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${token}&expires=${expires}&h=1`;
        } 
        
        // 2. Fallback: Direct M3U8 Regex
        if (!masterPlaylistUrl) {
            const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
            if (m3u8Match) masterPlaylistUrl = m3u8Match[1];
        }

        if (!masterPlaylistUrl) return null;

        // Subtitle logic (Sub.wyzie is the standard partner for Vix)
        const subApi = mediaType === 'movie' 
            ? `https://sub.wyzie.io/search?id=${contentId}`
            : `https://sub.wyzie.io/search?id=${contentId}&season=${seasonNum}&episode=${episodeNum}`;

        return { masterPlaylistUrl, subApi };
    } catch (e) {
        console.error("[Vixsrc] Extraction error:", e.message);
        return null;
    }
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    const streamData = await extractStreamFromPage(mediaType, tmdbId, seasonNum, episodeNum);
    
    if (!streamData) return [];

    return [{
        name: "Vixsrc",
        title: "Multi-Quality (HLS)",
        url: streamData.masterPlaylistUrl,
        quality: 'Auto',
        type: 'direct',
        headers: {
            'Referer': BASE_URL + '/',
            'Origin': BASE_URL,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    }];
}

module.exports = { getStreams };
