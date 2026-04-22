console.log('[MultiStream] Loaded');

// ================= CONFIG =================
const TMDB_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";

const VIDFAST_BASE = 'https://vidfast.pro';
const ENC_API = 'https://enc-dec.app/api/enc-vidfast';
const DEC_API = 'https://enc-dec.app/api/dec-vidfast';

const ALLOWED_SERVERS = ['Alpha', 'Bollywood', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

// ================= META =================
async function getMeta(tmdbId, mediaType) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`);
        const j = await res.json();
        return {
            title: j.name || j.title || "Unknown",
            year: (j.first_air_date || j.release_date || "").substring(0, 4)
        };
    } catch {
        return { title: "Unknown", year: "" };
    }
}

// ================= M3U8 PARSER =================
async function parseM3U8(url) {
    try {
        const res = await fetch(url);
        const text = await res.text();

        if (!text.includes('#EXT-X-STREAM-INF')) return null;

        const lines = text.split('\n');
        const variants = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('RESOLUTION')) {
                const resMatch = line.match(/RESOLUTION=\d+x(\d+)/);
                const next = lines[i + 1];

                if (next && !next.startsWith('#')) {
                    variants.push({
                        url: next.startsWith('http') ? next : url.substring(0, url.lastIndexOf('/') + 1) + next,
                        quality: resMatch ? `${resMatch[1]}p` : 'Auto'
                    });
                }
            }
        }

        return variants.length ? variants : null;
    } catch {
        return null;
    }
}

// ================= VIDFAST (FULL WORKING) =================
async function vidFast(tmdbId, mediaType, season, episode, meta) {
    const results = [];

    try {
        const pageUrl = mediaType === 'tv'
            ? `${VIDFAST_BASE}/tv/${tmdbId}/${season}/${episode}`
            : `${VIDFAST_BASE}/movie/${tmdbId}`;

        const headers = {
            'User-Agent': 'Mozilla/5.0',
            'Referer': pageUrl,
            'Origin': 'https://vidfast.pro'
        };

        const pageRes = await fetch(pageUrl, { headers });
        const pageText = await pageRes.text();

        // 🔥 FULL extraction (kept from your working script)
        let rawData = null;

        const nextDataMatch = pageText.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        if (nextDataMatch) {
            try {
                const json = JSON.parse(nextDataMatch[1]);
                const str = JSON.stringify(json);
                rawData = str.match(/"en":"([^"]+)"/)?.[1];
            } catch {}
        }

        if (!rawData) {
            const patterns = [
                /"en":"([^"]+)"/,
                /'en':'([^']+)'/,
                /\\"en\\":\\"([^"]+)\\"/,
                /data\s*=\s*"([^"]+)"/
            ];
            for (const p of patterns) {
                const m = pageText.match(p);
                if (m) {
                    rawData = m[1];
                    break;
                }
            }
        }

        if (!rawData) return [];

        const enc = await fetch(`${ENC_API}?text=${encodeURIComponent(rawData)}&version=1`).then(r => r.json());

        if (!enc?.result) return [];

        if (enc.result.token) {
            headers['X-CSRF-Token'] = enc.result.token;
        }

        const serversEnc = await fetch(enc.result.servers, {
            method: 'POST',
            headers
        }).then(r => r.text());

        const servers = await fetch(DEC_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: serversEnc, version: '1' })
        }).then(r => r.json());

        let list = servers.result || [];
        list = list.filter(s => ALLOWED_SERVERS.includes(s.name));

        for (const s of list) {
            try {
                const stEnc = await fetch(`${enc.result.stream}/${s.data}`, {
                    method: 'POST',
                    headers
                }).then(r => r.text());

                const st = await fetch(DEC_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: stEnc, version: '1' })
                }).then(r => r.json());

                if (!st?.result?.url) continue;

                const base = {
                    name: `VidFast ${s.name}`,
                    title: `${meta.title} (${meta.year})`,
                    url: st.result.url,
                    quality: st.result.quality || 'Auto',
                    provider: 'vidfast'
                };

                // expand m3u8
                if (base.url.includes('.m3u8')) {
                    const variants = await parseM3U8(base.url);
                    if (variants) {
                        variants.forEach(v => {
                            results.push({ ...base, url: v.url, quality: v.quality });
                        });
                        continue;
                    }
                }

                results.push(base);

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

// ================= SIMPLE FALLBACKS =================
function vidSrc(tmdbId, mediaType, season, episode, meta) {
    return [{
        name: 'VidSrc',
        title: `${meta.title} (${meta.year})`,
        url: mediaType === 'tv'
            ? `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`
            : `https://vidsrc.to/embed/movie/${tmdbId}`,
        quality: 'Auto',
        provider: 'vidsrc'
    }];
}

function videasy(tmdbId, mediaType, season, episode, meta) {
    return [{
        name: 'Videasy',
        title: `${meta.title} (${meta.year})`,
        url: mediaType === 'tv'
            ? `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`
            : `https://player.videasy.net/movie/${tmdbId}`,
        quality: 'Auto',
        provider: 'videasy'
    }];
}

// ================= MAIN =================
async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {

    const meta = await getMeta(tmdbId, mediaType);

    const [vf, vl] = await Promise.all([
        vidFast(tmdbId, mediaType, season, episode, meta),
        vidLink(tmdbId, mediaType, season, episode, meta)
    ]);

    const all = [
        ...vf,
        ...vl,
        ...vidSrc(tmdbId, mediaType, season, episode, meta),
        ...videasy(tmdbId, mediaType, season, episode, meta)
    ];

    const seen = new Set();
    return all.filter(s => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

// ================= EXPORT =================
if (typeof module !== 'undefined') {
    module.exports = { getStreams };
}
