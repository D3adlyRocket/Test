'use strict';

var WORKER_BASE = 'https://moviebox.s4nch1tt.workers.dev';
var MOVIEBOX_API = "https://h5-api.aoneroom.com";
var TMDB_KEY = 'd131017ccc6e5462a81c9304d21476de';

async function getStreams(tmdbId, type, season, episode) {
    var mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
    var isTv = mediaType === 'tv';
    var se = season ? parseInt(season) : 1;
    var ep = episode ? parseInt(episode) : 1;

    try {
        // 1. Get English Title from TMDB
        var tmdbRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`);
        var tmdbData = await tmdbRes.json();
        var title = tmdbData.title || tmdbData.name;
        if (!title) return [];

        // 2. SEARCH via the Worker's proxy to find ALL versions (English, Hindi, etc.)
        // We use the worker to "tunnel" a search request so your ISP doesn't block it
        var searchUrl = `${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`;
        var searchPayload = { keyword: title, page: 1, perPage: 15, subjectType: isTv ? 2 : 1 };
        
        var proxiedSearch = await fetch(WORKER_BASE + '/proxy?url=' + encodeURIComponent(searchUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchPayload)
        });
        
        var searchJson = await proxiedSearch.json();
        var items = (searchJson.data && (searchJson.data.items || searchJson.data.list)) || [];

        // 3. Match items and pull streams for EVERY version found
        var cleanTarget = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        var matchedItems = items.filter(i => {
            var cleanItem = (i.title || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem);
        });

        if (matchedItems.length === 0) return [];

        var results = [];
        for (var item of matchedItems) {
            // 4. Get Download Links for each specific version via the Worker
            var downloadUrl = `${MOVIEBOX_API}/wefeed-h5-bff/web/subject/download?subjectId=${item.subjectId}`;
            if (isTv) downloadUrl += `&se=${se}&ep=${ep}`;

            var streamRes = await fetch(WORKER_BASE + '/proxy?url=' + encodeURIComponent(downloadUrl));
            var streamJson = await streamRes.json();
            var downloads = (streamJson.data && streamJson.data.downloads) || [];

            // Detect Language Tag
            var lang = "English/Original";
            if (item.title.includes('[') && item.title.includes(']')) {
                lang = item.title.match(/\[([^\]]+)\]/)[1];
            }

            downloads.forEach(d => {
                var q = (d.resolution || 720) + "p";
                results.push({
                    name: "📺 MovieBox | " + q + " | " + lang,
                    title: item.title + "\n📺 " + q + "  🔊 " + lang + "\n(No VPN Required)",
                    url: d.url.startsWith('http') ? (WORKER_BASE + '/proxy?url=' + encodeURIComponent(d.url)) : d.url,
                    quality: q,
                    behaviorHints: { bingeGroup: 'moviebox' }
                });
            });
        }

        // 5. Final Sort: English/Original first
        return results.sort((a, b) => {
            var aIsEng = a.name.includes('English') || a.name.includes('Original');
            var bIsEng = b.name.includes('English') || b.name.includes('Original');
            if (aIsEng && !bIsEng) return -1;
            if (!aIsEng && bIsEng) return 1;
            return parseInt(b.quality) - parseInt(a.quality);
        });

    } catch (e) {
        console.error(e);
        return [];
    }
}

module.exports = { getStreams };
