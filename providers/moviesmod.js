/**
 * FilmyFly Provider v1.2
 * Uses FilmyFly FastAPI: https://badboysxs-ff.hf.space
 * Provides direct download links with part support for series.
 * Now with optimized streaming proxy for smooth playback.
 * By Murph Streams ⚡
 */

'use strict';

const API_BASE = 'https://badboysxs-ff.hf.space';
const STREAM_PROXY = 'https://badboysxs-mm.hf.space/fi-stream'; // Optimized streaming proxy
const TAG = '[FilmyFly]';

const cache = new Map();
const CACHE_TTL = 20 * 60 * 1000;

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return undefined; }
    return entry.val;
}
function setCached(key, val) {
    if (cache.size > 200) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(key, { val, ts: Date.now() });
}

async function apiFetch(path, params) {
    const url = new URL(path, API_BASE);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null && v !== 0) url.searchParams.set(k, v);
        }
    }
    const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(90000),
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error(`${TAG} HTTP ${res.status} for ${url}`);
    return res.json();
}

async function tmdbMeta(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const res = await fetch(
        `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c`,
        { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
        title: mediaType === 'tv' ? d.name : d.title,
        year: (mediaType === 'tv' ? d.first_air_date : d.release_date || '').slice(0, 4)
    };
}

function getBestLink(links) {
    if (!links) return null;
    // Priority: cloud_direct > fast_direct > direct_download > fast_cloud (skip pixeldrain)
    return links.cloud_direct || links.fast_direct || links.direct_download || links.fast_cloud || null;
}

// Wrap URL with optimized streaming proxy for smooth playback
function wrapWithStreamProxy(url) {
    if (!url) return null;
    // Use the streaming proxy for direct download URLs
    return `${STREAM_PROXY}?url=${encodeURIComponent(url)}`;
}

// Extract codec from file title (HEVC, H.265, AVC, etc.)
function extractCodec(fileTitle) {
    if (!fileTitle) return null;
    const title = fileTitle.toUpperCase();
    if (title.includes('HEVC') || title.includes('H.265')) return 'HEVC';
    if (title.includes('AVC') || title.includes('H.264')) return 'AVC';
    return null;
}

// Extract audio language from audio_lang field or file title
function extractAudioLang(audioLang, fileTitle) {
    if (audioLang) return audioLang;
    if (!fileTitle) return 'Hindi';
    const title = fileTitle.toUpperCase();
    if (title.includes('DUAL AUDIO') || title.includes('HINDI + ENGLISH')) return 'Hindi + English';
    if (title.includes('HINDI DUBBED')) return 'Hindi Dubbed';
    if (title.includes('ENGLISH')) return 'English';
    return 'Hindi';
}

// Build stream name with quality and audio
function buildStreamName(quality, audioLang) {
    return `📽️ FilmyFly | ${quality} | ${audioLang}`;
}

// Build stream title with all info
function buildStreamTitle(options) {
    const {
        season, episode, quality, codec, audioLang, size,
        isPartLink, partLabel, fileTitle
    } = options;

    const lines = [];

    // Episode/Part info
    if (season !== null && episode !== null) {
        if (isPartLink && partLabel) {
            lines.push(`S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} - ${partLabel}`);
        } else {
            lines.push(`S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`);
        }
    }

    // Quality and codec line
    const qualityParts = [];
    if (quality) qualityParts.push(quality);
    if (codec) qualityParts.push(codec);
    if (audioLang) qualityParts.push(`🔊 ${audioLang}`);
    if (qualityParts.length > 0) {
        lines.push(`🎥 ${qualityParts.join(' · ')}`);
    }

    // Size
    if (size && size !== 'N/A') {
        lines.push(`💾 ${size}`);
    }

    // Part link warning
    if (isPartLink && partLabel) {
        lines.push(`⚠️ Part Link - Contains Episodes ${partLabel}`);
    }

    // Download type
    lines.push('⚡ Direct Download');

    // Tagline
    lines.push('By Murph Streams ⚡');

    return lines.join('\n');
}

function extractMovieStreams(data) {
    const streams = [];
    if (!data || !data.results || !Array.isArray(data.results)) return streams;

    for (const row of data.results) {
        if (!row.links) continue;
        const url = getBestLink(row.links);
        if (!url) continue;

        const quality = row.quality || 'HD';
        const size = row.file_size || '';
        const fileTitle = row.file_title || '';
        const audioLang = extractAudioLang(row.audio_lang, fileTitle);
        const codec = extractCodec(fileTitle);

        const streamName = buildStreamName(quality, audioLang);
        const title = buildStreamTitle({
            season: null, episode: null, quality, codec, audioLang, size,
            isPartLink: false, partLabel: null, fileTitle
        });

        streams.push({
            name: streamName,
            title: title,
            url: url,
            behaviorHints: {
                notWebReady: true,
                bingeGroup: `filmyfly-${quality.toLowerCase()}`
            }
        });
    }

    streams.sort((a, b) => {
        // Quality: high-to-low
        const pa = parseInt((a.name || '').match(/\d+p/)?.[0] || 0);
        const pb = parseInt((b.name || '').match(/\d+p/)?.[0] || 0);
        return pb - pa;
    });

    console.log(`${TAG} Extracted ${streams.length} movie streams`);
    return streams;
}

// Find which part contains the requested episode
function findPartForEpisode(episodeData, targetEpisode) {
    if (!episodeData || !Array.isArray(episodeData)) return null;

    for (const ep of episodeData) {
        const fileTitle = ep.file_title || '';
        const partMatch = fileTitle.match(/Part[-\s]?(\d+)\(Ep\.(\d+)(?:-(\d+))?\)/i);
        if (partMatch) {
            const partNum = parseInt(partMatch[1]);
            const startEp = parseInt(partMatch[2]);
            const endEp = partMatch[3] ? parseInt(partMatch[3]) : startEp;

            if (targetEpisode >= startEp && targetEpisode <= endEp) {
                return {
                    data: ep,
                    partNum: partNum,
                    startEp: startEp,
                    endEp: endEp,
                    partLabel: `${startEp}${endEp > startEp ? '-' + endEp : ''}`
                };
            }
        }
    }
    return null;
}

function extractSeriesStreams(data, season, episode) {
    const streams = [];
    if (!data || data.type !== 'series') return streams;

    const seriesTitle = data.series_title || '';
    const episodes = data.episodes || {};

    // Check if episode is in Episode 0 (parts)
    const partInfo = episode !== undefined && episode !== null
        ? findPartForEpisode(episodes['Episode 0'], episode)
        : null;

    // Get all quality options for the requested episode
    // If episode is in a part, use the part data; otherwise use direct episode
    let episodeQualities = [];
    let episodeLabel = '';

    if (partInfo) {
        // Episode is in a part - use part data
        episodeQualities = episodes['Episode 0'] || [];
        episodeLabel = `Part ${partInfo.partNum}`;
    } else if (episode !== undefined && episode !== null) {
        // Direct episode
        const directKey = `Episode ${episode}`;
        episodeQualities = episodes[directKey] || [];
        if (episodeQualities.length === 0) {
            // Fallback to first available episode
            const availableKeys = Object.keys(episodes).filter(k => k !== 'Episode 0');
            if (availableKeys.length > 0) {
                episodeQualities = episodes[availableKeys[0]] || [];
                const match = availableKeys[0].match(/Episode\s*(\d+)/i);
                episodeLabel = match ? `Episode ${match[1]}` : availableKeys[0];
            }
        } else {
            episodeLabel = `Episode ${episode}`;
        }
    } else {
        // No specific episode - list all episodes
        episodeQualities = [];
    }

    // Add streams for the specific episode (or part)
    if (episode !== undefined && episode !== null) {
        for (const qual of episodeQualities) {
            // For parts, only add the one matching our episode range
            if (partInfo && qual.file_title) {
                const qualPartMatch = qual.file_title.match(/Part[-\s]?(\d+)\(Ep\.(\d+)(?:-(\d+))?\)/i);
                if (qualPartMatch && parseInt(qualPartMatch[1]) !== partInfo.partNum) {
                    continue; // Skip other parts
                }
            }

            if (!qual.links) continue;
            const url = getBestLink(qual.links);
            if (!url) continue;

            const quality = qual.quality || 'HD';
            const size = qual.file_size || '';
            const fileTitle = qual.file_title || '';
            const audioLang = extractAudioLang(qual.audio_lang, fileTitle);
            const codec = extractCodec(fileTitle);

            const streamName = buildStreamName(quality, audioLang);
            const title = buildStreamTitle({
                season, episode, quality, codec, audioLang, size,
                isPartLink: !!partInfo, partLabel: partInfo ? partInfo.partLabel : null, fileTitle
            });

            streams.push({
                name: streamName,
                title: title,
                url: url,
                isPartLink: !!partInfo,
                partNum: partInfo ? partInfo.partNum : null,
                behaviorHints: {
                    notWebReady: true,
                    bingeGroup: `filmyfly-s${season}`
                }
            });
        }
    }

    // Also add all other episodes (not in parts) for browsing
    for (const [epKey, epArray] of Object.entries(episodes)) {
        if (epKey === 'Episode 0') continue; // Skip parts - add individually

        const epMatch = epKey.match(/Episode\s*(\d+)/i);
        if (!epMatch) continue;
        const epNum = parseInt(epMatch[1]);

        // Skip the episode we already added
        if (episode !== undefined && episode !== null && epNum === episode && !partInfo) continue;

        for (const qual of epArray) {
            if (!qual.links) continue;
            const url = getBestLink(qual.links);
            if (!url) continue;

            const quality = qual.quality || 'HD';
            const size = qual.file_size || '';
            const fileTitle = qual.file_title || '';
            const audioLang = extractAudioLang(qual.audio_lang, fileTitle);
            const codec = extractCodec(fileTitle);

            const streamName = buildStreamName(quality, audioLang);
            const title = buildStreamTitle({
                season, episode: epNum, quality, codec, audioLang, size,
                isPartLink: false, partLabel: null, fileTitle
            });

            // Avoid duplicates
            const exists = streams.some(s => s.url === url);
            if (!exists) {
                streams.push({
                    name: streamName,
                    title: title,
                    url: url,
                    isPartLink: false,
                    partNum: null,
                    behaviorHints: {
                        notWebReady: true,
                        bingeGroup: `filmyfly-s${season}`
                    }
                });
            }
        }
    }

    // Also add individual parts as separate entries for browsing
    if (episodes['Episode 0'] && episodes['Episode 0'].length > 0) {
        for (const partEp of episodes['Episode 0']) {
            if (!partEp.links) continue;
            const url = getBestLink(partEp.links);
            if (!url) continue;

            const fileTitle = partEp.file_title || '';
            const partMatch = fileTitle.match(/Part[-\s]?(\d+)\(Ep\.(\d+)(?:-(\d+))?\)/i);
            if (!partMatch) continue;

            const partNum = parseInt(partMatch[1]);
            const startEp = parseInt(partMatch[2]);
            const endEp = partMatch[3] ? parseInt(partMatch[3]) : startEp;
            const partLabel = `${startEp}${endEp > startEp ? '-' + endEp : ''}`;

            const quality = partEp.quality || 'HD';
            const size = partEp.file_size || '';
            const audioLang = extractAudioLang(partEp.audio_lang, fileTitle);
            const codec = extractCodec(fileTitle);

            // Show as part for the first episode in range
            const showEp = startEp;

            const streamName = buildStreamName(quality, audioLang);
            const title = buildStreamTitle({
                season, episode: showEp, quality, codec, audioLang, size,
                isPartLink: true, partLabel: partLabel, fileTitle
            });

            // Avoid duplicates
            const exists = streams.some(s => s.url === url);
            if (!exists) {
                streams.push({
                    name: streamName,
                    title: title,
                    url: url,
                    isPartLink: true,
                    partNum: partNum,
                    behaviorHints: {
                        notWebReady: true,
                        bingeGroup: `filmyfly-s${season}`
                    }
                });
            }
        }
    }

    streams.sort((a, b) => {
        // 1. Quality: high-to-low
        const pa = parseInt((a.name || '').match(/\d+p/)?.[0] || 0);
        const pb = parseInt((b.name || '').match(/\d+p/)?.[0] || 0);
        if (pa !== pb) return pb - pa;

        // 2. Type: direct episodes (non-parts) before parts
        if (a.isPartLink !== b.isPartLink) {
            return a.isPartLink ? 1 : -1;  // false (direct) comes first
        }

        // 3. Part number: ascending for parts (Part 1 before Part 2)
        if (a.isPartLink && b.isPartLink) {
            return (a.partNum || 0) - (b.partNum || 0);
        }

        return 0;
    });

    console.log(`${TAG} Extracted ${streams.length} series streams for S${season}`);
    return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const isTv = mediaType === 'tv' || mediaType === 'series';
    const se = isTv ? season || 1 : null;
    const ep = isTv ? episode || 1 : null;

    const cacheKey = `ff::${tmdbId}::${mediaType}::${se}::${ep}`;
    const cached = getCached(cacheKey);
    if (cached) {
        console.log(`${TAG} Cache HIT → ${cached.length} streams`);
        return cached;
    }

    const meta = await tmdbMeta(tmdbId, mediaType);
    if (!meta) {
        console.log(`${TAG} No TMDB meta for ${tmdbId}`);
        return [];
    }

    const { title, year } = meta;
    const searchTitle = year ? `${title} ${year}` : title;
    console.log(`${TAG} ▶ ${title} ${mediaType}${isTv ? ` S${se}E${ep}` : ''}`);

    try {
        let streams = [];
        if (isTv) {
            const data = await apiFetch('/search', { q: title, season: se });
            streams = extractSeriesStreams(data, se, ep);
        } else {
            const data = await apiFetch('/search', { q: searchTitle });
            streams = extractMovieStreams(data);
        }

        console.log(`${TAG} ✓ ${streams.length} streams for "${title}"`);
        if (streams.length) setCached(cacheKey, streams);
        return streams;
    } catch (err) {
        console.error(`${TAG} ✗ ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
