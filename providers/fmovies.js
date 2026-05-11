'use strict';

var TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
var WORKER_BASE = 'https://moviebox.s4nch1tt.workers.dev';
var MOVIEBOX_API = "https://h5-api.aoneroom.com";
// We use this to search the API without a VPN
var CORS_PROXY = "https://api.allorigins.win/raw?url=";

async function getStreams(tmdbId, type, season, episode) {
    var mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
    var se = season ? parseInt(season) : 1;
    var ep = episode ? parseInt(episode) : 1;

    try {
        // 1. Get Title from TMDB
        var tmdbRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        var tmdbData = await tmdbRes.json();
        var queryTitle = tmdbData.title || tmdbData.name;
        if (!queryTitle) return [];

        // 2. Search MovieBox via Proxy to find ALL language versions
        var searchUrl = `${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`;
        var searchResp = await fetch(CORS_PROXY + encodeURIComponent(searchUrl), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                keyword: queryTitle,
                page: 1,
                perPage: 20,
                subjectType: mediaType === "tv" ? 2 : 1
            })
        });

        var searchJson = await searchResp.json();
        var items = (searchJson.data && (searchJson.data.items || searchJson.data.list)) || [];

        // 3. Filter matches for the specific movie/show
        var cleanTarget = queryTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        var matches = items.filter(i => {
            var cleanItem = (i.title || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem);
        });

        if (matches.length === 0) return [];

        // 4. For every match found (English, Hindi, etc.), get the streams via the Worker
        var allStreams = [];
        for (var item of matches) {
            // Force the worker to give us links for THIS specific subjectId (this gets English if the ID is English)
            var workerUrl = WORKER_BASE + '/streams'
                + '?tmdb_id=' + tmdbId
                + '&type=' + mediaType
                + '&subjectId=' + item.subjectId // We inject the specific ID we found
                + '&proxy=' + encodeURIComponent(WORKER_BASE);

            if (mediaType === 'tv') workerUrl += `&se=${se}&ep=${ep}`;

            try {
                var res = await fetch(workerUrl);
                var data = await res.json();
                var streams = Array.isArray(data) ? data : (data.streams || []);

                // Detect Language
                var lang = "Original/English";
                if (item.title.includes('[') && item.title.includes(']')) {
                    lang = item.title.match(/\[([^\]]+)\]/)[1];
                }

                streams.forEach(s => {
                    var q = s.resolution || '720p';
                    allStreams.push({
                        name: `📺 MovieBox | ${q} | ${lang}`,
                        title: `${item.title}\n📺 ${q}  🔊 ${lang}\n(VPN-Free Link)`,
                        url: s.proxy_url || s.url,
                        quality: q,
                        behaviorHints: { bingeGroup: 'moviebox' }
                    });
                });
            } catch (e) { continue; }
        }

        // 5. Final Sort: English first, then Quality
        return allStreams.sort((a, b) => {
            var aIsEng = a.name.includes('Original') || a.name.includes('English');
            var bIsEng = b.name.includes('Original') || b.name.includes('English');
            if (aIsEng && !bIsEng) return -1;
            if (!aIsEng && bIsEng) return 1;
            return parseInt(b.quality) - parseInt(a.quality);
        });

    } catch (e) {
        return [];
    }
}

module.exports = { getStreams };
