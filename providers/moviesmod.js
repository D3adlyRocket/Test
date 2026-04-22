const TMDB_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";

// ================= TMDB =================
async function getMeta(tmdbId, mediaType) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`);
        const json = await res.json();
        return {
            title: json.name || json.title || "Unknown",
            year: (json.first_air_date || json.release_date || "").substring(0, 4)
        };
    } catch {
        return { title: "Unknown", year: "" };
    }
}

// ================= VIDFAST (UNCHANGED CORE) =================
async function vidFast(tmdbId, mediaType, season, episode, meta) {
    const results = [];

    try {
        const vfBase = 'https://vidfast.pro';
        const pageUrl = mediaType === 'tv'
            ? `${vfBase}/tv/${tmdbId}/${season}/${episode}`
            : `${vfBase}/movie/${tmdbId}`;

        const pageRes = await fetch(pageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': pageUrl }
        });

        const pageText = await pageRes.text();

        const rawData =
            pageText.match(/"en":"([^"]+)"/)?.[1] ||
            pageText.match(/data\s*=\s*"([^"]+)"/)?.[1];

        if (!rawData) return [];

        const encRes = await fetch(`https://enc-dec.app/api/enc-vidfast?text=${encodeURIComponent(rawData)}&version=1`);
        const encData = await encRes.json();

        const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': pageUrl };
        if (encData?.result?.token) headers['X-CSRF-Token'] = encData.result.token;

        const sRes = await fetch(encData.result.servers, {
            method: 'POST',
            headers
        });

        const sEnc = await sRes.text();

        const sDec = await fetch('https://enc-dec.app/api/dec-vidfast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sEnc, version: '1' })
        }).then(r => r.json());

        const allowed = ['Alpha', 'Bollywood', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

        for (const s of (sDec.result || []).filter(x => allowed.includes(x.name))) {
            try {
                const stRes = await fetch(`${encData.result.stream}/${s.data}`, {
                    method: 'POST',
                    headers
                });

                const stEnc = await stRes.text();

                const stDec = await fetch('https://enc-dec.app/api/dec-vidfast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: stEnc, version: '1' })
                }).then(r => r.json());

                if (stDec?.result?.url) {
                    results.push({
                        name: `VidFast ${s.name}`,
                        title: `${meta.title} (${meta.year})`,
                        url: stDec.result.url,
                        quality: stDec.result.quality || 'Auto',
                        provider: 'vidfast'
                    });
                }

            } catch {}
        }

    } catch {}

    return results;
}

// ================= VIDLINK =================
async function vidLink(tmdbId, mediaType, season, episode, meta) {
    try {
        const enc = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`).then(r => r.json());

        const url = mediaType === 'tv'
            ? `https://vidlink.pro/api/b/tv/${enc.result}/${season}/${episode}`
            : `https://vidlink.pro/api/b/movie/${enc.result}`;

        const data = await fetch(url).then(r => r.json());

        if (!data?.stream?.playlist) return [];

        return [{
            name: 'VidLink',
            title: `${meta.title} (${meta.year})`,
            url: data.stream.playlist,
            quality: 'Auto',
            provider: 'vidlink'
        }];
    } catch {
        return [];
    }
}

// ================= VIDSRC =================
async function vidSrc(tmdbId, mediaType, season, episode, meta) {
    try {
        const url = mediaType === 'tv'
            ? `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`
            : `https://vidsrc.to/embed/movie/${tmdbId}`;

        return [{
            name: 'VidSrc',
            title: `${meta.title} (${meta.year})`,
            url,
            quality: 'Auto',
            provider: 'vidsrc'
        }];
    } catch {
        return [];
    }
}

// ================= VIDEASY =================
async function videasy(tmdbId, mediaType, season, episode, meta) {
    try {
        const url = mediaType === 'tv'
            ? `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`
            : `https://player.videasy.net/movie/${tmdbId}`;

        return [{
            name: 'Videasy',
            title: `${meta.title} (${meta.year})`,
            url,
            quality: 'Auto',
            provider: 'videasy'
        }];
    } catch {
        return [];
    }
}

// ================= MAIN =================
async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {

    const meta = await getMeta(tmdbId, mediaType);

    const results = await Promise.all([
        vidFast(tmdbId, mediaType, season, episode, meta),
        vidLink(tmdbId, mediaType, season, episode, meta),
        vidSrc(tmdbId, mediaType, season, episode, meta),
        videasy(tmdbId, mediaType, season, episode, meta)
    ]);

    const all = results.flat();

    const seen = new Set();
    return all.filter(s => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

if (typeof module !== 'undefined') module.exports = { getStreams };
