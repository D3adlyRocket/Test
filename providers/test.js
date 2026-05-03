const cheerio = require('cheerio-without-node-native');

/**
 * MoviesDrive Provider for Nuvio
 * Converted from: com.moviesdrive (Cloudstream Kotlin)
 */

async function getStreams(ctx, tmdbId, type, season, episode) {
    const fetcher = ctx.fetcher;
    const baseUrl = 'https://new2.moviesdrives.my';
    const streams = [];

    try {
        // 1. Get TMDB Metadata to build the query
        const tmdbRes = await fetcher.get(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c&append_to_response=external_ids`);
        const tmdbData = JSON.parse(tmdbRes.body);
        const title = tmdbData.title || tmdbData.name;
        
        // Build query like Cloudstream (Title + Year/Season)
        let searchQuery = title;
        if (type === 'series') searchQuery += ` Season ${season}`;

        // 2. Search using the AJAX endpoint (as seen in Cloudstream logic)
        const searchUrl = `${baseUrl}/searchapi.php?q=${encodeURIComponent(searchQuery)}&page=1`;
        const searchRes = await fetcher.get(searchUrl, { headers: { 'Referer': baseUrl } });
        const searchData = JSON.parse(searchRes.body);

        if (!searchData?.hits?.length) return [];

        // 3. Find the matching post (Filter by similarity)
        const match = searchData.hits[0];
        const pageUrl = match.document.permalink.startsWith('http') 
            ? match.document.permalink 
            : `${baseUrl}${match.document.permalink}`;

        // 4. Scrape the page for all mdrive archive links
        const pageRes = await fetcher.get(pageUrl);
        const $ = cheerio.load(pageRes.body);

        const archives = [];
        // Cloudstream looks for links containing 'mdrive.lol/archives'
        $('a[href*="mdrive.lol/archives"]').each((i, el) => {
            const href = $(el).attr('href');
            // Extract quality label from nearby text (Cloudstream matches 480p, 720p, etc)
            const textContent = $(el).closest('div, p, h5').text() + $(el).text();
            const qualityMatch = textContent.match(/\d{3,4}p/i);
            
            archives.push({
                url: href,
                quality: qualityMatch ? qualityMatch[0] : '720p'
            });
        });

        // 5. Resolve Hoster Links (Intermediate Resolution)
        for (const archive of archives) {
            try {
                const archiveRes = await fetcher.get(archive.url, { headers: { 'Referer': pageUrl } });
                const $$ = cheerio.load(archiveRes.body);

                // Cloudstream prioritizes GDFlix, HubCloud, and KatDrive
                const hosters = $$('a[href*="gdflix"], a[href*="hubcloud"], a[href*="katdrive"]')
                    .map((i, el) => $$(el).attr('href')).get();

                for (const hUrl of hosters) {
                    const hRes = await fetcher.get(hUrl, { headers: { 'Referer': archive.url } });
                    const $$$ = cheerio.load(hRes.body);

                    let streamUrl = null;
                    let serverName = "MoviesDrive";

                    if (hUrl.includes('gdflix')) {
                        // Priority: BusyCDN or "Instant Download" button
                        streamUrl = $$$('a[href*="busycdn"], a:contains("Instant")').attr('href');
                        serverName = "High Speed";
                    } else if (hUrl.includes('hubcloud')) {
                        // HubCloud intermediate page logic
                        streamUrl = $$$('a:contains("Download"), a:contains("Server")')
                            .filter((i, el) => !$$$(el).attr('href').includes('hubcloud'))
                            .attr('href');
                        serverName = "Direct";
                    }

                    if (streamUrl) {
                        streams.push({
                            name: `MD [${serverName}]`,
                            title: `${title} - ${archive.quality}`,
                            url: streamUrl,
                            quality: archive.quality,
                            headers: { 'Referer': hUrl }
                        });
                    }
                }
            } catch (e) { continue; }
        }

    } catch (err) {
        console.error("[MoviesDrive] Error:", err.message);
    }

    return streams;
}

// Ensure the export matches Nuvio's provider loader
module.exports = { getStreams };
