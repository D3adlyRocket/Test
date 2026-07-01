/**
 * OneTouchTV Provider for Nuvio
 * * Features:
 * - Asian Drama & Anime specialist.
 * - Secure AES-256-CBC Decryption (Updated Cipher Handling).
 * - Full Search & Detail support updated via network capture rules.
 * - Smart ID Resolver (Support for both Android TV and Mobile IMDB IDs).
 */
const CryptoJS = require('crypto-js');

// --- Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY || "439c478a771f35c05022f9feabcca01c";
// FIXED: Restored to api3 as verified by your Network DevTools capture
const MAIN_URL = "https://api3.devcorp.me"; 
const TMDB_BASE = "https://api.themoviedb.org/3";

// Verified Security Keys
const AES_KEY = CryptoJS.enc.Utf8.parse("im72charPasswordofdInitVectorStm");
const AES_IV = CryptoJS.enc.Utf8.parse("im72charPassword");

/**
 * 1. Security Layer: Decryption
 */
function decryptOneTouch(input) {
    try {
        if (!input || typeof input !== 'string') return null;

        let normalized = input
            .replace(/-_\./g, "/")
            .replace(/@/g, "+")
            .replace(/\s+/g, "");

        const pad = normalized.length % 4;
        if (pad !== 0) {
            normalized += "=".repeat(4 - pad);
        }

        const ciphertextParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Base64.parse(normalized)
        });

        const decrypted = CryptoJS.AES.decrypt(ciphertextParams, AES_KEY, {
            iv: AES_IV,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        const rawText = decrypted.toString(CryptoJS.enc.Utf8);
        if (!rawText) throw new Error("Empty decryption result string");

        const json = JSON.parse(rawText);
        return json.result || json;
    } catch (e) {
        console.error(`[OneTouchTV] Decryption Error: ${e.message}`);
        return null;
    }
}

/**
 * 2. Networking Layer
 */
async function fetchEncrypted(path) {
    // FIXED: Prepends /web to the endpoint path if it isn't already absolute
    const cleanPath = path.startsWith('/web') ? path : `/web${path}`;
    const url = path.startsWith('http') ? path : `${MAIN_URL}${cleanPath}`;
    console.log(`[OneTouchTV] Requesting API: ${url}`);
    
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
            // FIXED: Set to match the precise security origins from your network tab
            "Referer": "https://onetouchtv.xyz/",
            "Origin": "https://onetouchtv.xyz"
        }
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const encryptedData = await response.text();
    return decryptOneTouch(encryptedData);
}

/**
 * 3. Main Nuvio Interface
 */
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
    try {
        console.log(`[OneTouchTV] Request: ID=${tmdbId}, Type=${mediaType}, S=${season}, E=${episode}`);

        let mediaInfo = await resolveMediaInfo(tmdbId, mediaType);
        if (!mediaInfo) {
            console.log("[OneTouchTV] TMDB resolution skipped or failed. Using fallback.");
            mediaInfo = { title: tmdbId, year: null, isTv: mediaType === "tv" || mediaType === "series" };
        }
        console.log(`[OneTouchTV] Target: ${mediaInfo.title} (${mediaInfo.year || 'N/A'})`);

        // Hits /web/vod/search automatically through fetchEncrypted wrapper
        const searchResults = await fetchEncrypted(`/vod/search?keyword=${encodeURIComponent(mediaInfo.title)}`);
        if (!searchResults || !Array.isArray(searchResults)) {
            console.log("[OneTouchTV] No search results found.");
            return [];
        }

        const match = searchResults.find(r => calculateSimilarity(r.title, mediaInfo.title) > 0.75);
        if (!match) {
            console.log("[OneTouchTV] No suitable title match found in search results.");
            return [];
        }
        console.log(`[OneTouchTV] Hit Found: ${match.title} (ID: ${match.id})`);

        // Hits /web/vod/{id}/detail
        const details = await fetchEncrypted(`/vod/${match.id}/detail`);
        if (!details || !details.episodes) {
            console.log("[OneTouchTV] Could not retrieve media details or episodes.");
            return [];
        }

        let targetEpisode = null;
        if (mediaType === "movie" || !mediaInfo.isTv) {
            targetEpisode = details.episodes[0];
        } else {
            targetEpisode = details.episodes.find(ep => {
                const epNum = parseInt(ep.episode.replace(/\D/g, ''));
                return epNum === parseInt(episode);
            });
        }

        if (!targetEpisode) {
            console.log(`[OneTouchTV] Episode ${episode} not found in the list.`);
            return [];
        }
        console.log(`[OneTouchTV] Resolved Episode: ${targetEpisode.episode}`);

        // Hits /web/vod/{id}/episode/{playId}
        const targetId = targetEpisode.identifier || match.id;
        const playId = targetEpisode.playId || targetEpisode.id;
        const sourcesData = await fetchEncrypted(`/vod/${targetId}/episode/${playId}`);
        
        if (!sourcesData || !sourcesData.sources) {
            console.log("[OneTouchTV] No streaming sources found for this episode.");
            return [];
        }

        const streams = [];
        sourcesData.sources.forEach(src => {
            if (!src.url) return;
            const quality = normalizeQuality(src.quality);
            streams.push({
                name: `\uD83D\uDCFA OneTouch | ${src.name || "Server"}`,
                title: `${mediaInfo.title}${mediaInfo.isTv ? ` E${episode}` : ""} (${mediaInfo.year || 'N/A'})\n\uD83D\uDCCC ${quality} \xB7 ${src.type === "hls" ? "HLS" : "MP4"}`,
                url: src.url,
                quality: quality,
                headers: src.headers || { 
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 
                    "Referer": "https://onetouchtv.xyz/" 
                }
            });
        });

        const subtitles = (sourcesData.tracks || []).map(t => ({ 
            label: t.name || "Unknown", 
            url: t.file 
        })).filter(t => t.url);

        if (subtitles.length > 0) {
            streams.forEach(s => s.subtitles = subtitles);
        }

        return streams.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
    } catch (e) {
        console.error(`[OneTouchTV] Global Error: ${e.message}`);
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
        console.error(`[OneTouchTV] TMDB Smart Resolver Error: ${e.message}`);
    }
    return null;
}

function calculateSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    const a = s1.toLowerCase().trim();
    const b = s2.toLowerCase().trim();
    if (a === b) return 1.0;
    if (a.includes(b) || b.includes(a)) return 0.9;
    
    const words1 = a.split(/\s+/);
    const words2 = b.split(/\s+/);
    const intersection = words1.filter(w => words2.includes(w));
    return intersection.length / Math.max(words1.length, words2.length);
}

function normalizeQuality(q) {
    if (!q) return "720p";
    const str = q.toString().toLowerCase();
    if (str.includes("1080")) return "1080p";
    if (str.includes("720")) return "720p";
    if (str.includes("480")) return "480p";
    return "720p";
}

module.exports = { getStreams };
if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
}
