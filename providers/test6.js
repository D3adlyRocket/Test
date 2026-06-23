/**
 * Hashhackers - Pure Promise Version (TV Support, Quality, Size, Strict Filter)
 * Author: Xyr0nX/Antonio Ante
 * GitHub: https://github.com/Xyr0nX
 */

// ─── TOKEN FETCHER (APP SETTINGS) ───────────────────────────────────────────────
function getToken() {
    return new Promise(function(resolve) {
        try {
            // First check global scraper settings
            if (typeof global !== "undefined" && global.SCRAPER_SETTINGS && global.SCRAPER_SETTINGS.cinemaTvToken) {
                console.log("[CinemaTV] Using token from global.SCRAPER_SETTINGS");
                return resolve(String(global.SCRAPER_SETTINGS.cinemaTvToken).trim());
            }
            // Fallback to window scraper settings
            if (typeof window !== "undefined" && window.SCRAPER_SETTINGS && window.SCRAPER_SETTINGS.cinemaTvToken) {
                console.log("[CinemaTV] Using token from window.SCRAPER_SETTINGS");
                return resolve(String(window.SCRAPER_SETTINGS.cinemaTvToken).trim());
            }
        } catch (ex) { 
            console.error("[CinemaTV] Error checking settings panel:", ex.message);
        }
        
        console.error("[CinemaTV] No token found in settings! Please configure GramCinema settings.");
        resolve("");
    });
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
    if (!bytes || bytes == 0) return "Unknown";
    var k = 1024;
    var sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function fetchJson(url, options) {
    console.log("[CinemaTV] Fetching: " + url);
    return fetch(url, options || {}).then(function(res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
    }).catch(function(err) {
        console.error("[CinemaTV] Fetch Failed: " + err.message);
        throw err;
    });
}

// ─── MAIN getStreams ───────────────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {
    console.log("[Hashhackers] getStreams: " + tmdbId + " | Type: " + mediaType);

    if (mediaType !== "movie" && mediaType !== "tv") return Promise.resolve([]);

    // Fetch token directly from app settings instead of local server URL
    return getToken()
        .then(function(token) {
            if (!token) {
                console.error("[CinemaTV] No token available, aborting getStreams");
                return [];
            }

            var isTv = mediaType === "tv";
            var isImdb = String(tmdbId).indexOf("tt") === 0;

            var tmdbUrl = isImdb
                ? "https://api.themoviedb.org/3/find/" + tmdbId + "?api_key=d131017ccc6e5462a81c9304d21476de&external_source=imdb_id&language=en-US"
                : "https://api.themoviedb.org/3/" + (isTv ? "tv" : "movie") + "/" + tmdbId + "?api_key=d131017ccc6e5462a81c9304d21476de&language=en-US";

            return fetchJson(tmdbUrl)
                .then(function(tmdbData) {
                    var mediaData;
                    if (isImdb) {
                        mediaData = isTv ? (tmdbData.tv_results && tmdbData.tv_results[0]) : (tmdbData.movie_results && tmdbData.movie_results[0]);
                    } else {
                        mediaData = tmdbData;
                    }

                    if (!mediaData) return [];

                    var title = isTv ? mediaData.name : mediaData.title;
                    var releaseDate = isTv ? mediaData.first_air_date : mediaData.release_date;
                    var year = releaseDate ? releaseDate.split("-")[0] : "";

                    var queryStr = title + " " + year;
                    if (isTv && season !== undefined && episode !== undefined) {
                        var s = season < 10 ? "0" + season : "" + season;
                        var e = episode < 10 ? "0" + episode : "" + episode;
                        queryStr += " S" + s + "E" + e;
                    }
                    var query = encodeURIComponent(queryStr.trim());

                    var HASH_HEADERS = {
                        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1",
                        "Accept": "*/*",
                        "Authorization": "Bearer " + token,
                        "Origin": "https://bollywood.eu.org",
                        "Referer": "https://bollywood.eu.org/"
                    };

                    var searchUrl = "https://tga-hd.api.hashhackers.com/mix_media_files/search?q=" + query + "&page=1";

                    return fetchJson(searchUrl, { headers: HASH_HEADERS })
                        .then(function(searchData) {
                            var files = searchData.files || [];

                            var validFiles = files.filter(function(f) {
                                var fn = f.file_name.toLowerCase().trim();
                                return /\.(mkv|mp4)$/.test(fn);
                            });

                            if (validFiles.length === 0) return [];

                            var topFiles = validFiles.slice(0, 6);
                            var streamPromises = topFiles.map(function(file) {
                                return fetchJson("https://tga-hd.api.hashhackers.com/genLink?type=mix_media&id=" + file.id, { headers: HASH_HEADERS })
                                    .then(function(linkData) {
                                        if (linkData.success && linkData.url) {
                                            var fn = file.file_name.toLowerCase();
                                            var quality = "Auto";

                                            if (fn.indexOf("2160p") !== -1 || fn.indexOf("4k") !== -1) quality = "4K";
                                            else if (fn.indexOf("1080p") !== -1) quality = "1080p";
                                            else if (fn.indexOf("720p") !== -1) quality = "720p";
                                            else if (fn.indexOf("480p") !== -1) quality = "480p";

                                            return {
                                                name: "CinemaTV",
                                                title: file.file_name,
                                                url: linkData.url,
                                                quality: quality,
                                                size: formatBytes(parseInt(file.file_size))
                                            };
                                        }
                                        return null;
                                    }).catch(function() { return null; });
                            });

                            return Promise.all(streamPromises).then(function(results) {
                                return results.filter(function(r) { return r !== null; });
                            });
                        });
                })
                .catch(function(error) {
                    console.error("[CinemaTV] Error: " + error.message);
                    return [];
                });
        });
}

// ─── APP SETTINGS CONFIGURATION ──────────────────────────────────────────────────
function onSettings() {
    return Promise.resolve([
        { type: "header", label: "GramCinema Configuration" },
        {
            type: "text",
            isPassword: true,
            key: "cinemaTvToken",
            label: "CinemaTV Token",
            placeholder: "Enter token here...",
            description: "Provide the authorization token required to access CinemaTV links."
        }
    ]);
}

module.exports = { 
    getStreams: getStreams, 
    onSettings: onSettings 
};
