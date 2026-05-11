'use strict';

/**
 * MovieBox Hybrid Scraper
 * - Works without VPN (uses a request proxy for API calls)
 * - Multi-language (Search results for Original, English, Hindi, etc.)
 * - Direct Stream extraction
 */

var TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
var TAG = '[MovieBox Hybrid]';

// We use an open proxy for the API requests to bypass ISP blocks without a VPN
var API_PROXY = 'https://api.allorigins.win/raw?url='; 
var MOVIEBOX_API_BASE = "https://h5-api.aoneroom.com";

async function getTMDBDetails(id, type) {
    const url = `https://api.themoviedb.org/3/${type === 'series' ? 'tv' : 'movie'}/${id}?api_key=${TMDB_API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return {
            title: data.title || data.name,
            year: (data.release_date || data.first_air_date || '').substring(0, 4)
        };
    } catch (e) { return null; }
}

async function getStreams(tmdbId, type, season, episode) {
    const mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
    const se = season ? parseInt(season) : 1;
    const ep = episode ? parseInt(episode) : 1;

    const details = await getTMDBDetails(tmdbId, mediaType);
    if (!details) return [];

    try {
        // Step 1: Search via Proxy (Bypasses VPN requirement)
        const searchUrl = `${MOVIEBOX_API_BASE}/wefeed-h5-bff/web/subject/search`;
        const body = {
            keyword: details.title,
            page: 1,
            perPage: 15,
            subjectType: mediaType === "tv" ? 2 : 1
        };

        const response = await fetch(API_PROXY + encodeURIComponent(searchUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const json = await response.json();
        const items = (json.data && json.data.items) || (json.data && json.data.list) || [];

        // Step 2: Filter for matches (All Languages)
        const cleanTarget = details.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matches = items.filter(i => {
            const cleanItem = (i.title || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem);
        });

        if (matches.length === 0) return [];

        // Step 3: Map Streams for ALL found languages
        const streamPromises = matches.map(async (match) => {
            let downloadUrl = `${MOVIEBOX_API_BASE}/wefeed-h5-bff/web/subject/download?subjectId=${match.subjectId}`;
            if (mediaType === 'tv') downloadUrl += `&se=${se}&ep=${ep}`;

            const res = await fetch(API_PROXY + encodeURIComponent(downloadUrl));
            const dJson = await res.json();
            const downloads = (dJson.data && dJson.data.downloads) || [];
            
            const lang = match.title.includes('[') ? match.title.match(/\[(.*?)\]/)[1] : "Original/English";

            return downloads.map(d => ({
                name: `📺 MovieBox | ${d.resolution || '720'}p | ${lang}`,
                title: `${match.title}\nQuality: ${d.resolution}p\nLanguage: ${lang}\n(No VPN Required)`,
                url: d.url,
                quality: `${d.resolution}p`,
                headers: {
                    "Referer": "https://fmoviesunblocked.net/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            }));
        });

        const allResults = await Promise.all(streamPromises);
        return allResults.flat();

    } catch (e) {
        console.error(TAG, e);
        return [];
    }
}

module.exports = { getStreams };
