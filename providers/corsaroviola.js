/**
 * CorsaroViola Stream Provider Module
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TMDB_API_KEY = '024c5dee9af18585c60e92fa104e3f8c';
const BASE_URL = 'https://icv.stremio-italia.eu/eyJ0bWRiX2tleSI6IjU0NjJmNzg0NjlmM2Q4MGJmNTIwMTY0NTI5NGMxNmU0IiwidXNlX3RvcmJveCI6dHJ1ZSwidG9yYm94X2tleSI6IjQxM2Q3ZDE3LTdlZWQtNDg1NC04NjQxLTg4MGViMTMwNThjZSIsInVzZV9jb3JzYXJvbmVybyI6ZmFsc2UsInVzZV91aW5kZXgiOmZhbHNlLCJ1c2Vfa25hYmVuIjp0cnVlLCJ1c2VfdG9ycmVudGdhbGF4eSI6dHJ1ZSwidXNlX3RvcnJlbnRpbyI6dHJ1ZSwidXNlX21lZGlhZnVzaW9uIjp0cnVlLCJ1c2VfY29tZXQiOnRydWUsInVzZV9zdHJlbXRocnVfdG9yeiI6dHJ1ZSwidXNlX21ldGVvciI6dHJ1ZSwidXNlX3JhcmJnIjp0cnVlLCJ1c2VfamFja2V0dCI6dHJ1ZSwiZnVsbF9pdGEiOnRydWUsImRiX29ubHkiOmZhbHNlLCJ1c2VfZ2xvYmFsX2NhY2hlIjpmYWxzZSwib25seV9kZWJyaWRfY2FjaGUiOmZhbHNlLCJoeWJyaWRfbW9kZSI6dHJ1ZSwibWF4X3Jlc19saW1pdCI6MywiZXhjbHVkZV83MjBwIjp0cnVlLCJleGNsdWRlX3NkIjp0cnVlLCJleGNsdWRlX3Vua25vd24iOnRydWUsImV4Y2x1ZGVfZHYiOnRydWV9';

const MAX_RESULTS = 10;
const QUALITY_RANKING = { '4K': 4, '1080p': 3, '720p': 2, '480p': 1, 'Unknown': 0 };

// Language map for formatting tags
const LANGUAGES = [
    [/\bita\b|italiano?/i, '🇮🇹'],
    [/\beng\b|english/i, '🇬🇧'],
    [/\bspa\b|spanish|espa/i, '🇪🇸'],
    [/\bfre\b|\bfra\b|french/i, '🇫🇷'],
    [/\bger\b|\bdeu\b|german/i, '🇩🇪'],
    [/\bmulti\b/i, '🌐']
];

/**
 * Helper to determine stream resolution quality
 */
function getQuality(filename, metaQuality) {
    let lowerFile = String(filename || '').toLowerCase();
    if (lowerFile.includes('2160') || lowerFile === '4k' || lowerFile.includes('uhd')) return '4K';
    if (lowerFile.includes('1080')) return '1080p';
    if (lowerFile.includes('720')) return '720p';

    let lowerMeta = String(metaQuality || '').toLowerCase();
    return lowerMeta.includes('2160') || lowerMeta.includes('4k') || lowerMeta.includes('uhd') 
        ? '4K' 
        : lowerMeta.includes('1080') ? '1080p' : 'Unknown';
}

/**
 * Helper to convert bytes to human-readable size
 */
function formatSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    let units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return size.toFixed(size < 10 ? 2 : 1) + ' ' + units[unitIndex];
}

/**
 * Helper to parse language tags from title string
 */
function parseLanguages(text) {
    let matches = [];
    for (let [regex, flag] of LANGUAGES) {
        if (regex.test(text) && matches.indexOf(flag) === -1) {
            matches.push(flag);
        }
    }
    return matches.join(' ') || '🇮🇹';
}

/**
 * Helper to extract video attributes/codecs
 */
function parseAttributes(text) {
    let str = String(text || '');
    let attributes = [];
    
    if (/\bremux\b/i.test(str)) attributes.push('REMUX');
    if (/\b(bluray|blu-ray|bdrip|brrip|bdmux)\b/i.test(str)) attributes.push('BluRay');
    else if (/\bweb[\s._-]?dl\b/i.test(str)) attributes.push('WEB-DL');
    else if (/\bwebrip\b/i.test(str)) attributes.push('WEBRip');
    
    if (/\b(dolby\s*vision|dovi|dv)\b/i.test(str)) attributes.push('DV');
    if (/hdr10\+?|\bhdr\b/i.test(str)) attributes.push('HDR');
    
    if (/\b(x265|h\.?\s?265|hevc)\b/i.test(str)) attributes.push('HEVC');
    else if (/\b(x264|h\.?\s?264|avc)\b/i.test(str)) attributes.push('H264');
    else if (/\bav1\b/i.test(str)) attributes.push('AV1');
    
    return attributes;
}

/**
 * Maps incoming stream object to Nuvio/Stremio unified UI format
 */
function formatStreamItem(stream, meta) {
    let behaviorHints = stream.behaviorHints || {};
    let innerMeta = stream._meta || {};
    
    let filename = behaviorHints.filename || stream.folderName || stream.filename || stream.title || 'Stream';
    let quality = getQuality(innerMeta.quality, filename);
    let seeders = typeof innerMeta.seeders === 'number' ? innerMeta.seeders : 0;
    let bytes = typeof behaviorHints.videoSize === 'number' 
        ? behaviorHints.videoSize 
        : typeof stream.size === 'number' ? stream.size : 0;
        
    let formattedSize = formatSize(bytes);
    let isCached = innerMeta.cached === true;
    let languageFlags = parseLanguages(filename);
    let tags = parseAttributes(filename);
    
    let cacheIcon = isCached ? '⚡ ' : '';
    let extraDetails = [
        seeders ? '🌱 ' + seeders : '',
        formattedSize ? '💾 ' + formattedSize : '',
        ...tags
    ].filter(Boolean);
    
    let displayTitle = meta && meta.title ? meta.title : filename;
    let displayYear = meta && meta.year ? ` (${meta.year})` : '';
    
    return {
        '_quality': quality,
        '_seeders': seeders,
        '_cached': isCached,
        'name': `${cacheIcon}🔮 ${quality} · 🌱${seeders} · ${languageFlags}`,
        'title': [
            isCached ? '⚡ TorBox cached' : '',
            `🎬 ${displayTitle}${displayYear}`,
            `📁 ${filename}`,
            extraDetails.join(' · '),
            `🗣️ ${languageFlags} · 📡 CorsaroViola`
        ].filter(Boolean).join('\n'),
        'url': stream.url,
        'quality': quality,
        'size': formattedSize,
        'seeders': seeders,
        'type': 'movie',
        'provider': 'corsaroviola',
        'behaviorHints': {
            'bingeGroup': `nuvio-icv-${quality}`
        }
    };
}

/**
 * Core stream fetching function
 */
async function getStreams(id, type, season, episode) {
    try {
        if (!BASE_URL) {
            console.log('[CorsaroViola] CORSARO_VIOLA_URL non configurato');
            return [];
        }
        
        let contentType = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
        
        // Fetch Metadata from TMDB
        let meta = await (async () => {
            if (!TMDB_API_KEY) return { imdb: null };
            try {
                let tmdbUrl = `https://api.themoviedb.org/3/${contentType}/${id}?api_key=${TMDB_API_KEY}&language=it-IT&append_to_response=external_ids`;
                let response = await fetch(tmdbUrl, { 
                    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } 
                });
                let data = await response.json();
                let airDate = data.release_date || data.first_air_date || '';
                
                return {
                    imdb: (data.external_ids && data.external_ids.imdb_id) || data.imdb_id || null,
                    title: data.title || data.name || '',
                    year: airDate ? airDate.slice(0, 4) : ''
                };
            } catch (err) {
                return { imdb: null };
            }
        })();
        
        if (!meta.imdb) {
            console.log('[CorsaroViola] IMDB id non trovato');
            return [];
        }
        
        // Formulate target provider endpoint
        let endpointPath = contentType === 'tv' 
            ? `stream/series/${meta.imdb}:${season || 1}:${episode || 1}.json` 
            : `stream/movie/${meta.imdb}.json`;
            
        let res = await fetch(`${BASE_URL}/${endpointPath}`, {
            headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
        });
        
        if (!res.ok) {
            console.log('No fetch implementation found!' + res.status);
            return [];
        }
        
        let payload = await res.json();
        let rawStreams = Array.isArray(payload.streams) ? payload.streams : [];
        
        // Filter, Map and Sort streams (Prioritize 4K/1080p and Cached links)
        let processedStreams = rawStreams
            .filter(item => item && item.url)
            .map(item => formatStreamItem(item, meta))
            .filter(item => item._quality === '4K' || item._quality === '1080p');
            
        processedStreams.sort((a, b) => {
            let cacheDiff = (b._cached ? 1 : 0) - (a._cached ? 1 : 0);
            if (cacheDiff !== 0) return cacheDiff;
            
            let qualityDiff = (QUALITY_RANKING[b._quality] || 0) - (QUALITY_RANKING[a._quality] || 0);
            if (qualityDiff !== 0) return qualityDiff;
            
            return (b._seeders || 0) - (a._seeders || 0);
        });
        
        // Trim results down to maximum configuration limits and clean internal keys
        return processedStreams.slice(0, MAX_RESULTS).map(item => {
            delete item._cached;
            delete item._seeders;
            delete item._quality;
            return item;
        });
        
    } catch (error) {
        console.log('[CorsaroViola] errore: ' + (error && error.message ? error.message : error));
        return [];
    }
}

// Export module bindings
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 'getStreams': getStreams };
} else {
    global['getStreams'] = getStreams;
}
