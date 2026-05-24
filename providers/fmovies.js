console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';
const DAHMER_WORKER_API = 'https://p.111477.xyz/bulk?u=';

async function makeRequest(url) {
    try {
        return await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0',
                'Referer': DAHMER_MOVIES_API + '/'
            }
        });
    } catch (e) {
        return { ok: false };
    }
}

function parseLinks(html) {
    const links = [];
    const regex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
        const href = match[1];
        const text = match[2].replace(/<[^>]*>/g, '').trim();

        if (text && href !== '../') {
            links.push({ text, href, size: 'N/A' });
        }
    }

    return links;
}

function parseFileInfo(filename) {
    const text = (filename || '').toUpperCase();

    let source = 'Unknown';
    if (text.includes('BLURAY') || text.includes('BDREMUX')) source = 'BluRay';
    else if (text.includes('WEB-DL') || text.includes('WEB')) source = 'WEB';
    else if (text.includes('HDTV')) source = 'HDTV';

    let videoCodec = 'Unknown';
    if (text.includes('H265') || text.includes('HEVC')) videoCodec = 'H265';
    else if (text.includes('H264') || text.includes('AVC')) videoCodec = 'H264';

    let audio = 'AAC';
    if (text.includes('TRUEHD')) audio = 'TrueHD';
    else if (text.includes('EAC3') || text.includes('DDP')) audio = 'DDP';
    else if (text.includes('DTS')) audio = 'DTS';

    return {
        source,
        videoCodec,
        audioProfile: audio
    };
}

function buildTitle(meta, res, lang, format, size, filename) {
    const qIcon = /2160|4k/i.test(res) ? '🌟' : '💎';
    const parsed = parseFileInfo(filename);

    return (
        `🎬 ${meta.name} (${meta.year || ''})\n` +
        `${qIcon} ${res} | 🌍 ${lang} | 💾 ${size}\n` +
        `🎞️ ${format} | ⏱️ ${meta.duration}\n` +
        `🏷️ ${parsed.source} | 📼 ${parsed.videoCodec} | 🔊 ${parsed.audioProfile}`
    );
}

async function invokeDahmerMovies(title, year, season, episode, mediaType, tmdbData) {

    const clean = title.replace(/[:']/g, '');
    const encoded = encodeURIComponent(clean);

    let folders = [];

    if (mediaType === 'tv') {
        const padS = String(season).padStart(2, '0');

        folders = [
            `/tvs/${encoded}/Season ${padS}/`,
            `/tvs/${encoded}/Season ${season}/`,
            `/tvs/${encodeURIComponent(title)}/Season ${padS}/`
        ];
    } else {
        folders = [
            `/movies/${encoded} (${year})/`,
            `/movies/${encoded}/`
        ];
    }

    let html = '';
    let base = '';

    for (const f of folders) {
        const url = DAHMER_MOVIES_API + f;
        const res = await makeRequest(url);
        if (res.ok) {
            html = await res.text();
            base = url;
            break;
        }
    }

    if (!html) return [];

    let paths = parseLinks(html);

    // ==============================
    // EPISODE FILTER (FIXED)
    // ==============================
    let filtered = paths;

    if (mediaType === 'tv' && season != null && episode != null) {

        const s = Number(season);
        const e = Number(episode);

        filtered = paths.filter(p => {
            const file = (p.text || '').toUpperCase();

            const patterns = [
                new RegExp(`S0?${s}E0?${e}`, 'i'),
                new RegExp(`${s}X0?${e}`, 'i'),
                new RegExp(`EP\\s*0?${e}`, 'i'),
                new RegExp(`EPISODE\\s*0?${e}`, 'i'),
                new RegExp(`\\b${e}\\b`)
            ];

            return patterns.some(r => r.test(file));
        });

        // fallback if nothing matched
        if (filtered.length === 0) {
            filtered = paths;
        }
    }

    const sorted = filtered.sort((a, b) => {
        const a4k = /2160|4k/i.test(a.text);
        const b4k = /2160|4k/i.test(b.text);
        return b4k - a4k;
    });

    const results = [];

    for (const p of sorted.slice(0, 5)) {

        let direct = p.href;

        if (!direct.startsWith('http')) {
            direct = base + direct;
        }

        const stream = DAHMER_WORKER_API + encodeURIComponent(direct);

        const file = p.text;

        const resolution = file.match(/(2160p|1080p|720p|4k)/i)?.[0] || '1080p';
        const format = file.match(/\.(mkv|mp4|m3u8|avi|webm)/i)?.[1] || 'LINK';

        const meta = {
            name: mediaType === 'tv'
                ? `${title} S${season}E${episode}`
                : title,
            year,
            duration: tmdbData?.runtime || 45
        };

        results.push({
            name: "DahmerMovies",
            title: buildTitle(meta, resolution, "Auto", format.toUpperCase(), "N/A", file),
            url: stream,
            quality: resolution.toLowerCase(),
            provider: "dahmermovies",
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': DAHMER_MOVIES_API + '/'
            }
        });
    }

    return results;
}

async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';

        const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const res = await makeRequest(url);
        const data = await res.json();

        const title =
            data.name ||
            data.original_name ||
            data.title ||
            data.original_title;

        const year = (data.first_air_date || data.release_date || '').slice(0, 4);

        if (!title) return [];

        return await invokeDahmerMovies(
            title,
            year,
            season,
            episode,
            type,
            data
        );

    } catch (e) {
        return [];
    }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
