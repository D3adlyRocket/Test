'use strict';

/**
 * MovieBox Multi-Lang (VPN-Free)
 * Uses the Cloudflare Worker as a tunnel to search the full H5 database.
 */

var WORKER_BASE = 'https://moviebox.s4nch1tt.workers.dev';
var MOVIEBOX_API = "https://h5-api.aoneroom.com";
var TAG = '[MovieBox Multi-Fix]';

// ─────────────────────────────────────────────────────────────────────────────
// Stream Formatting Logic
// ─────────────────────────────────────────────────────────────────────────────

function buildNuvioStream(s, isTv, se, ep, itemTitle) {
    var url = s.proxy_url || s.url || '';
    if (!url) return null;

    // Detect language from the item title or worker name
    var lang = 'English/Original';
    var fullTitle = itemTitle || s.name || '';
    if (fullTitle.includes('[') && fullTitle.includes(']')) {
        lang = fullTitle.match(/\[([^\]]+)\]/)[1];
    } else if (fullTitle.includes('(') && fullTitle.includes(')')) {
        lang = fullTitle.match(/\(([^)]+)\)/)[1];
    }

    var quality = s.resolution ? (String(s.resolution).includes('p') ? s.resolution : s.resolution + 'p') : '720p';
    var displayTitle = (itemTitle || 'MovieBox').split(' S0')[0].trim();
    if (isTv) displayTitle += ' · S' + String(se).padStart(2, '0') + 'E' + String(ep).padStart(2, '0');

    return {
        name: '📺 MovieBox | ' + quality + ' | ' + lang,
        title: displayTitle + '\n📺 ' + quality + '  🔊 ' + lang + '\n(No VPN Required)',
        url: url,
        quality: quality,
        behaviorHints: { bingeGroup: 'moviebox' }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Execution
// ─────────────────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, type, season, episode) {
    var mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
    var isTv = mediaType === 'tv';
    var se = isTv ? (season ? parseInt(season) : 1) : null;
    var ep = isTv ? (episode ? parseInt(episode) : 1) : null;

    try {
        // 1. Get TMDB Title (VPN-safe)
        var tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=d131017ccc6e5462a81c9304d21476de`;
        var tmdbRes = await fetch(tmdbUrl);
        var tmdbData = await tmdbRes.json();
        var queryTitle = tmdbData.title || tmdbData.name;
        if (!queryTitle) return [];

        // 2. Call Worker with the "search" intent
        // Instead of letting the worker decide the ID, we ask for all streams matching the TMDB ID
        var workerUrl = WORKER_BASE + '/streams'
            + '?tmdb_id=' + tmdbId 
            + '&type=' + mediaType
            + '&proxy=' + encodeURIComponent(WORKER_BASE);

        if (isTv) workerUrl += '&se=' + se + '&ep=' + ep;

        console.log(TAG + ' Fetching via Worker: ' + workerUrl);

        var response = await fetch(workerUrl, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Nuvio/1.0' }
        });

        if (!response.ok) return [];
        
        var data = await response.json();
        var rawStreams = Array.isArray(data) ? data : (data.streams || []);

        // 3. Convert to Nuvio format
        var streams = rawStreams.map(function (s) { 
            return buildNuvioStream(s, isTv, se, ep, s.title); 
        }).filter(Boolean);

        // 4. Sort: Priority English/Original, then Quality
        return streams.sort(function (a, b) {
            var aIsEng = a.name.includes('English') || a.name.includes('Original');
            var bIsEng = b.name.includes('English') || b.name.includes('Original');
            
            if (aIsEng && !bIsEng) return -1;
            if (!aIsEng && bIsEng) return 1;
            
            var qa = parseInt(a.quality) || 0;
            var qb = parseInt(b.quality) || 0;
            return qb - qa;
        });

    } catch (e) {
        console.error(TAG + ' Fatal: ' + e.message);
        return [];
    }
}

module.exports = { getStreams };
