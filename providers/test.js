"use strict";

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var MURPH_BASE = "https://badboysxs-morpheus.hf.space"; 

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
 * STRICT FILTERING
 * Based on 1000120661.jpg, we look for the literal string "HindMovie"
 */
function isHindMovieSource(stream) {
    const name = String(stream.name || "").toLowerCase();
    const title = String(stream.title || "").toLowerCase();
    
    // Must contain "hindmovie"
    const hasHindMovie = name.includes("hindmovie") || title.includes("hindmovie");
    // Must NOT contain "hdhub" or "4khdhub"
    const isNotHDHub = !name.includes("hdhub") && !title.includes("hdhub");

    return hasHindMovie && isNotHDHub;
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
        .filter(isHindMovieSource) 
        .map(s => {
            let finalUrl = s.url;
            if (finalUrl && !finalUrl.startsWith("http")) {
                finalUrl = MURPH_BASE + (finalUrl.startsWith("/") ? "" : "/") + finalUrl;
            }

            // We keep the title exactly as shown in 1000120661.jpg 
            // so you get the "1080p 10Bit | Hindi-English" info correctly.
            return {
                name: "HindMovie",
                title: s.title || "HindMovie Stream",
                url: finalUrl,
                behaviorHints: s.behaviorHints || { bingeGroup: "hind-movie-group" }
            };
        });
}

if (typeof module !== "undefined") module.exports = { getStreams };
else global.getStreams = getStreams;
