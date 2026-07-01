/**
 * OneTouchTV Provider for Nuvio
 * * Overhauled to use direct HTML component string matching 
 * and structural query parsing as observed via DevTools network logs.
 */
const CryptoJS = require('crypto-js');

// --- Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY || "439c478a771f35c05022f9feabcca01c";
const MAIN_URL = "https://api3.devcorp.me"; 
const TMDB_BASE = "https://api.themoviedb.org/3";

/**
 * 1. Networking Layer
 */
async function fetchRawHTML(path) {
    const cleanPath = path.startsWith('/web') ? path : `/web${path}`;
    const url = path.startsWith('http') ? path : `${MAIN_URL}${cleanPath}`;
    console.log(`[OneTouchTV] Fetching Source HTML: ${url}`);
    
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
            "Referer": "https://onetouchtv.xyz/",
            "Origin": "https://onetouchtv.xyz"
        }
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    return await response.text();
}

/**
 * 2. Main Nuvio Interface
 */
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
    try {
        console.log(`[OneTouchTV] Request: ID=${tmdbId}, Type=${mediaType}, S=${season}, E=${episode}`);

        let mediaInfo = await resolveMediaInfo(tmdbId, mediaType);
        if (!mediaInfo) {
            mediaInfo = { title: tmdbId, year: null, isTv: mediaType === "tv" || mediaType === "series" };
        }
        console.log(`[OneTouchTV] Target: ${mediaInfo.title}`);

        // 1. Fetch Search Content Page
        const searchHtml = await fetchRawHTML(`/vod/search?keyword=${encodeURIComponent(mediaInfo.title)}`);
        
        // Target structural item extraction paths via regex matching
        const entryRegex = /\/vod\/([^\s"'<>]+)/g;
        let match;
        let targetSlug = null;
        
        while ((match = entryRegex.exec(searchHtml)) !== null) {
            if (match[1].includes(mediaInfo.title.toLowerCase().replace(/[^a-z0-9]/g, '-'))) {
                targetSlug = match[1];
                break;
            }
        }
        
        if (!targetSlug && match) {
            const cleanMatches = searchHtml.match(/\/vod\/[^\s"'<>]+/g);
            if (cleanMatches && cleanMatches.length > 0) {
                targetSlug = cleanMatches[0].replace('/vod/', '');
            }
        }

        if (!targetSlug) {
            console.log("[OneTouchTV] Failed to resolve details path reference.");
            return [];
        }

        // 2. Fetch playback index reference target 
        const targetEpNum = (mediaType === "movie" || !mediaInfo.isTv) ? "1" : episode;
        const episodePath = `/vod/${targetSlug}/episode/${targetEpNum}`;
        const epPageHtml = await fetchRawHTML(episodePath);

        // 3. Locate the embedded player frame injection query components
        // Matches the target structure extracted from DevTools log payload attributes
        const fileRegex = /["']?file["']?\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i;
        const iframeRegex = /iframe[^>]+src="([^"]+player\.html[^"]+)"/i;
        
        let streamUrl = null;
        let subtitleData = null;

        const iframeMatch = epPageHtml.match(iframeRegex);
        if (iframeMatch) {
            const playerUrlString = iframeMatch[1];
            console.log(`[OneTouchTV] Found target web player: ${playerUrlString}`);
            
            const urlParams = new URLSearchParams(playerUrlString.split('?')[1]);
            streamUrl = urlParams.get('file');
            subtitleData = urlParams.get('subtitle');
        } else {
            const fileMatch = epPageHtml.match(fileRegex);
            if (fileMatch) {
                streamUrl = fileMatch[1];
            }
        }

        if (!streamUrl) {
            console.log("[OneTouchTV] Streaming file URL pointer not found inside current HTML layer.");
            return [];
        }

        // 4. Construct Nuvio stream object mappings
        const streams = [{
            name: `\uD83D\uDCFA OneTouch | Direct Server`,
            title: `${mediaInfo.title}${mediaInfo.isTv ? ` E${episode}` : ""} (${mediaInfo.year || 'N/A'})\n\uD83D\uDCCC Auto Quality \xB7 HLS`,
            url: streamUrl,
            quality: "1080p",
            headers: { 
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K)", 
                "Referer": "https://s1.devcorp.me/",
                "Origin": "https://s1.devcorp.me"
            }
        }];

        // Assign subtitles if present within player params
        if (subtitleData) {
            try {
                const parsedSubs = JSON.parse(decodeURIComponent(subtitleData));
                if (Array.isArray(parsedSubs)) {
                    streams[0].subtitles = parsedSubs.map(sub => ({
                        label: sub.name || "Unknown Language",
                        url: sub.file
                    }));
                }
            } catch (e) {
                if (subtitleData.startsWith('http')) {
                    streams[0].subtitles = [{ label: "English", url: decodeURIComponent(subtitleData) }];
                }
            }
        }

        console.log(`[OneTouchTV] Successfully compiled stream targets from web layout.`);
        return streams;
    } catch (e) {
        console.error(`[OneTouchTV] Global Parser Failure: ${e.message}`);
        return [];
    }
}

/**
 * --- Utilities ---
 */
async function resolveMediaInfo(id, type) {
    const idStr = id.toString();
    const isImdb = idStr.startsWith("tt");
    const isNumeric = /^\d+$/.test(idStr);
    const tmdbType = (type === "tv" || type === "series") ? "tv" : "movie";

    try {
        if (isImdb) {
            const findUrl = `${TMDB_BASE}/find/${idStr}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
            const res = await fetch(findUrl);
            const data = await res.json();
            const results = (tmdbType === "tv") ? data.tv_results : data.movie_results;
            if (results && results.length > 0) {
                const item = results[0];
                return {
                    id: item.id,
                    title: (tmdbType === "tv") ? item.name : item.title,
                    year: (item.first_air_date || item.release_date || "").split("-")[0],
                    isTv: tmdbType === "tv"
                };
            }
        } else if (isNumeric) {
            const url = `${TMDB_BASE}/${tmdbType}/${idStr}?api_key=${TMDB_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.id) {
                return {
                    id: data.id,
                    title: (tmdbType === "tv") ? data.name : data.title,
                    year: (data.first_air_date || data.release_date || "").split("-")[0],
                    isTv: tmdbType === "tv"
                };
            }
        }
    } catch (e) {
         console.error(`[OneTouchTV] TMDB Error: ${e.message}`);
    }
    return null;
}

module.exports = { getStreams };
if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
}
