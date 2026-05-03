const cheerio = require('cheerio-without-node-native');

/**
 * MoviesDrive Nuvio Scraper
 * Logic mirrored from Cloudstream/IVA4U
 */
function getStreams(ctx, tmdbId, type, season, episode) {
    return new Promise((resolve, reject) => {
        const fetcher = ctx.fetcher;
        const baseUrl = 'https://new2.moviesdrives.my';
        const streams = [];

        // 1. Get TMDB Data first to ensure we have the correct IMDB ID or Name
        fetcher.get(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c&append_to_response=external_ids`)
            .then(res => {
                const tmdbData = JSON.parse(res.body);
                const query = tmdbData.external_ids?.imdb_id || tmdbData.title || tmdbData.name;

                // 2. Search MoviesDrive API
                const searchUrl = `${baseUrl}/searchapi.php?q=${encodeURIComponent(query)}&page=1`;
                return fetcher.get(searchUrl, { headers: { 'Referer': baseUrl } });
            })
            .then(res => {
                const searchData = JSON.parse(res.body);
                if (!searchData?.hits?.length) return resolve([]);

                // 3. Find best match and fetch the post page
                const match = searchData.hits[0];
                const pageUrl = match.document.permalink.startsWith('http') 
                    ? match.document.permalink 
                    : `${baseUrl}${match.document.permalink}`;
                
                return fetcher.get(pageUrl);
            })
            .then(res => {
                const $ = cheerio.load(res.body);
                const archivePromises = [];

                // 4. Extract mdrive.lol archives
                $('a[href*="mdrive.lol/archives"]').each((i, el) => {
                    const url = $(el).attr('href');
                    const label = $(el).closest('h5, p').prev().text().trim() || "Download";
                    
                    // Visit each archive page
                    archivePromises.push(
                        fetcher.get(url, { headers: { 'Referer': baseUrl } })
                            .then(aRes => {
                                const $$ = cheerio.load(aRes.body);
                                const hosterPromises = [];

                                // 5. Find GDFlix/HubCloud/HubDrive
                                $$('a[href*="gdflix"], a[href*="hubcloud"], a[href*="hubdrive"]').each((j, hEl) => {
                                    const hUrl = $$(hEl).attr('href');
                                    hosterPromises.push(resolveHoster(fetcher, hUrl, url, label, streams));
                                });
                                return Promise.all(hosterPromises);
                            })
                            .catch(() => {})
                    );
                });

                return Promise.all(archivePromises);
            })
            .then(() => {
                resolve(streams);
            })
            .catch(err => {
                console.error("MoviesDrive Error:", err);
                resolve([]);
            });
    });
}

/**
 * Resolves final hoster links (GDFlix / HubCloud)
 */
function resolveHoster(fetcher, url, referer, label, streams) {
    return fetcher.get(url, { headers: { 'Referer': referer } })
        .then(res => {
            const $ = cheerio.load(res.body);

            if (url.includes('gdflix')) {
                const direct = $('a[href*="busycdn"], a:contains("Instant")').attr('href');
                if (direct) {
                    streams.push({
                        name: "MoviesDrive (High Speed)",
                        title: label,
                        url: direct,
                        quality: label.match(/\d{3,4}p/)?.[0] || '1080p'
                    });
                }
            } else if (url.includes('hubcloud') || url.includes('hubdrive')) {
                const server = $('a:contains("Download"), a:contains("Server")')
                    .filter((i, el) => !$(el).attr('href').includes('hubcloud') && !$(el).attr('href').includes('hubdrive'))
                    .attr('href');
                if (server) {
                    streams.push({
                        name: "MoviesDrive (Direct)",
                        title: label,
                        url: server,
                        quality: label.match(/\d{3,4}p/)?.[0] || '720p'
                    });
                }
            }
        })
        .catch(() => {});
}

module.exports = { getStreams };
