// CTGMovies - Nuvio Scraper
// Converted from Wizdier's CloudStream CTGMoviesProvider
// Source: https://ctgmovies.com with API at https://cockpit.103.109.92.178.nip.io/api/v1
// Provides movies, TV shows, and anime. Some content requires auth (not supported here).

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const MAIN_URL = 'https://ctgmovies.com';
const DEFAULT_API_BASE = 'https://cockpit.103.109.92.178.nip.io/api/v1';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const AUTH_CONFIG = {
    token: '',
    cookie: '',
};

const WEB_HEADERS = {
    'User-Agent': UA,
    'Accept': 'application/json',
    'Accept-Language': 'en',
    'Referer': MAIN_URL + '/',
    'Origin': MAIN_URL,
};

const STREAM_HEADERS = {
    'User-Agent': UA,
    'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity',
    'Referer': MAIN_URL + '/',
    'Sec-Fetch-Dest': 'video',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
    'DNT': '1',
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────────────

function encodeUrl(s) {
    return encodeURIComponent(s || '');
}

function yearFromDate(date) {
    if (!date) return null;
    const m = date.match(/\d{4}/);
    return m ? parseInt(m[0], 10) : null;
}

function cleanDisplayTitle(title) {
    if (!title) return '';
    return title
        .replace(/\b(1080p|720p|480p|2160p|4k|web[- ]?dl|webrip|bluray|hdrip|x264|x265|hevc|10bit|dual[- ]?audio|hindi[- ]?dubbed|dubbed|esub)\b/gi, ' ')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizedTitle(title) {
    return cleanDisplayTitle(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function optString(obj, key) {
    if (!obj || obj[key] == null) return null;
    let v = obj[key];
    if (typeof v !== 'string') v = String(v);
    v = v.trim();
    if (!v || v === 'null') return null;
    return v;
}

function optInt(obj, key) {
    if (!obj || obj[key] == null) return null;
    const v = obj[key];
    if (typeof v === 'number') return v;
    const parsed = parseInt(String(v), 10);
    return isNaN(parsed) ? null : parsed;
}

function resolveMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('//')) return 'https:' + url;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return MAIN_URL + url;
    return url;
}

function resolveSubtitleUrl(url) {
    if (!url) return '';
    if (url.startsWith('//')) return 'https:' + url;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return MAIN_URL + url;
    return MAIN_URL + '/' + url;
}

function qualityFromUrl(url) {
    if (!url) return 'Unknown';
    const m = url.match(/(2160p|1440p|1080p|720p|576p|540p|480p|360p|4k|uhd)/i);
    if (m) {
        const v = m[1].toLowerCase();
        if (v === '4k' || v === 'uhd') return '2160p';
        return v;
    }
    return 'Unknown';
}

function cleanSourceName(s) {
    if (!s) return '';
    let name = s.replace('auto:', '').replace(/:/g, ' ').replace(/-/g, ' ').trim();
    if (/^server\s*[a-z]$/i.test(name)) {
        name = name.replace(/server\s*([a-z])/i, function(m, letter) {
            return 'Server ' + letter.toUpperCase();
        });
    }
    return name;
}

function subtitleLabelFromUrl(url) {
    if (!url) return 'Subtitle';
    const file = url.split('?')[0].split('/').pop().replace(/%20/g, ' ');
    const lower = file.toLowerCase();
    if (lower.includes('bangla') || lower.includes('bengali') || lower.includes('ben')) return 'Bangla';
    if (lower.includes('english') || lower.includes('eng')) return 'English';
    if (lower.includes('hindi') || lower.includes('hin')) return 'Hindi';
    return 'Subtitle';
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ─────────────────────────────────────────────────────────────────────────────
// TMDB integration
// ─────────────────────────────────────────────────────────────────────────────

function getTMDBDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

    return fetch(url, { headers: { 'Accept': 'application/json' }, skipSizeCheck: true })
        .then(r => {
            if (!r.ok) throw new Error('TMDB HTTP ' + r.status);
            return r.json();
        })
        .then(data => {
            const title = mediaType === 'tv' ? data.name : data.title;
            const releaseDate = mediaType === 'tv' ? data.first_air_date : data.release_date;
            return {
                title: title,
                year: releaseDate ? parseInt(releaseDate.split('-')[0], 10) : null,
                imdbId: (data.external_ids && data.external_ids.imdb_id) || null,
            };
        })
        .catch(err => {
            console.error('[CTGMovies] TMDB fetch failed:', err.message);
            return null;
        });
}

// ─────────────────────────────────────────────────────────────────────────────
// CTG API 
// ─────────────────────────────────────────────────────────────────────────────

function queryString(query) {
    query = query || {};
    const params = Object.keys(query)
        .filter(k => query[k] != null)
        .map(k => `${encodeUrl(k)}=${encodeUrl(String(query[k]))}`);
    return params.length ? '?' + params.join('&') : '';
}

function buildApiUrl(path, query) {
    const p = path.startsWith('/') ? path : '/' + path;
    return DEFAULT_API_BASE + p + queryString(query);
}

function buildSameOriginUrl(path, query) {
    const p = path.startsWith('/') ? path : '/' + path;
    return MAIN_URL + '/api/v1' + p + queryString(query);
}

function getDetail(item) {
    let endpoint = item.kind || 'movies';
    if (endpoint === 'movie') endpoint = 'movies';
    return apiGet(`/${endpoint}/${item.id}`).then(raw => {
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    });
}

function apiHeaders() {
    const h = Object.assign({}, WEB_HEADERS);
    if (AUTH_CONFIG.token && AUTH_CONFIG.token.trim()) {
        const token = AUTH_CONFIG.token.trim().replace(/^Bearer\s+/i, '');
        h['Authorization'] = 'Bearer ' + token;
        h['x-auth-token'] = token;
    }
    if (AUTH_CONFIG.cookie && AUTH_CONFIG.cookie.trim()) {
        h['Cookie'] = AUTH_CONFIG.cookie.trim();
    }
    return h;
}

function apiGet(path, query) {
    const primaryUrl = buildApiUrl(path, query);
    const fallbackUrl = buildSameOriginUrl(path, query);
    const headers = apiHeaders();

    function tryFetch(url, attempt) {
        attempt = attempt || 0;
        return fetch(url, { headers: headers, skipSizeCheck: true })
            .then(r => {
                if (r.status >= 500 && r.status < 600 && attempt < 1) {
                    return new Promise(resolve => setTimeout(resolve, 300))
                        .then(() => tryFetch(url, attempt + 1));
                }
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            });
    }

    return tryFetch(primaryUrl)
        .catch(() => tryFetch(fallbackUrl))
        .catch(err => {
            console.error(`[CTGMovies] apiGet ${path} failed:`, err.message);
            return null;
        });
}

// ─────────────────────────────────────────────────────────────────────────────
// Search & parse
// ─────────────────────────────────────────────────────────────────────────────

function toSearchItem(obj, kind) {
    const isMovie = kind === 'movies';
    const isAnime = kind === 'anime' || (obj.is_anime === true && kind !== 'tv');

    const title = optString(obj, 'title') || optString(obj, 'name') || optString(obj, 'english_title');
    if (!title) return null;

    const id = optString(obj, 'slug') || optString(obj, 'id') || optString(obj, '_id');
    if (!id) return null;

    const poster = optString(obj, 'poster_url') || optString(obj, 'cover_url');
    const year = optInt(obj, 'year')
        || yearFromDate(optString(obj, 'release_date'))
        || yearFromDate(optString(obj, 'first_air_date'));

    let type = isMovie ? 'movie' : (isAnime ? 'anime' : 'tv');
    let url = `${MAIN_URL}/${isMovie ? 'movies' : (isAnime ? 'anime' : 'tv')}/${id}`;

    return {
        title: cleanDisplayTitle(title),
        url: url,
        kind: kind,
        id: id,
        type: type,
        poster: poster,
        year: year,
    };
}

function parseSearchItems(raw, kind) {
    if (!raw) return [];
    let trimmed = raw.trim();
    let arr;
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            arr = parsed;
        } else if (parsed && typeof parsed === 'object') {
            arr = parsed.movies || parsed.results || parsed.data || [];
        } else {
            arr = [];
        }
    } catch (e) {
        return [];
    }

    const items = [];
    for (const obj of arr) {
        const item = toSearchItem(obj, kind);
        if (item) items.push(item);
    }
    return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Presentation Builder
// ─────────────────────────────────────────────────────────────────────────────

function searchCtg(query) {
    const params = { search: query };
    const moviesP = apiGet('/movies', params).then(raw => parseSearchItems(raw, 'movies')).catch(() => []);
    const tvP = apiGet('/tv', params).then(raw => parseSearchItems(raw, 'tv')).catch(() => []);
    const animeP = apiGet('/anime', params).then(raw => parseSearchItems(raw, 'anime')).catch(() => []);

    return Promise.all([moviesP, tvP, animeP]).then(([m, t, a]) => m.concat(t).concat(a));
}

function findBestMatch(mediaInfo, items, mediaType) {
    if (!items.length) return null;

    const targetNorm = normalizedTitle(mediaInfo.title);
    const targetYear = mediaInfo.year;
    let best = null;
    let bestScore = -1;

    for (const item of items) {
        const itemNorm = normalizedTitle(item.title);
        let score = -1;

        if (itemNorm === targetNorm) {
            score = 100;
            if (targetYear && item.year === targetYear) score += 50;
        } else if (itemNorm.includes(targetNorm) && targetNorm.length >= 4) {
            score = 60;
            if (targetYear && item.year === targetYear) score += 30;
        } else if (targetNorm.includes(itemNorm) && itemNorm.length >= 4) {
            score = 40;
        }

        if (mediaType === 'tv' && (item.type === 'tv' || item.type === 'anime')) score += 10;
        if (mediaType === 'movie' && (item.type === 'movie' || item.type === 'anime')) score += 10;

        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    }

    return bestScore >= 30 ? best : null;
}

function buildStreams(links, mediaInfo) {
    const seen = new Set();
    const out = [];

    links.forEach((link, i) => {
        if (!link || link.broken === true) return;

        const rawUrl = optString(link, 'url')
            || optString(link, 'file')
            || optString(link, 'src')
            || optString(link, 'link');
        if (!rawUrl) return;

        const finalUrl = resolveMediaUrl(rawUrl);
        if (!finalUrl || seen.has(finalUrl)) return;
        seen.add(finalUrl);

        let quality = qualityFromUrl(finalUrl);
        const qualityHint = optString(link, 'quality') || '';
        if (quality === 'Unknown') {
            const qMatch = qualityHint.match(/(2160|1440|1080|720|576|540|480|360)p?/i);
            if (qMatch) {
                const v = parseInt(qMatch[1], 10);
                quality = v >= 2160 ? '2160p' : v >= 1440 ? '1440p' : v >= 1080 ? '1080p' :
                    v >= 720 ? '720p' : v >= 576 ? '576p' : v >= 480 ? '480p' : v >= 360 ? '360p' : 'Unknown';
            }
        }
        const displayQuality = quality !== 'Unknown' ? quality.toUpperCase() : '1080P';

        const rawLang = (optString(link, 'language') || 'en').toLowerCase();
        let displayLang = 'English';
        let regionFlag = '🌍';
        if (rawLang.includes('hin') || qualityHint.toLowerCase().includes('hindi')) {
            displayLang = 'Hindi';
            regionFlag = '🇮🇳';
        } else if (rawLang.includes('ben') || rawLang.includes('bangla')) {
            displayLang = 'Bangla';
            regionFlag = '🇧🇩';
        } else if (rawLang.includes('eng') || rawLang === 'en') {
            displayLang = 'English';
            regionFlag = '🇺🇸';
        }

        const textContext = (finalUrl + ' ' + qualityHint + ' ' + (link.group_source || '') + ' ' + (link.source_display || '')).toLowerCase();
        let codec = 'x264';
        if (textContext.includes('x265') || textContext.includes('h265')) codec = 'x265';
        else if (textContext.includes('hevc')) codec = 'HEVC';

        let sourceContainer = 'WEB-DL';
        if (textContext.includes('webrip') || textContext.includes('web-rip')) sourceContainer = 'WEB-Rip';
        else if (textContext.includes('bluray') || textContext.includes('blu-ray') || textContext.includes('brrip')) sourceContainer = 'BluRay';
        else if (textContext.includes('hdrip')) sourceContainer = 'HDRip';

        let fileFormat = 'MKV';
        if (finalUrl.includes('.mp4')) fileFormat = 'MP4';
        else if (finalUrl.includes('.m3u8')) fileFormat = 'M3U8';

        const displaySize = optInt(link, 'size_bytes')
            ? formatBytes(optInt(link, 'size_bytes'))
            : 'Unknown';

        let audioChannels = '5.1 Surround';

        let rawServer = optString(link, 'group_source') || optString(link, 'source_display') || `Server ${i + 1}`;
        const serverLabel = cleanSourceName(rawServer);
        
        const headerText = `CTGMovies | ${displayQuality} | ${displayLang}`;
        
        const line1 = `🍿 ${mediaInfo.title} - (${mediaInfo.year || '2026'})`;
        const line2 = `⭐ ${displayQuality} | ${regionFlag} ${displayLang} | 💾 ${displaySize}`;
        const line3 = `🔖 ${fileFormat} | 🎥 ${codec} | 🎧 ${audioChannels}`;
        const line4 = `⛓️‍💥 ${serverLabel} | ☁️ ${sourceContainer}`;

        const packedMetadataLayout = `${line1}\n${line2}\n${line3}\n${line4}`;

        const subtitles = [];
        const subKeys = ['subtitle_tracks', 'subtitles', 'captions', 'tracks'];
        for (const key of subKeys) {
            const subs = link[key];
            if (Array.isArray(subs)) {
                for (const sub of subs) {
                    const subUrl = optString(sub, 'url') || optString(sub, 'file') || optString(sub, 'src');
                    if (!subUrl) continue;
                    const resolved = resolveSubtitleUrl(subUrl);
                    if (!resolved || subtitles.some(s => s.url === resolved)) continue;
                    const lang = optString(sub, 'label') || optString(sub, 'language') || subtitleLabelFromUrl(resolved);
                    subtitles.push({ url: resolved, lang: lang });
                }
            }
        }

        out.push({
            name: headerText,
            title: packedMetadataLayout,
            size: packedMetadataLayout, 
            description: packedMetadataLayout,
            url: finalUrl,
            quality: '',      // Empty string cleanly removes any prefix and tracking dots entirely
            language: '',     // Prevents trailing ' • en' language tags on the last line
            provider: 'CTGMovies',
            headers: STREAM_HEADERS,
            subtitles: subtitles.length ? subtitles : undefined,
        });
    });

    return out;
}

function getMovieStreams(item, mediaInfo) {
    return getDetail(item)
        .then(obj => {
            if (!obj || !obj.links) return [];
            return buildStreams(obj.links, mediaInfo);
        })
        .catch(() => []);
}

function getEpisodeStreams(item, mediaInfo, season, episode) {
    return getDetail(item)
        .then(obj => {
            if (!obj || !obj.episodes) return [];
            const mergedLinks = [];
            for (const ep of obj.episodes) {
                const epNum = optInt(ep, 'episode_number') || optInt(ep, 'absolute_number');
                const seasonNum = optInt(ep, 'season_number') || 1;
                if (seasonNum !== season || epNum !== episode) continue;

                const links = ep.links || [];
                for (const link of links) {
                    if (link && link.broken !== true) mergedLinks.push(link);
                }
            }
            return buildStreams(mergedLinks, mediaInfo);
        })
        .catch(() => []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Points
// ─────────────────────────────────────────────────────────────────────────────

function scrape(metadata) {
    const title = metadata && metadata.title;
    const type = (metadata && metadata.type) || 'movie';
    const season = metadata && metadata.season;
    const episode = metadata && metadata.episode;
    const year = metadata && metadata.year;

    if (!title) return Promise.resolve([]);
    const mediaInfo = { title: title, year: year || null, imdbId: (metadata && metadata.imdbId) || null };

    return searchCtg(title)
        .then(items => {
            if (!items.length) return [];
            const match = findBestMatch(mediaInfo, items, type);
            if (!match) return [];

            if (type === 'tv' && season && episode) {
                mediaInfo.title = `${mediaInfo.title} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
                return getEpisodeStreams(match, mediaInfo, season, episode);
            }
            return getMovieStreams(match, mediaInfo);
        })
        .catch(() => []);
}

function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    return getTMDBDetails(tmdbId, mediaType)
        .then(mediaInfo => {
            if (!mediaInfo || !mediaInfo.title) return [];
            return scrape({
                title: mediaInfo.title,
                year: mediaInfo.year,
                type: mediaType,
                season: season,
                episode: episode,
                imdbId: mediaInfo.imdbId,
            });
        })
        .catch(() => []);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams, scrape };
}
