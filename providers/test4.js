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

// ==================== RESTRUCTURED FILTER ENGINE ====================
function makeStream(rawFilename, url, referer, parsedSize) {
    var decodedScan = "";
    try {
        decodedScan = decodeURIComponent(url) + " " + rawFilename;
    } catch(e) {
        decodedScan = url + " " + rawFilename;
    }
    var scanText = decodedScan.toLowerCase();
    var audioScan = scanText.replace(/[\s\.\-\+\[\]_]+/g, "");

    // 1. QUALITY PARSING
    var quality = "1080P";
    var qMatch = rawFilename.match(/(2160|1080|720|480)\s*P/i);
    if (qMatch) quality = qMatch[1].toUpperCase() + "P";
    else if (/4k|uhd/i.test(scanText)) quality = "2160P";

    // 2. LANGUAGE MATCH MATRIX
    var shortLangLabel = "Dual-Audio"; 
    var hasHindi = /\bhindi\b/i.test(scanText);
    var hasEng = /\b(english|eng)\b/i.test(scanText);
    var hasTamil = /\btamil\b/i.test(scanText);
    var hasTelugu = /\btelugu\b/i.test(scanText);
    
    var langCount = 0;
    if (hasHindi) langCount++;
    if (hasEng) langCount++;
    if (hasTamil) langCount++;
    if (hasTelugu) langCount++;

    if (/\b(multi|multi-audio|multi\.audio)\b/i.test(scanText) || langCount >= 3) {
        shortLangLabel = "Multi-Audio";
    } else if (/\b(dual|dual-audio|dual\.audio|dubbed)\b/i.test(scanText) || langCount === 2) {
        shortLangLabel = "Dual-Audio";
    } else if (langCount === 1) {
        if (hasHindi) shortLangLabel = "Hindi";
        else if (hasTamil) shortLangLabel = "Tamil";
        else if (hasTelugu) shortLangLabel = "Telugu";
        else if (hasEng) shortLangLabel = "English";
    }

    // 3. TITLE CLEANER
    var cleanDisplayTitle = rawFilename.replace(/\.(mkv|mp4|avi)$/i, "").replace(/\./g, " ");
    var seasonEpisodeBlock = "";
    
    var tvMatch = cleanDisplayTitle.match(/\b(S\d{1,2}\s*E\d{1,2})\b/i);
    if (tvMatch) {
        seasonEpisodeBlock = " | " + tvMatch[1].toUpperCase().replace(/\s+/g, "");
        var tvIdx = cleanDisplayTitle.toLowerCase().indexOf(tvMatch[0].toLowerCase());
        if (tvIdx > 0) cleanDisplayTitle = cleanDisplayTitle.substring(0, tvIdx);
    }

    var yearBlock = "";
    var yearMatch = cleanDisplayTitle.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
        yearBlock = yearMatch[0];
        var titleEndIdx = cleanDisplayTitle.indexOf(yearBlock);
        if (titleEndIdx > 0) cleanDisplayTitle = cleanDisplayTitle.substring(0, titleEndIdx);
    }

    cleanDisplayTitle = cleanDisplayTitle
        .replace(/AMZN|WEB-DL|AVC|x264|x265|HEVC|STAN|WEBRip|SDR|10bit|iTunes/gi, "")
        .replace(/[-_()\[\]|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    cleanDisplayTitle = cleanDisplayTitle.replace(/\b\w/g, function (c) { return c.toUpperCase(); });

    // 4. METADATA PROFILE LINES
    var qEmoji = (quality === "2160P") ? "🌟" : "💎";
    var line2 = qEmoji + " " + quality + " | 🌍 " + shortLangLabel + " | 💾 " + (parsedSize || "N/A");

    var dynamicHdr = "";
    var showLightning = false;
    if (/\b(hdr10\+|hdr10p)\b/i.test(scanText)) { dynamicHdr = "HDR10+"; showLightning = true; }
    else if (/\bhdr10\b/i.test(scanText)) { dynamicHdr = "HDR10"; showLightning = true; }
    else if (/\bhdr\b/i.test(scanText)) { dynamicHdr = "HDR"; showLightning = true; }

    var bitDepth = /\b10bit\b/i.test(scanText) ? "🔆 10Bit" : "";
    var dv = /\b(dv|dolby\s*vision|dolbyvision)\b/i.test(scanText) ? "🕵️‍♀️ DV" : "";
    var isBluRay = /\bbluray\b/i.test(scanText);
    
    var codecTag = "x264";
    if (/\b(hevc|x265|265|h265)\b/i.test(scanText)) {
        codecTag = "HEVC x265";
    } else if (/\b(x264|264|h264)\b/i.test(scanText)) {
        codecTag = "x264";
    } else if (quality === "2160P") {
        codecTag = "HEVC x265";
    }

    var line3Parts = [];
    if (dynamicHdr) line3Parts.push(dynamicHdr);
    if (bitDepth) line3Parts.push(bitDepth);
    if (isBluRay) line3Parts.push("📀 BluRay");
    if (dv) line3Parts.push(dv);

    var line3 = "";
    if (line3Parts.length > 0) {
        var prefix = showLightning ? "⚡ " : "";
        line3 = prefix + line3Parts.join(" • ") + " | 🎥 " + codecTag;
    } else {
        line3 = "🎥 " + codecTag;
    }

    var formatTag = "🎞️ MKV";
    if (/\bmp4\b/i.test(scanText)) formatTag = "🎞️ MP4";

    var audioChannelTag = "DDP 5.1";
    var displayAtmos = /\batmos\b/i.test(scanText);

    if (audioScan.indexOf("ddp51atmos") !== -1 || audioScan.indexOf("atmos51") !== -1) {
        audioChannelTag = "DDP 5.1";
        displayAtmos = true;
    } else if (audioScan.indexOf("truehd71") !== -1) {
        audioChannelTag = "TrueHD 7.1";
    } else if (audioScan.indexOf("aac71") !== -1) {
        audioChannelTag = "AAC 7.1";
    } else if (audioScan.indexOf("aac") !== -1) {
        audioChannelTag = "AAC 5.1";
    }

    var atmosBlock = displayAtmos ? " • 🔊 Atmos" : "";
    var line4 = formatTag + " | 🎧 " + audioChannelTag + atmosBlock + " |";

    var sourceOrigin = "WEB-DL";
    if (isBluRay) {
        sourceOrigin = "BluRay";
    } else if (/\bwebrip\b/i.test(scanText) || /\bhdrip\b/i.test(scanText)) {
        sourceOrigin = "WEB-Rip";
    } else if (/\b(webdl|web\-dl|itunes|amzn)\b/i.test(scanText)) {
        sourceOrigin = "WEB-DL";
    }

    var imaxBlock = /\bimax\b/i.test(scanText) ? " | 👁️ iMAX" : "";
    var line5 = "🔗 HashHackers | ☁️ " + sourceOrigin + imaxBlock;

    var finalName = "HashHackers | " + quality + " | " + shortLangLabel;
    var finalTitle = 
        "🎬 " + cleanDisplayTitle + (yearBlock ? " - (" + yearBlock + ")" : "") + seasonEpisodeBlock + "\n" +
        line2 + "\n" +
        line3 + "\n" +
        line4 + "\n" +
        line5;

    return {
        name: finalName,
        title: finalTitle,
        size: finalTitle,
        url: url.replace(/ /g, "%20"),
        behaviorHints: {
            notWebReady: true,
            proxyHeaders: { request: { "Referer": referer || "https://bollywood.eu.org/" } }
        }
    };
}

// ─── MAIN getStreams ───────────────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {
    console.log("[Hashhackers] getStreams: " + tmdbId + " | Type: " + mediaType);

    if (mediaType !== "movie" && mediaType !== "tv" && mediaType !== "series") return Promise.resolve([]);

    return getToken()
        .then(function(token) {
            if (!token) {
                console.error("[CinemaTV] No token available, aborting getStreams");
                return [];
            }

            var isTv = mediaType === "tv" || mediaType === "series";
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
                                            var sizeStr = formatBytes(parseInt(file.file_size));
                                            return makeStream(file.file_name, linkData.url, "https://bollywood.eu.org/", sizeStr);
                                        }
                                        return null;
                                    }).catch(function() { return null; });
                            });

                            return Promise.all(streamPromises).then(function(results) {
                                var streams = results.filter(function(r) { return r !== null; });

                                // --- SORT ENGINE ---
                                streams.forEach(function(s) {
                                    var scan = (s.title || "").toLowerCase();
                                    if (scan.indexOf("2160p") !== -1 || scan.indexOf("4k") !== -1) s._resWeight = 4;
                                    else if (scan.indexOf("1080p") !== -1) s._resWeight = 3;
                                    else if (scan.indexOf("720p") !== -1) s._resWeight = 2;
                                    else s._resWeight = 1;
                                });

                                streams.sort(function(a, b) {
                                    return b._resWeight - a._resWeight;
                                });

                                streams.forEach(function(s) {
                                    delete s._resWeight;
                                });

                                return streams;
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
