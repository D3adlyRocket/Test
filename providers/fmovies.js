'use strict';

const WORKER = 'https://moviebox.s4nch1tt.workers.dev';
const API_BASE = "https://h5-api.aoneroom.com";
const TMDB_KEY = 'd131017ccc6e5462a81c9304d21476de';

async function getStreams(tmdbId, type, season, episode) {
    const isTv = (type === 'series' || type === 'tv');
    const se = season ? parseInt(season) : 1;
    const ep = episode ? parseInt(episode) : 1;

    try {
        // 1. Get Title from TMDB (VPN-Safe)
        const tRes = await fetch(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`);
        const tData = await tRes.json();
        const title = tData.title || tData.name;
        if (!title) return [];

        // 2. SEARCH via Worker Tunnel (Bypasses ISP Block & finds English/Hindi/etc)
        // We use the worker's fetch to hit the API so it looks like it's coming from Cloudflare
        const searchUrl = `${API_BASE}/wefeed-h5-bff/web/subject/search`;
        const sRes = await fetch(`${WORKER}/proxy?url=${encodeURIComponent(searchUrl)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyword: title,
                page: 1,
                perPage: 20,
                subjectType: isTv ? 2 : 1
            })
        });

        const sJson = await sRes.json();
        const items = sJson.data?.items || sJson.data?.list || [];

        // 3. Match and Extract Streams
        const target = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const results = [];

        for (const item of items) {
            const itemTitle = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!itemTitle.includes(target)) continue;

            // 4. Get Download Links via Worker Tunnel
            let dUrl = `${API_BASE}/wefeed-h5-bff/web/subject/download?subjectId=${item.subjectId}`;
            if (isTv) dUrl += `&se=${se}&ep=${ep}`;

            const dRes = await fetch(`${WORKER}/proxy?url=${encodeURIComponent(dUrl)}`);
            const dJson = await dRes.json();
            const downloads = dJson.data?.downloads || dJson.data?.data?.downloads || [];

            // Detect Language (Original, Hindi, etc.)
            let lang = "English/Original";
            if (item.title.includes('[') && item.title.includes(']')) {
                lang = item.title.match(/\[([^\]]+)\]/)[1];
            }

            downloads.forEach(d => {
                const q = (d.resolution || 720) + "p";
                results.push({
                    name: `📺 MovieBox | ${q} | ${lang}`,
                    title: `${item.title}\n📺 ${q}  🔊 ${lang}\n(No VPN Required)`,
                    // Route the video through the worker to ensure it plays without VPN
                    url: `${WORKER}/proxy?url=${encodeURIComponent(d.url)}`,
                    quality: q,
                    behaviorHints: { bingeGroup: 'moviebox' }
                });
            });
        }

        // Sort: English/Original first, then by resolution
        return results.sort((a, b) => {
            const aE = a.name.includes('Original') || a.name.includes('English');
            const bE = b.name.includes('Original') || b.name.includes('English');
            if (aE !== bE) return aE ? -1 : 1;
            return parseInt(b.quality) - parseInt(a.quality);
        });

    } catch (e) {
        console.error("[MB Error]", e);
        return [];
    }
}

module.exports = { getStreams };
