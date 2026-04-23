// StreamM4U Provider for Nuvio
// Final Revision: Token-Based Fetching & Multi-Server Logic

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE = 'https://streamm4u.com.co';
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36';

async function httpGet(url, headers) {
    const r = await fetch(url, {
        headers: Object.assign({ 'User-Agent': UA, 'Referer': BASE + '/' }, headers || {})
    });
    return await r.text();
}

async function getStreams(tmdbId, mediaType) {
    try {
        // 1. Get Title from TMDB
        const tmdbResp = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`);
        const tmdbData = await tmdbResp.json();
        const title = tmdbData.title || tmdbData.name;

        // 2. Search for the movie
        const searchHtml = await httpGet(`${BASE}/search/${encodeURIComponent(title).replace(/%20/g, '+')}`);
        const movieLinkMatch = searchHtml.match(/href="(https:\/\/streamm4u\.com\.co\/(?:movies|tv)\/[^"]+)"/);
        
        if (!movieLinkMatch) return [];
        const movieUrl = movieLinkMatch[1];
        
        // 3. Get the Movie Page and extract the "ID" (like ybec0)
        const moviePageHtml = await httpGet(movieUrl);
        const dataIdMatch = moviePageHtml.match(/data-id="([^"]+)"/) || moviePageHtml.match(/var\s+id\s*=\s*['"]([^'"]+)['"]/);
        
        if (!dataIdMatch) return [];
        const internalId = dataIdMatch[1];

        // 4. Mimic the "Server Click" to get the Sources
        // This is usually where the rpmvip or neonhorizon links are hidden
        const sourceResp = await fetch(`${BASE}/ajax/movie/get_sources/${internalId}`, {
            method: 'POST',
            headers: {
                'User-Agent': UA,
                'Referer': movieUrl,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `id=${internalId}&type=${mediaType}`
        });

        const sources = await sourceResp.json();
        const results = [];

        // 5. Build the stream object based on what the site returned
        const rawUrl = sources.src || sources.embed_url || "";
        if (rawUrl) {
            const isNeon = rawUrl.includes('neonhorizonworkshops');
            const isRpm = rawUrl.includes('rpmvip');
            
            results.push({
                name: isNeon ? '🎬 SV-Vr (Neon)' : '🎬 SV-Emb1 (RPM)',
                title: 'Full HD • 1080p',
                url: rawUrl.replace(/\\/g, ''),
                quality: '1080p',
                headers: {
                    'User-Agent': UA,
                    'Referer': isNeon ? 'https://cloudnestra.com/' : 'https://youtube-prime.rpmvip.com/',
                    'Origin': isNeon ? 'https://cloudnestra.com' : 'https://youtube-prime.rpmvip.com',
                    'Accept': '*/*',
                    'sec-ch-ua': '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
                    'sec-ch-ua-platform': '"Android"'
                }
            });
        }

        return results;

    } catch (e) {
        console.error("[StreamM4U] Scraper Error: ", e);
        return [];
    }
}

module.exports = { getStreams };
