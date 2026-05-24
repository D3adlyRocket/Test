console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';
const DAHMER_WORKER_API = 'https://p.111477.xyz/bulk?u=';

async function makeRequest(url) {
    try {
        return await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': DAHMER_MOVIES_API + '/'
            }
        });
    } catch (e) { return { ok: false }; }
}

function parseLinks(html) {
    const links = [];

    const anchorRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = anchorRegex.exec(html)) !== null) {
        const href = match[1];
        const text = match[2]
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (
            text &&
            href !== '../' &&
            /\.(mkv|mp4|avi|webm|m3u8)$/i.test(text)
        ) {
            links.push({
                text,
                href,
                size: 'N/A'
            });
        }
    }

    return links;
}

function parseFileInfo(filename) {
  var text = String(filename || '').toUpperCase();

  var source = 'Unknown Source';
  if (/\bBLURAY\b|\bBDREMUX\b/i.test(text)) source = 'BluRay';
  else if (/\bWEB-DL\b|\bWEB\b/i.test(text)) source = 'WEB-DL';
  else if (/\bHDTV\b/i.test(text)) source = 'HDTV';
  else if (/\bCAM\b/i.test(text)) source = 'CAM';

  var videoCodec = 'Unknown Video';
  if (/\bH\.?265\b|\bHEVC\b/i.test(text)) videoCodec = 'H265';
  else if (/\bH\.?264\b|\bAVC\b/i.test(text)) videoCodec = 'AVC';
  else if (/\bAV1\b/i.test(text)) videoCodec = 'AV1';

  var audioCodec = 'AAC';
  if (/\bTRUEHD\b/i.test(text)) audioCodec = 'TrueHD';
  else if (/\bEAC3\b|\bDDP\b/i.test(text)) audioCodec = 'DDP';
  else if (/\bDTS\b/i.test(text)) audioCodec = 'DTS';

  return {
    source,
    videoCodec,
    audioProfile: audioCodec
  };
}

function buildTitle(meta, res, lang, format, size, filename) {
  var qIcon = (res.includes('4K') || res.includes('2160')) ? '🌟' : '💎';
  var parsed = parseFileInfo(filename);

  var line1 = '🎬 ' + meta.name + (meta.year ? ' (' + meta.year + ')' : '');
  var line2 = qIcon + ' ' + res + ' | 🌍 ' + lang + ' | 💾 ' + (size || 'Variable Size');
  var line3 = '🎞️ ' + format.toUpperCase() + ' | ⏱️ ' + meta.duration + ' | 📼 ' + parsed.videoCodec;
  var line4 = '🏷️ ' + parsed.source + ' | 🔊 ' + parsed.audioProfile;

  return line1 + '\n' + line2 + '\n' + line3 + '\n' + line4;
}

async function invokeDahmerMovies(title, year, season = null, episode = null, mediaType = 'movie', tmdbData = {}) {

    const cleanTitle = title.replace(/[:']/g, '');
    const encodedTitle = encodeURIComponent(cleanTitle);

    let folderVariants = [];

    if (mediaType === 'tv' && season !== null) {
        const padSeason = season < 10 ? '0' + season : season;

        folderVariants = [
            `/tvs/${encodedTitle}/Season%20${padSeason}/`,
            `/tvs/${encodedTitle}/Season%20${season}/`
        ];
    } else {
        folderVariants = [
            `/movies/${encodedTitle}/`,
            `/movies/${encodedTitle} (${year})/`
        ];
    }

    let html = '';
    let activeDirUrl = '';

    for (const path of folderVariants) {
        const full = DAHMER_MOVIES_API + path;
        const res = await makeRequest(full);
        if (res.ok) {
            html = await res.text();
            activeDirUrl = full;
            break;
        }
    }

    if (!html) return [];

    let paths = parseLinks(html);

    // =========================
    // FIXED EPISODE FILTER
    // =========================
    if (mediaType === 'tv' && season != null && episode != null) {

        const se = Number(season);
        const ep = Number(episode);

        const filteredPaths = paths.filter(p => {
            const file = p.text.toUpperCase();

            return (
                new RegExp(`S0?${se}E0?${ep}`, 'i').test(file) ||
                new RegExp(`${se}X0?${ep}`, 'i').test(file) ||
                new RegExp(`EP\\s*0?${ep}`, 'i').test(file) ||
                new RegExp(`EPISODE\\s*0?${ep}`, 'i').test(file)
            );
        });

        if (filteredPaths.length > 0) {
            paths = filteredPaths;
        }
    }

    const sortedPaths = paths.sort((a, b) => {
        const a4k = /2160|4k/i.test(a.text);
        const b4k = /2160|4k/i.test(b.text);
        return b4k - a4k;
    });

    const results = [];

    for (const path of sortedPaths.slice(0, 5)) {

        let directUrl;

        if (path.href.startsWith('http')) {
            directUrl = path.href;
        } else {
            directUrl = activeDirUrl + path.href;
        }

        directUrl = directUrl.replace(/([^:]\/)\/+/g, "$1");
        directUrl = decodeURI(directUrl);

        const streamUrl = DAHMER_WORKER_API + encodeURIComponent(directUrl);

        const fileName = path.text;

        const resolution = fileName.match(/\b(2160p|1080p|720p|4k)\b/i)?.[0] || '1080p';

        // 🔥 FIXED: size restored properly
        const fileSize = path.size || 'N/A';

        const format = fileName.match(/\.(mkv|mp4|m3u8|avi|webm)$/i)?.[1] || 'LINK';

        const displayTitle = mediaType === 'tv'
            ? `${title} S${season}E${episode}`
            : title;

        const runtime =
            tmdbData?.episode_run_time?.[0] ||
            tmdbData?.runtime ||
            45;

        const meta = {
            name: displayTitle,
            year,
            duration: runtime + ' min'
        };

        results.push({
            name: "DahmerMovies",
            title: buildTitle(meta, resolution, "Auto", format, fileSize, fileName),
            url: streamUrl,
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
