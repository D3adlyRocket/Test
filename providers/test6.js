/**
 * OneTouchTV Provider for Nuvio
 * * Overhauled with an aggressive double-pass regex extractor 
 * to capture deep query-string variables inside injected frames.
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
    console.log(`[OneTouchTV] Fetching Source: ${url}`);
    
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
        console.log(`[OneTouchTV] Target Title: ${mediaInfo.title}`);

        // Step 1: Query the Search Layer
        const searchHtml = await fetchRawHTML(`/vod/search?keyword=${encodeURIComponent(mediaInfo.title)}`);
        
        // Dynamic target path match extraction
        const entryRegex = /\/vod\/([0-9a-zA-D-]+)/g;
        let match;
        let targetSlug = null;
        
        // Attempt to clean title normalization lookup matching the slug formats
        const cleanTitleSlug = mediaInfo.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const broadMatches = searchHtml.match(/\/vod\/([0-9]+-[^\s"'<>]+)/g);
        
        if (broadMatches && broadMatches.length > 0) {
            // Priority match against exact name string configurations
            const ideal = broadMatches.find(m => m.toLowerCase().includes(cleanTitleSlug));
            targetSlug = ideal ? ideal.replace('/vod/', '') : broadMatches[0].replace('/vod/', '');
        }

        if (!targetSlug) {
            console.log("[OneTouchTV] Could not resolve matching content path routing.");
            return [];
        }
        console.log(`[OneTouchTV] Targeted Route Slug: ${targetSlug}`);

        // Step 2: Grab layout page context
        const targetEpNum = (mediaType === "movie" || !mediaInfo.isTv) ? "1" : episode;
        const episodePath = `/vod/${targetSlug}/episode/${targetEpNum}`;
        const epPageHtml = await fetchRawHTML(episodePath);

        // Step 3: Run the Extraction Engine against the iframe properties
        let streamUrl = null;
        let rawSubtitles = null;

        // Matches 'src="...player.html?...file=..."' attributes dynamically
        const iframeSrcRegex = /src=["']([^"']*player\.html[^"']*)["']/i;
        const iframeMatch = epPageHtml.match(iframeSrcRegex);

        if (iframeMatch) {
            const fullPlayerUrl = iframeMatch[1];
            console.log(`[OneTouchTV] Target Frame Discovered: ${fullPlayerUrl}`);
            
            // Extract attributes out of the raw URL Query segment
            const queryPart = fullPlayerUrl.split('?')[1];
            if (queryPart) {
                // Manual safe split regex decoding to bypass standard engine mutations
                const fileParamMatch = queryPart.match(/(?:^|&)file=([^&]*)/);
                const subParamMatch = queryPart.match(/(?:^|&)subtitle=([^&]*)/);
                
                if (fileParamMatch) {
                    streamUrl = decodeURIComponent(fileParamMatch[1]);
                }
                if (subParamMatch) {
                    rawSubtitles = decodeURIComponent(subParamMatch[1]);
                }
            }
        }

        // Secondary fallback search if the engine renders direct parameters inside structural scripts
        if (!streamUrl) {
            const rawUrlMatch = epPageHtml.match(/["']?file["']?\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
            if (rawUrlMatch) {
                streamUrl = rawUrlMatch[1];
            }
        }

        if (!streamUrl) {
            console.log("[OneTouchTV] Stream URL was not found within current page elements.");
            return [];
        }

        console.log(`[OneTouchTV] Found Stream URL: ${streamUrl}`);

        // Step 4: Map parameters to Nuvio Stream format rules
        const streams = [{
            name: `\uD83D\uDCFA OneTouch | Direct CDN`,
            title: `${mediaInfo.title}${mediaInfo.isTv ? ` E${episode}` : ""} (${mediaInfo.year || 'N/A'})\n\uD83D\uDCCC Auto Quality \xB7 HLS Stream`,
            url: streamUrl,
            quality: "1080p",
            headers: { 
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36", 
                "Referer": "https://s1.devcorp.me/",
                "Origin": "https://s1.devcorp.me"
            }
        }];

        // Step 5: Handle embedded subtitle array extraction safely
        if (rawSubtitles) {
            try {
                // Handles JSON structured string parameters
                const parsedSubs = JSON.parse(rawSubtitles);
                if (Array.isArray(parsedSubs)) {
                    streams[0].subtitles = parsedSubs.map(sub => ({
                        label: sub.name || "Unknown Track",
                        url: sub.file
                    })).filter(s => s.url);
                }
            } catch (e) {
                // If it is passed as a single standalone direct file path reference
                if (rawSubtitles.startsWith('http')) {
                    streams[0].subtitles = [{ label: "English Subtitle", url: rawSubtitles }];
                }
            }
        }

        return streams;
    } catch (e) {
        console.error(`[OneTouchTV] Extraction Engine Error: ${e.message}`);
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
