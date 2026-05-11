'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Config & Constants
// ─────────────────────────────────────────────────────────────────────────────
var TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
var MOVIEBOX_API = "https://h5.aoneroom.com";
var TAG = '[MovieBox Multi]';

var BASE_HEADERS = {
    "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
    "Accept": "application/json",
    "Referer": MOVIEBOX_API + "/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function unwrap(json) {
    if (!json) return {};
    var data = json.data || json;
    return data.data || data;
}

async function getTMDBTitle(id, type) {
    var url = "https://api.themoviedb.org/3/" + (type === 'tv' ? 'tv' : 'movie') + "/" + id + "?api_key=" + TMDB_API_KEY;
    try {
        var res = await fetch(url);
        var data = await res.json();
        return data.title || data.name || '';
    } catch (e) { return ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction Logic
// ─────────────────────────────────────────────────────────────────────────────

async function fetchStreamsForId(subjectId, language, season, episode, mediaTitle) {
    var params = "subjectId=" + subjectId;
    if (season) params += "&se=" + season + "&ep=" + episode;

    var url = MOVIEBOX_API + "/wefeed-h5-bff/web/subject/download?" + params;
    try {
        var res = await fetch(url, {
            headers: Object.assign({}, BASE_HEADERS, { 
                "Referer": "https://fmoviesunblocked.net/",
                "Origin": "https://fmoviesunblocked.net"
            })
        });
        var json = await res.json();
        var data = unwrap(json);
        var downloads = data.downloads || [];

        return downloads.map(function(d) {
            var q = (d.resolution || 720) + "p";
            return {
                name: "📺 MovieBox | " + q + " | " + language,
                title: (mediaTitle || "MovieBox") + (season ? " S" + season + "E" + episode : "") + 
                       "\n📺 " + q + "  🔊 " + language + "\nSource: H5 Direct",
                url: d.url,
                quality: q,
                behaviorHints: { bingeGroup: 'moviebox' }
            };
        });
    } catch (e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main getStreams Export
// ─────────────────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, type, season, episode) {
    var mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
    var se = mediaType === 'tv' ? (season ? parseInt(season) : 1) : null;
    var ep = mediaType === 'tv' ? (episode ? parseInt(episode) : 1) : null;

    console.log(TAG + " Searching TMDB ID: " + tmdbId);

    var title = await getTMDBTitle(tmdbId, mediaType);
    if (!title) return [];

    try {
        // 1. Session Handshake (required by H5 API)
        await fetch(MOVIEBOX_API + "/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox", { headers: BASE_HEADERS }).catch(() => {});

        // 2. Search for all versions (Multi-lang)
        var searchResp = await fetch(MOVIEBOX_API + "/wefeed-h5-bff/web/subject/search", {
            method: "POST",
            headers: Object.assign({}, BASE_HEADERS, { "Content-Type": "application/json" }),
            body: JSON.stringify({
                keyword: title,
                page: 1,
                perPage: 15,
                subjectType: mediaType === "tv" ? 2 : 1
            })
        });

        var searchJson = await searchResp.json();
        var items = unwrap(searchJson).items || [];
        
        // 3. Filter items that match the title exactly or closely
        var cleanTarget = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        var matchedItems = items.filter(function(item) {
            var itemTitle = (item.title || "").toLowerCase().replace(/\sS\d+.*/, "");
            var cleanItem = itemTitle.replace(/[^a-z0-9]/g, '');
            return cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem);
        });

        if (matchedItems.length === 0) return [];

        // 4. Fetch streams for ALL matched languages (Hindi, Tamil, Original, etc.)
        var allStreamPromises = matchedItems.map(function(item) {
            var langMatch = item.title.match(/\[([^\]]+)\]/);
            var lang = langMatch ? langMatch[1] : "Original";
            return fetchStreamsForId(item.subjectId, lang, se, ep, title);
        });

        var results = await Promise.all(allStreamPromises);
        var flatResults = results.flat();

        // 5. Sort by Quality
        return flatResults.sort(function(a, b) {
            return parseInt(b.quality) - parseInt(a.quality);
        });

    } catch (e) {
        console.error(TAG + " Error: " + e.message);
        return [];
    }
}

module.exports = { getStreams };
