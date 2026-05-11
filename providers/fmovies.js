'use strict';

const TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
const MOVIEBOX_API = "https://h5-api.aoneroom.com";
// This proxy allows us to hit the API without a VPN/DNS
const PROXY = "https://api.allorigins.win/raw?url=";

const HEADERS = {
    "Accept": "application/json",
    "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

async function getStreams(tmdbId, type, season, episode) {
    const mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
    const se = season ? parseInt(season) : 1;
    const ep = episode ? parseInt(episode) : 1;

    try {
        // 1. Get TMDB Title
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const tmdbData = await tmdbRes.json();
        const title = tmdbData.title || tmdbData.name;
        if (!title) return [];

        // 2. Search for ALL versions via Proxy (Bypasses VPN)
        const searchUrl = `${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`;
        const searchResp = await fetch(PROXY + encodeURIComponent(searchUrl), {
            method: "POST",
            headers: { ...HEADERS, "Content-Type": "application/json" },
            body: JSON.stringify({
                keyword: title,
                page: 1,
                perPage: 20,
                subjectType: mediaType === "tv" ? 2 : 1
            })
        });

        const searchJson = await searchResp.json();
        const items = searchJson.data?.items || searchJson.data?.list || [];

        // 3. Match items (Filtering for all languages)
        const cleanTarget = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matches = items.filter(i => {
            const cleanItem = (i.title || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem);
        });

        if (matches.length === 0) return [];

        let results = [];

        // 4. Extract links for each match (English, Hindi, etc.)
        for (const item of matches) {
            let downloadUrl = `${MOVIEBOX_API}/wefeed-h5-bff/web/subject/download?subjectId=${item.subjectId}`;
            if (mediaType === 'tv') downloadUrl += `&se=${se}&ep=${ep}`;

            const res = await fetch(PROXY + encodeURIComponent(downloadUrl), { headers: HEADERS });
            const dJson = await res.json();
            const downloads = dJson.data?.downloads || dJson.data?.data?.downloads || [];

            // Identify Language
            let lang = "English/Original";
            if (item.title.includes('[') && item.title.includes(']')) {
                lang = item.title.match(/\[([^\]]+)\]/)[1];
            }

            downloads.forEach(d => {
                const q = (d.resolution || 720) + "p";
                results.push({
                    name: `📺 MovieBox | ${q} | ${lang}`,
                    title: `${item.title}\n📺 ${q}  🔊 ${lang}\n(No VPN Required)`,
                    url: d.url,
                    quality: q,
                    headers: {
                        "Referer": "https://fmoviesunblocked.net/",
                        "User-Agent": HEADERS["User-Agent"]
                    }
                });
            });
        }

        // 5. Final Sort: English first, then Quality
        return results.sort((a, b) => {
            const aIsEng = a.name.includes('English') || a.name.includes('Original');
            const bIsEng = b.name.includes('English') || b.name.includes('Original');
            if (aIsEng && !bIsEng) return -1;
            if (!aIsEng && bIsEng) return 1;
            return parseInt(b.quality) - parseInt(a.quality);
        });

    } catch (e) {
        console.error("[MovieBox Error]", e);
        return [];
    }
}

module.exports = { getStreams };
