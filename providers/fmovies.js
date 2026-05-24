// Dahmer Movies Scraper - Format Column Added (MKV/MP4/M3U8)
console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';
const DAHMER_WORKER_API = 'https://p.111477.xyz/bulk?u=';

async function makeRequest(url) {
    try {
        return await fetch(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': DAHMER_MOVIES_API + '/'
            }
        });
    } catch (e) { return { ok: false }; }
}

function parseLinks(html) {
    const links = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
        const rowContent = match[1];
        const linkMatch = rowContent.match(/<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/i);
        const sizeMatch = rowContent.match(/<td[^>]*>(\d+(?:\.\d+)?\s?[KMGT]B)<\/td>/i);

        if (linkMatch) {
            const href = linkMatch[1];
            const text = linkMatch[2].trim();
            const size = sizeMatch ? sizeMatch[1].trim() : 'N/A';

            if (text && href !== '../' && /\.(mkv|mp4|avi|webm|m3u8)$/i.test(text)) {
                links.push({ text, href, size });
            }
        }
    }
    return links;
}

// Advanced properties analyzer parser parsing from raw filename context
function parseFileInfo(filename) {
  var text = String(filename || '').toUpperCase();
  
  // 1. Source type identification
  var source = 'Unknown Source';
  if (/\bBLURAY\b|\bBLU-RAY\b|\bBDREMUX\b/i.test(text)) source = 'BluRay';
  else if (/\bWEB-DL\b|\bWEBDL\b|\bWEB\b/i.test(text)) source = 'WEB-DL';
  else if (/\bHDTV\b/i.test(text)) source = 'HDTV';
  else if (/\bCAM\b|\bCAMRIP\b/i.test(text)) source = 'CAM';

  // 2. Video Encoding parameters
  var videoCodec = 'Unknown Video';
  if (/\bH\.?265\b|\bX265\b|\bHEVC\b/i.test(text)) {
    videoCodec = 'H265';
    if (/\bDV\b|\bDOLBY\s*VISION\b/i.test(text)) videoCodec += ' DV';
    if (/\bHDR10P\b|\bHDR10\+\b/i.test(text)) videoCodec += ' HDR10+';
    else if (/\bHDR\b|\bHDR10\b/i.test(text)) videoCodec += ' HDR10';
  } else if (/\bH\.?264\b|\bX264\b|\bAVC\b/i.test(text)) {
    videoCodec = 'AVC';
  } else if (/\bAV1\b/i.test(text)) {
    videoCodec = 'AV1';
  }

  // 3. Audio format profile attributes
  var audioCodec = 'AAC'; 
  if (/\bTRUEHD\b/i.test(text)) audioCodec = 'TrueHD';
  else if (/\bATMOS\b/i.test(text)) audioCodec = 'Atmos';
  else if (/\bDDP\b|\bEAC3\b/i.test(text)) audioCodec = 'DDP';
  else if (/\bDD\b|\bAC3\b/i.test(text)) audioCodec = 'DD';
  else if (/\bDTS\b/i.test(text)) audioCodec = 'DTS';

  // 4. Surround audio layout configurations
  var audioChannels = '';
  if (/\b7\.1\b/.test(text)) audioChannels = '7.1';
  else if (/\b5\.1\b/.test(text)) audioChannels = '5.1';
  else if (/\b2\.0\b|\bSTEREO\b/.test(text)) audioChannels = '2.0';

  return {
    source: source,
    videoCodec: videoCodec,
    audioProfile: audioCodec + (audioChannels ? ' ' + audioChannels : '')
  };
}

// Fixed multi-line UI compositor running up to 4 sequential rows
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
    
    // Generates a clean baseline text without punctuation blockers like colons or apostrophes
    const cleanTitle = title.replace(/[:']/g, ''); 
    const encodedTitle = encodeURIComponent(cleanTitle);
    const encodedRawTitle = encodeURIComponent(title);

    let folderVariants = [];

    if (mediaType === 'tv' && season !== null) {
        const padSeason = season < 10 ? '0' + season : season;
        folderVariants = [
            // Matches titles with or without apostrophes (e.g., Marvels Daredevil vs Marvel's Daredevil)
            `/tvs/${encodedTitle}/Season%20${padSeason}/`,
            `/tvs/${encodedTitle}/Season%20${season}/`,
            `/tvs/${encodedRawTitle}/Season%20${padSeason}/`,
            `/tvs/${encodedRawTitle}/Season%20${season}/`
        ];
    } else {
        // Fallbacks for movies that omit or include years in the directory name
        folderVariants = [
            `/movies/${encodeURIComponent(cleanTitle + ' (' + year + ')')}/`,
            `/movies/${encodeURIComponent(title + ' (' + year + ')')}/`,
            `/movies/${encodedTitle}/`,
            `/movies/${encodedRawTitle}/`
        ];
    }

    let html = '';
    let activeDirUrl = '';

    for (const path of folderVariants) {
        const fullDirUrl = DAHMER_MOVIES_API + path;
        const response = await makeRequest(fullDirUrl);
        if (response.ok) {
            html = await response.text();
            activeDirUrl = fullDirUrl;
            break; 
        }
    }

    if (!html) return [];
    let paths = parseLinks(html);

// Filter exact episode for TV shows
if (mediaType === 'tv' && season !== null && episode !== null) {
    const seasonNum = Number(season);
    const episodeNum = Number(episode);

    paths = paths.filter(path => {
        const file = path.text.toUpperCase();

        return (
            // S01E01
            new RegExp(`S0?${seasonNum}E0?${episodeNum}`, 'i').test(file) ||

            // 1x01
            new RegExp(`${seasonNum}X0?${episodeNum}`, 'i').test(file) ||

            // Episode 01
            new RegExp(`EP(?:ISODE)?\\s*0?${episodeNum}`, 'i').test(file)
        );
    });
}
    const sortedPaths = paths.sort((a, b) => {
        const a4k = /2160p|4k/i.test(a.text);
        const b4k = /2160p|4k/i.test(b.text);
        return b4k - a4k;
    });

    const results = [];
    for (const path of sortedPaths.slice(0, 5)) {
        let directUrl;
        if (path.href.startsWith('http')) {
            directUrl = path.href;
        } else if (path.href.includes('/movies/') || path.href.includes('/tvs/')) {
            directUrl = DAHMER_MOVIES_API + (path.href.startsWith('/') ? '' : '/') + path.href;
        } else {
            directUrl = activeDirUrl + path.href;
        }

        directUrl = directUrl.replace(/([^:]\/)\/+/g, "$1");
        directUrl = decodeURI(directUrl);
        let streamUrl = DAHMER_WORKER_API + encodeURI(directUrl);

        const fileName = path.text;
        
        // 1. Language Logic
        let language = "Original"; 
        const isMulti = /\b(HIN|TAM|TEL|Multi|Dual|DUB|Multi-Audio|MULTI)\b/i.test(fileName);
        const hasEngTag = /\b(Eng|English)\b/i.test(fileName);
        const isEnglishTitle = /^[a-zA-Z0-9\s?!\-:]+$/.test(title);

        if (isMulti) language = "Multi Audio";
        else if (isEnglishTitle && hasEngTag) language = "English";

        // 2. Format Logic (New Column)
        const formatMatch = fileName.match(/\.(mkv|mp4|m3u8|avi|webm)$/i);
        const fileFormat = formatMatch ? formatMatch[1].toUpperCase() : 'LINK';

        // 3. Technical Info
        const resolution = fileName.match(/\b(2160p|1080p|720p|4k)\b/i)?.[0] || '1080p';
        const fileSize = path.size !== 'N/A' ? path.size : 'N/A';
        
        let info = fileName
            .replace(/\.(mkv|mp4|avi|webm|m3u8)$/i, '')
            .replace(/[\[\]()._-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Creates the layout metadata details
const displayTitle = mediaType === 'tv'
    ? title + ` S${season < 10 ? '0' + season : season}E${episode < 10 ? '0' + episode : episode}`
    : title;

const runtime = mediaType === 'tv'
    ? (
        tmdbData?.episode_run_time?.find(v => v > 0) || 
        tmdbData?.runtime || 
        tmdbData?.last_episode_to_air?.runtime ||
        tmdbData?.next_episode_to_air?.runtime ||
        45
    )
    : (tmdbData?.runtime || 90);

const metaPayload = {
    name: displayTitle,
    year: year,
    duration: runtime + ' min'
};

        const generatedTitle = buildTitle(
            metaPayload,
            resolution,
            language,
            fileFormat,
            fileSize,
            fileName
        );

        results.push({
            name: "DahmerMovies",
            title: generatedTitle,
            url: streamUrl,
            quality: resolution.toLowerCase(),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': DAHMER_MOVIES_API + '/',
                'Connection': 'keep-alive',
                'Accept': '*/*',
                'Range': 'bytes=0-'
            },
            provider: "dahmermovies"
        });
    }
    return results;
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const res = await makeRequest(tmdbUrl);
        const data = await res.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        if (!title) return [];
        return await invokeDahmerMovies(
    title,
    year,
    seasonNum,
    episodeNum,
    type,
    data
);
    } catch (e) { return []; }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
