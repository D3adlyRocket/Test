"use strict";

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var MURPH_BASE = "https://badboysxs-morpheus.hf.space"; 
var TARGET_PROVIDER = "HindMovie"; 

async function fetchJson(url) {
    try {
        const resp = await fetch(url, { method: "GET" });
        return resp.ok ? await resp.json() : null;
    } catch (e) { return null; }
}

async function resolveImdbId(id, type) {
    if (String(id).startsWith("tt")) return id;
    const tmdbType = type === "series" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${tmdbType}/${id}${type === "series" ? "/external_ids" : ""}?api_key=${TMDB_API_KEY}`;
    const data = await fetchJson(url);
    return data ? (data.imdb_id || null) : null;
}

/**
 * STRONGER FILTERING LOGIC
 * Only matches if the source site is HindMovie
 */
function isCorrectProvider(stream) {
    const name = String(stream.name || "").toLowerCase();
    const title = String(stream.title || "").toLowerCase();
    
    // We only want HindMovie. We explicitly exclude HDHub4u.
    const isHindMovie = name.includes("hindmovie") || title.includes("hindmovie");
    const isHDHub = name.includes("hdhub") || title.includes("hdhub");

    return isHindMovie && !isHDHub;
}

async function getStreams(id, type, season, episode) {
    const imdbId = await resolveImdbId(id, type);
    if (!imdbId) return [];

    const endpoint = (type === "series") 
        ? `${MURPH_BASE}/stream/series/${imdbId}:${season}:${episode}.json`
        : `${MURPH_BASE}/stream/movie/${imdbId}.json`;

    const payload = await fetchJson(endpoint);
    if (!payload || !payload.streams) return [];

    return payload.streams
        .filter(isCorrectProvider) // Use the strict provider filter
        .map(s => {
            let finalUrl = s.url;
            if (finalUrl && !finalUrl.startsWith("http")) {
                finalUrl = MURPH_BASE + (finalUrl.startsWith("/") ? "" : "/") + finalUrl;
            }

            return {
                name: `[${TARGET_PROVIDER}]`,
                title: s.title || "Hindi Stream",
                url: finalUrl,
                behaviorHints: s.behaviorHints || { bingeGroup: "hind-movie-group" }
            };
        });
}

if (typeof module !== "undefined") module.exports = { getStreams };
else global.getStreams = getStreams;
