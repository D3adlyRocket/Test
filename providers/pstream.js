// PStream Nuvio Provider
// No async/await, no destructuring - pure Nuvio compatibility

var HOSTS = [
    "https://fed-api-db.pstream.mov",
    "https://fedapi.xyz",
    "https://api.pstream.net"
];

function getStreams(tmdbId, type, season, episode) {
    // 1. Build the correct URL based on media type
    var isMovie = type === 'movie';
    var query = isMovie ? "?tmdb=" + tmdbId : "?tmdb=" + tmdbId + "&season=" + season + "&episode=" + episode;
    var endpoint = isMovie ? "/movie" : "/tv";

    // 2. Recursive function to try hosts (Nuvio-safe)
    function fetchFromHost(index) {
        if (index >= HOSTS.length) {
            return Promise.resolve([]);
        }

        return fetch(HOSTS[index] + endpoint + query, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://pstream.net/'
            }
        })
        .then(function(res) { 
            return res.json(); 
        })
        .then(function(data) {
            var sources = data.sources || data.streams || [];
            
            // If data is an array itself
            if (Array.isArray(data) && sources.length === 0) {
                sources = data;
            }

            // Map to Nuvio's expected output format
            var results = sources.map(function(s) {
                var q = s.quality || s.label || "720p";
                return {
                    name: "PStream",
                    title: "PStream - " + q,
                    url: s.url || s.file || s.stream,
                    quality: q.toLowerCase().includes("1080") ? "1080p" : "720p"
                };
            });

            // If no sources but a direct URL exists
            if (results.length === 0 && data.url) {
                results.push({
                    name: "PStream",
                    title: "PStream - Auto",
                    url: data.url,
                    quality: "720p"
                });
            }

            if (results.length === 0) throw new Error("Empty");
            return results;
        })
        .catch(function() {
            // Move to next host if this one fails
            return fetchFromHost(index + 1);
        });
    }

    return fetchFromHost(0);
}

module.exports = { getStreams: getStreams };
