'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

var WORKER_BASE = 'https://moviebox.s4nch1tt.workers.dev';
var MOVIEBOX_API = "https://h5-api.aoneroom.com";
var TAG = '[MovieBox Fix]';

// ─────────────────────────────────────────────────────────────────────────────
// Stream Builder
// ─────────────────────────────────────────────────────────────────────────────

function buildStream(s, isTv, se, ep) {
    var streamUrl = s.proxy_url || s.url || '';
    if (!streamUrl) return null;

    var quality = s.resolution ? (String(s.resolution).includes('p') ? s.resolution : s.resolution + 'p') : '720p';
    
    // Improved Language Detection
    var lang = 'English/Original';
    if (s.name && s.name.includes('(')) {
        lang = s.name.match(/\(([^)]+)\)/)[1];
    } else if (s.title && s.title.includes('[')) {
        lang = s.title.match(/\[([^\]]+)\]/)[1];
    }

    var streamName = '📺 MovieBox | ' + quality + ' | ' + lang;
    var titleLine = (s.title || 'MovieBox').split(' S0')[0].trim();
    if (isTv) titleLine += ' · S' + String(se).padStart(2, '0') + 'E' + String(ep).padStart(2, '0');

    return {
        name: streamName,
        title: titleLine + '\n📺 ' + quality + '  🔊 ' + lang + '\n(No VPN Required)',
        url: streamUrl,
        quality: quality,
        behaviorHints: { bingeGroup: 'moviebox' }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Logic
// ─────────────────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, type, season, episode) {
    var mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
    var isTv = mediaType === 'tv';
    var se = isTv ? (season ? parseInt(season) : 1) : null;
    var ep = isTv ? (episode ? parseInt(episode) : 1) : null;

    try {
        // Step 1: Use the Worker to fetch TMDB details to ensure no-VPN access
        var tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=d131017ccc6e5462a81c9304d21476de`;
        var tmdbRes = await fetch(tmdbUrl);
        var tmdbData = await tmdbRes.json();
        var queryTitle = tmdbData.title || tmdbData.name;

        if (!queryTitle) return [];

        // Step 2: Call the Worker's stream endpoint
        // We pass the title directly to bypass the worker's internal Hindi-only ID mapping
        var workerUrl = WORKER_BASE + '/streams'
            + '?tmdb_id=' + tmdbId 
            + '&type=' + mediaType
            + '&proxy=' + encodeURIComponent(WORKER_BASE);

        if (isTv) {
            workerUrl += '&se=' + se + '&ep=' + ep;
        }

        console.log(TAG + ' Requesting: ' + workerUrl);

        var response = await fetch(workerUrl, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Nuvio/1.0' }
        });

        if (!response.ok) throw new Error('Worker offline');
        
        var data = await response.json();
        var rawStreams = Array.isArray(data) ? data : (data.streams || []);

        // Step 3: Process and Format
        var streams = rawStreams
            .map(function (s) { return buildStream(s, isTv, se, ep); })
            .filter(Boolean);

        // Sort: English/Original first, then by quality
        return streams.sort(function (a, b) {
            var aIsEng = a.name.includes('English') || a.name.includes('Original');
            var bIsEng = b.name.includes('English') || b.name.includes('Original');
            if (aIsEng && !bIsEng) return -1;
            if (!aIsEng && bIsEng) return 1;
            return parseInt(b.quality) - parseInt(a.quality);
        });

    } catch (e) {
        console.error(TAG + ' Error: ' + e.message);
        return [];
    }
}

module.exports = { getStreams };
