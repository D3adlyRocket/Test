const cheerio = require('cheerio');
const fetch = require('node-fetch');

/**
 * Nuvio-compatible getStreams module
 * This replaces the "scraper" part of your script with a live resolver.
 */
async function getStreams(title, url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
        });
        
        const html = await response.text();
        const $ = cheerio.load(html);
        const streams = [];

        // 1TamilMV usually stores magnets in specific anchor tags or hidden inputs
        $('a[href^="magnet:?"]').each((_, el) => {
            const magnet = $(el).attr('href');
            // Try to find quality info (1080p, 720p) in the surrounding text or the link name
            const linkText = $(el).text().trim() || $(el).closest('tr').text().trim();
            
            streams.push({
                name: '1TamilMV',
                title: linkText.split('\n')[0].substring(0, 100), // Clean up title
                infoHash: extractHash(magnet),
                magnet: magnet
            });
        });

        return streams;
    } catch (err) {
        console.error('Error in getStreams:', err);
        return [];
    }
}

// Helper to extract infoHash for Nuvio's internal player
function extractHash(magnet) {
    const match = magnet.match(/btih:([a-zA-Z0-9]+)/);
    return match ? match[1].toLowerCase() : null;
}

module.exports = { getStreams };
