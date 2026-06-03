/**
 * Nuvio Provider: An1me.to (GR)
 * Specs: On-Demand Stream Resolver via Direct Page Traversal
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://an1me.to';
const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_KEYS = ['d7ce857613dc6a1cf739e2f8367b92e0'];

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://an1me.to/'
};

async function getMediaTitles(tmdbId, mediaType) {
    const typePath = mediaType === 'movie' ? 'movie' : 'tv';
    for (const key of TMDB_KEYS) {
        try {
            const url = `${TMDB_API}/${typePath}/${tmdbId}?api_key=${key}`;
            const res = await axios.get(url);
            if (res.data) {
                const titles = new Set();
                if (res.data.name) titles.add(res.data.name);
                if (res.data.title) titles.add(res.data.title);
                return Array.from(titles);
            }
        } catch (err) {
            continue;
        }
    }
    return ["One Piece"];
}

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[An1me] Fetching streams for TMDB:${tmdbId} | S${season}E${episode}`);
    const streams = [];
    const queryTitles = await getMediaTitles(tmdbId, mediaType);
    const targetEpisode = String(episode);

    for (let title of queryTitles) {
        try {
            // Step 1: Clean up title to form a valid slug path guess
            // e.g., "One Piece" -> "one-piece"
            const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            
            // Construct direct standard paths to look up the archive layout directly
            const directPaths = [
                `${BASE_URL}/anime/${slug}/`,
                `${BASE_URL}/${slug}/`,
                `${BASE_URL}/anime/${slug}-greek-subs/`
            ];

            let catalogHtml = '';
            for (const path of directPaths) {
                try {
                    const res = await axios.get(path, { headers: HEADERS });
                    if (res.data) {
                        catalogHtml = res.data;
                        console.log(`[An1me] Successfully reached catalog node: ${path}`);
                        break;
                    }
                } catch (e) {
                    continue; // try next path guess
                }
            }

            // Fallback: If slug guesses failed, try hitting a tag/category index
            if (!catalogHtml) {
                try {
                    const fallbackSearch = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(title)}`, { headers: HEADERS });
                    catalogHtml = fallbackSearch.data;
                } catch (err) {
                    console.error('[An1me] Base indexing failure:', err.message);
                }
            }

            if (!catalogHtml) continue;

            const $ = cheerio.load(catalogHtml);
            let exactEpisodeUrl = '';

            // Step 2: Extract every link on the catalog hub and find the target episode match
            $('a').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;

                const cleanHref = href.toLowerCase();
                
                // Build a strict regex pattern looking for boundaries around the episode number
                // Matches patterns like: -1164/, /episode-1164, /1164-2/
                const epRegex = new RegExp(`[\\b-_/]${targetEpisode}([\\b-_/]|$|\\?)`);

                if (epRegex.test(cleanHref) && !cleanHref.includes('/anime/') && !cleanHref.includes('?s=')) {
                    exactEpisodeUrl = href;
                    return false; // Found link, break iteration loop
                }
            });

            // Step 3: If found, resolve the mirror assets hidden inside
            if (exactEpisodeUrl) {
                console.log(`[An1me] Matching Episode Node Found: ${exactEpisodeUrl}`);
                const pageRes = await axios.get(exactEpisodeUrl, { headers: HEADERS });
                const page$ = cheerio.load(pageRes.data);

                page$('iframe, video, source, embed').each((_, videoEl) => {
                    let src = page$(videoEl).attr('src') || page$(videoEl).attr('data-src') || page$(videoEl).attr('data-lazy-src');
                    if (!src) return;

                    if (src.startsWith('//')) src = 'https:' + src;

                    if (!src.includes('google') && !src.includes('facebook') && !src.includes('analytics')) {
                        streams.push({
                            name: "An1me (GR)",
                            title: videoEl.name === 'video' ? 'Direct Source (GR Subs)' : 'External Mirror Player',
                            url: src,
                            quality: '720p/1080p',
                            headers: HEADERS
                        });
                    }
                });

                if (streams.length > 0) break;
            }
        } catch (err) {
            console.error(`[An1me] Runtime failure parsing entry "${title}":`, err.message);
        }
    }

    return streams;
}

module.exports = { getStreams };
