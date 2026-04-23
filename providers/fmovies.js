var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE = 'https://streamm4u.com.co';
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36';

async function getStreams(tmdbId, mediaType) {
    try {
        // 1. Get Title from TMDB
        const tmdbReq = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`);
        const tmdbData = await tmdbReq.json();
        const searchTitle = (tmdbData.title || tmdbData.name).replace(/\s+/g, '+');

        // 2. Search StreamM4U
        const searchRes = await fetch(`${BASE}/search/${searchTitle}`, { headers: { 'User-Agent': UA } });
        const searchHtml = await searchRes.text();
        
        // Find the movie link
        const movieLinkMatch = searchHtml.match(/href="(https:\/\/streamm4u\.com\.co\/(?:movies|tv)\/[^"]+)"/);
        if (!movieLinkMatch) return [];

        // 3. Get Movie Page HTML
        const moviePageRes = await fetch(movieLinkMatch[1], { headers: { 'User-Agent': UA, 'Referer': BASE + '/home' } });
        const movieHtml = await moviePageRes.text();

        // 4. Extract the ID needed for the AJAX call
        const idMatch = movieHtml.match(/data-id="([^"]+)"/) || movieHtml.match(/var\s+id\s*=\s*['"]([^'"]+)['"]/);
        if (!idMatch) return [];
        const internalId = idMatch[1];

        // 5. Hit the AJAX endpoint that actually contains the links
        const ajaxRes = await fetch(`${BASE}/ajax/movie/get_sources/${internalId}`, {
            method: 'POST',
            headers: {
                'User-Agent': UA,
                'Referer': movieLinkMatch[1],
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `id=${internalId}&type=movie`
        });

        const ajaxData = await ajaxRes.json();
        const finalUrl = (ajaxData.src || ajaxData.embed_url || "").replace(/\\/g, '');

        if (!finalUrl) return [];

        // 6. Return the formatted result using your specific working headers
        return [{
            name: '🎬 StreamM4U',
            title: finalUrl.includes('neon') ? 'SV-Vr' : 'SV-Emb1',
            url: finalUrl,
            quality: '1080p',
            headers: {
                'User-Agent': UA,
                'Referer': finalUrl.includes('neon') ? 'https://cloudnestra.com/' : 'https://youtube-prime.rpmvip.com/',
                'Origin': finalUrl.includes('neon') ? 'https://cloudnestra.com' : 'https://youtube-prime.rpmvip.com',
                'Accept': '*/*',
                'sec-ch-ua': '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
                'sec-ch-ua-platform': '"Android"'
            }
        }];

    } catch (err) {
        return [];
    }
}

module.exports = { getStreams };
