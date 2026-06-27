"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

// Helper to determine resolution category
function getResCategory(title) {
    if (/2160|4k/i.test(title)) return "2160p";
    if (/1080/i.test(title)) return "1080p";
    if (/720/i.test(title)) return "720p";
    if (/480/i.test(title)) return "480p";
    return "360p";
}

async function getStreams(tmdbId, mediaType, season, episode) {
    // ... (fetch meta logic remains same)
    
    // Fetch all streams
    const url = `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/${isSeries ? 'series' : 'movie'}/${imdbId}${isSeries ? ':' + season + ':' + episode : ''}.json`;
    const data = await fetch(url).then(r => r.json());
    
    if (!data?.streams) return [];

    // 1. Group streams by resolution
    const groups = { "2160p": [], "1080p": [], "720p": [], "480p": [], "360p": [] };
    data.streams.forEach(s => {
        const res = getResCategory(s.title);
        groups[res].push(s);
    });

    // 2. Interleave within each group
    const orderedStreams = [];
    Object.keys(groups).forEach(res => {
        const list = groups[res];
        // We assume 1st is English, 2nd is Hindi based on your requirement
        list.forEach((item, index) => {
            const lang = (index % 2 === 0) ? "English" : "Hindi";
            
            const fullLayout = `🎦 ${meta.title || meta.name}\n💎 ${res} | 🗣️ ${lang === "Hindi" ? "Hindi 🇮🇳 • English 🇺🇸" : "English 🇺🇸"}\n🎞️ MKV | 🔗 ${PROVIDER_NAME}`;
            
            orderedStreams.push({
                name: `${PROVIDER_NAME} | ${res} | ${lang}`,
                title: fullLayout,
                size: fullLayout,
                description: fullLayout,
                url: item.url,
                behaviorHints: { proxyHeaders: { request: { "Referer": MOVIEBOX_BASE + "/" } } }
            });
        });
    });

    return orderedStreams;
}
