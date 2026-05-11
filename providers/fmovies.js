'use strict';

const TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
const MOVIEBOX_API = "https://h5-api.aoneroom.com";
const TAG = '[MovieBox All-Lang]';

// Headers required for the H5 API
const HEADERS = {
    "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// ─────────────────────────────────────────────────────────────────────────────
// Logic
// ─────────────────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, type, season, episode) {
    const mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
    const se = mediaType === 'tv' ? (season ? parseInt(season) : 1) : null;
    const ep = mediaType === 'tv' ? (episode ? parseInt(episode) : 1) : null;

    try {
        // 1. Get TMDB Title
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const tmdbData = await tmdbRes.json();
        const queryTitle = tmdbData.title || tmdbData.name;
        if (!queryTitle) return [];

        // 2. Initialize Session (Handshake)
        await fetch(`${MOVIEBOX_API}/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`, { headers: HEADERS }).catch(() => {});

        // 3. Search for ALL versions (Multi-Language)
        // We use the H5 search which returns all available language dubs
        const searchResp = await fetch(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`, {
            method: "POST",
            headers: { ...HEADERS, "Content-Type": "application/json", "Referer": MOVIEBOX_API + "/" },
            body: JSON.stringify({
                keyword: queryTitle,
                page: 1,
                perPage: 20,
                subjectType: mediaType === "tv" ? 2 : 1
            })
        });

        const searchJson = await searchResp.json();
        const items = (searchJson.data && (searchJson.data.items || searchJson.data.list)) || [];

        // 4. Match and extract from EVERY result (English, Hindi, etc.)
        const cleanTarget = queryTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedItems = items.filter(item => {
            const cleanItem = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem);
        });

        if (matchedItems.length === 0) return [];

        let allStreams = [];

        // 5. Fetch Download Links for all matches
        for (const item of matchedItems) {
            let params = `subjectId=${item.subjectId}`;
            if (mediaType === 'tv') params += `&se=${se}&ep=${ep}`;

            try {
                const sourceResp = await fetch(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/download?${params}`, {
                    headers: {
                        ...HEADERS,
                        "Referer": "https://fmoviesunblocked.net/",
                        "Origin": "https://fmoviesunblocked.net"
                    }
                });

                const sourceJson = await sourceResp.json();
                const sourceData = (sourceJson.data && sourceJson.data.data) || sourceJson.data || {};
                const downloads = sourceData.downloads || [];

                // Detect Language from Title
                let lang = "English/Original";
                if (item.title.includes('[') && item.title.includes(']')) {
                    lang = item.title.match(/\[([^\]]+)\]/)[1];
                }

                downloads.forEach(d => {
                    const quality = (d.resolution || 720) + "p";
                    allStreams.push({
                        name: `📺 MovieBox | ${quality} | ${lang}`,
                        title: `${item.title}\n📺 ${quality}  🔊 ${lang}\nSource: H5 Direct`,
                        url: d.url,
                        quality: quality,
                        headers: {
                            "Referer": "https://fmoviesunblocked.net/",
                            "User-Agent": HEADERS["User-Agent"]
                        }
                    });
                });
            } catch (e) { continue; }
        }

        // Sort by quality and put English/Original at the top
        return allStreams.sort((a, b) => {
            const aIsEng = a.name.includes('English') || a.name.includes('Original');
            const bIsEng = b.name.includes('English') || b.name.includes('Original');
            if (aIsEng && !bIsEng) return -1;
            if (!aIsEng && bIsEng) return 1;
            return parseInt(b.quality) - parseInt(a.quality);
        });

    } catch (e) {
        console.error(TAG, e);
        return [];
    }
}

module.exports = { getStreams };
