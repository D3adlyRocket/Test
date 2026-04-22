console.log('[MultiStream] Initializing scraper');

// ================= CONSTANTS =================
const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const VIDFAST_BASE = 'https://vidfast.pro';
const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';

const ALLOWED_SERVERS = ['Alpha', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

// ================= TMDB =================
function getTMDBDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    return fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`)
        .then(r => r.json())
        .then(data => ({
            title: mediaType === 'tv' ? data.name : data.title,
            year: (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4) || '',
            mediaType
        }))
        .catch(() => ({
            title: "Unknown",
            year: "",
            mediaType
        }));
}

// ================= M3U8 PARSER =================
async function parseM3U8Playlist(url) {
    try {
        const res = await fetch(url);
        const text = await res.text();

        if (!text.includes('#EXT-X-STREAM-INF')) return null;

        const lines = text.split('\n');
        const variants = [];

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('RESOLUTION')) {
                const resMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
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

// ================= VIDFAST =================
async function scrapeVidFast(tmdbId, mediaInfo, season, episode) {
    try {
        const pageUrl = mediaInfo.mediaType === 'tv'
            ? `${VIDFAST_BASE}/tv/${tmdbId}/${season}/${episode}`
            : `${VIDFAST_BASE}/movie/${tmdbId}`;

        const page = await fetch(pageUrl);
        const text = await page.text();

        let raw = text.match(/"en":"([^"]+)"/)?.[1] ||
                  text.match(/data\s*=\s*"([^"]+)"/)?.[1];

        if (!raw) return [];

        const enc = await fetch(`${ENCRYPT_API}?text=${encodeURIComponent(raw)}&version=1`).then(r => r.json());

        const headers = {
            'User-Agent': 'Mozilla/5.0',
            'Referer': pageUrl
        };

        if (enc.result.token) headers['X-CSRF-Token'] = enc.result.token;

        const serversEnc = await fetch(enc.result.servers, { method: 'POST', headers }).then(r => r.text());

        const servers = await fetch(DECRYPT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: serversEnc, version: '1' })
        }).then(r => r.json());

        let list = servers.result || [];
        list = list.filter(s => ALLOWED_SERVERS.includes(s.name));

        const streams = [];

        for (const s of list) {
            try {
                const stEnc = await fetch(`${enc.result.stream}/${s.data}`, {
                    method: 'POST',
                    headers
                }).then(r => r.text());

                const st = await fetch(DECRYPT_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: stEnc, version: '1' })
                }).then(r => r.json());

                if (!st?.result?.url) continue;

                let baseStream = {
                    name: `VidFast ${s.name}`,
                    title: `${mediaInfo.title} (${mediaInfo.year})`,
                    url: st.result.url,
                    quality: st.result.quality || 'Auto',
                    provider: 'vidfast'
                };

                // expand m3u8
                if (baseStream.url.includes('.m3u8')) {
                    const variants = await parseM3U8Playlist(baseStream.url);
                    if (variants) {
                        variants.forEach(v => {
                            streams.push({
                                ...baseStream,
                                url: v.url,
                                quality: v.quality
                            });
                        });
                        continue;
                    }
                }

                streams.push(baseStream);

            } catch {}
        }

        return streams;
    } catch {
        return [];
    }
}

// ================= VIDLINK =================
async function scrapeVidLink(tmdbId, mediaInfo, season, episode) {
    try {
        const enc = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`)
            .then(r => r.json());

        const url = mediaInfo.mediaType === 'tv'
            ? `https://vidlink.pro/api/b/tv/${enc.result}/${season}/${episode}`
            : `https://vidlink.pro/api/b/movie/${enc.result}`;

        const data = await fetch(url).then(r => r.json());

        if (!data?.stream?.playlist) return [];

        return [{
            name: 'VidLink',
            title: `${mediaInfo.title} (${mediaInfo.year})`,
            url: data.stream.playlist,
            quality: 'Auto',
            provider: 'vidlink'
        }];

    } catch {
        return [];
    }
}

// ================= MAIN =================
async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    console.log(`[MultiStream] Fetching ${tmdbId}`);

    const mediaInfo = await getTMDBDetails(tmdbId, mediaType);

    const [vidfast, vidlink] = await Promise.all([
        scrapeVidFast(tmdbId, mediaInfo, season, episode),
        scrapeVidLink(tmdbId, mediaInfo, season, episode)
    ]);

    // merge + dedupe
    const all = [...vidfast, ...vidlink];
    const seen = new Set();

    return all.filter(s => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

// export
if (typeof module !== 'undefined') {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
