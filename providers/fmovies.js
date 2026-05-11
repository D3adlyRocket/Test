'use strict';

// 1. We use a "Secret" public proxy that ISPs rarely block to bypass your VPN need
const P = "https://api.allorigins.win/raw?url=";
const MB = "https://h5-api.aoneroom.com";
const TMDB_KEY = 'd131017ccc6e5462a81c9304d21476de';

async function getStreams(tmdbId, type, season, episode) {
    const isTv = (type === 'series' || type === 'tv');
    const se = season ? parseInt(season) : 1;
    const ep = episode ? parseInt(episode) : 1;

    try {
        // Step 1: Get Title via Proxy
        const tRes = await fetch(P + encodeURIComponent(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`));
        const tData = await tRes.json();
        const title = tData.title || tData.name;
        if (!title) return [];

        // Step 2: Search via Proxy (This finds English, Hindi, everything)
        const sUrl = `${MB}/wefeed-h5-bff/web/subject/search`;
        const sRes = await fetch(P + encodeURIComponent(sUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: title, page: 1, perPage: 15, subjectType: isTv ? 2 : 1 })
        });
        const sData = await sRes.json();
        const items = sData.data?.items || sData.data?.list || [];

        // Step 3: Match results
        const target = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matches = items.filter(i => (i.title || "").toLowerCase().replace(/[^a-z0-9]/g, '').includes(target));

        const results = [];
        for (const item of matches) {
            // Step 4: Get Links via Proxy (Bypasses VPN/DNS block)
            let dUrl = `${MB}/wefeed-h5-bff/web/subject/download?subjectId=${item.subjectId}`;
            if (isTv) dUrl += `&se=${se}&ep=${ep}`;

            const dRes = await fetch(P + encodeURIComponent(dUrl));
            const dJson = await dRes.json();
            const downloads = dJson.data?.downloads || dJson.data?.data?.downloads || [];

            let lang = item.title.includes('[') ? item.title.match(/\[(.*?)\]/)[1] : "Original/English";

            downloads.forEach(d => {
                results.push({
                    name: `📺 MovieBox | ${d.resolution}p | ${lang}`,
                    title: `${item.title}\nQuality: ${d.resolution}p\nLanguage: ${lang}\n(No VPN Required)`,
                    url: d.url, // The video file itself usually isn't blocked, just the API
                    quality: `${d.resolution}p`,
                    headers: { "Referer": "https://fmoviesunblocked.net/" }
                });
            });
        }

        // Sort: English first
        return results.sort((a, b) => {
            const aE = a.name.includes('Original') || a.name.includes('English');
            const bE = b.name.includes('Original') || b.name.includes('English');
            return aE === bE ? parseInt(b.quality) - parseInt(a.quality) : aE ? -1 : 1;
        });

    } catch (e) { return []; }
}

module.exports = { getStreams };
