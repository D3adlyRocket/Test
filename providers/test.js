const cheerio = require('cheerio');
const fetch = require('node-fetch');

// --- Configuration ---
const TMDB_API_KEY = '1c29a5198ee1854bd5eb45dbe8d17d92'; 
const BASE_URL = 'https://www.1tamilmv.ltd/';

/**
 * getStreams: Extracts magnet links from the 1TamilMV topic page.
 */
async function getStreams(id) {
    try {
        // Nuvio IDs usually look like "tmv_12345"
        const topicId = id.replace('tmv_', '');
        const targetUrl = `${BASE_URL}index.php?/topic/${topicId}/`;

        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        const streams = [];

        $('a[href^="magnet:?"]').each((_, el) => {
            const magnet = $(el).attr('href');
            const title = $(el).text().trim() || "Download Stream";

            streams.push({
                name: '1TamilMV',
                title: title,
                infoHash: magnet.match(/btih:([a-zA-Z0-9]+)/)?.[1].toLowerCase(),
                magnet: magnet
            });
        });

        return streams;
    } catch (e) {
        return [];
    }
}

/**
 * getCatalog: Scrapes the homepage and enriches with TMDB metadata
 */
async function getCatalog() {
    try {
        const response = await fetch(BASE_URL);
        const html = await response.text();
        const $ = cheerio.load(html);
        const results = [];

        // Selecting links based on your original script logic
        const links = $('a').filter((i, el) => {
            const text = $(el).text();
            return text.includes('Malayalam') && text.includes('(20');
        });

        for (let i = 0; i < links.length; i++) {
            const el = links[i];
            const rawText = $(el).text().trim();
            const url = $(el).attr('href');
            const topicId = url.split('/topic/')[1]?.split('-')[0];

            // 1. Clean Title for TMDB Search
            const cleanTitle = rawText
                .replace(/^(Malayalam|Tamil|Telugu|Hindi)\s*[-:]?\s*/i, '')
                .split('(')[0].trim();

            // 2. Fetch Metadata from TMDB
            let metadata = {
                id: `tmv_${topicId}`,
                name: cleanTitle,
                type: 'movie',
                poster: null
            };

            if (TMDB_API_KEY) {
                const tmdbRes = await fetch(
                    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`
                );
                const tmdbData = await tmdbRes.json();
                
                if (tmdbData.results?.[0]) {
                    const movie = tmdbData.results[0];
                    metadata.poster = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
                    metadata.description = movie.overview;
                    metadata.background = `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;
                }
            }

            results.push(metadata);
        }

        return results;
    } catch (e) {
        return [];
    }
}

module.exports = { getCatalog, getStreams };
