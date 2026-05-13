"use strict";

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var MURPH_BASE = "https://badboysxs-morpheus.hf.space"; 

async function fetchJson(url) {
    try {
        const resp = await fetch(url, { method: "GET" });
        return resp.ok ? await resp.json() : null;
    } catch (e) { return null; }
}

/**
 * UPDATED: Fetches both IMDB ID and Movie Name
 */
async function resolveMediaDetails(id, type) {
    const tmdbType = type === "series" ? "tv" : "movie";
    let imdbId = String(id).startsWith("tt") ? id : null;
    let title = "Movie";

    // Fetch details from TMDB
    const detailsUrl = `https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${TMDB_API_KEY}`;
    const externalIdsUrl = `https://api.themoviedb.org/3/${tmdbType}/${id}/external_ids?api_key=${TMDB_API_KEY}`;
    
    const [details, external] = await Promise.all([
        fetchJson(detailsUrl),
        fetchJson(externalIdsUrl)
    ]);

    if (details) {
        title = details.title || details.name || "Movie";
    }
    
    if (!imdbId && external) {
        imdbId = external.imdb_id;
    }

    return { imdbId, title };
}

function isHindMovieSource(stream) {
    const name = String(stream.name || "").toLowerCase();
    const title = String(stream.title || "").toLowerCase();
    const hasHindMovie = name.includes("hindmovie") || title.includes("hindmovie");
    const isNotHDHub = !name.includes("hdhub") && !title.includes("hdhub");
    return hasHindMovie && isNotHDHub;
}

async function getStreams(id, type, season, episode) {
    // Get the ID and the Title
    const { imdbId, title: movieTitle } = await resolveMediaDetails(id, type);
    
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

            return {
                // Header format: HindMovie | Movie Title
                name: `HindMovie | ${movieTitle}`,
                title: s.title || "HindMovie Stream",
                url: finalUrl,
                behaviorHints: s.behaviorHints || { bingeGroup: "hind-movie-group" }
            };
        });
}

if (typeof module !== "undefined") module.exports = { getStreams };
else global.getStreams = getStreams;
