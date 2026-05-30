// MovieBox Global Scraper for Nuvio
// Supports all languages (English, Hindi, Tamil, Telugu, etc.)
// Uses h5-api.aoneroom.com with X-Client-Token + Referer auth

var API = "https://h5-api.aoneroom.com";
var TMDB_KEY = 'd131017ccc6e5462a81c9304d21476de';
var TMDB_URL = 'https://api.themoviedb.org/3';
var SITE = 'https://themoviebox.org';

function genToken() {
    var ts = Math.floor(Date.now() / 1000).toString();
    var rev = ts.split('').reverse().join('');
    var hash = CryptoJS.MD5(rev).toString(CryptoJS.enc.Hex);
    return ts + '.' + hash;
}

function baseHdrs(extra) {
    var h = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': SITE,
        'Referer': SITE + '/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'x-client-info': '{"timezone":"Asia/Calcutta"}',
        'x-request-lang': 'en',
        'X-Client-Token': genToken()
    };
    if (extra) { for (var k in extra) h[k] = extra[k]; }
    return h;
}

function apiCall(method, url, body, extraHdrs) {
    var opts = { method: method, headers: baseHdrs(extraHdrs) };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function(r) {
        return r.text().then(function(txt) {
            if (!r.ok) return null;
            try { return JSON.parse(txt); } catch(e) { return txt; }
        });
    }).catch(function() { return null; });
}

function getTmdb(tmdbId, type) {
    var mt = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
    return fetch(TMDB_URL + '/' + mt + '/' + tmdbId + '?api_key=' + TMDB_KEY).then(function(r) {
        return r.json();
    }).then(function(d) {
        return {
            title: mt === 'movie' ? (d.title || d.original_title) : (d.name || d.original_name),
            year: (d.release_date || d.first_air_date || '').substring(0, 4),
            mediaType: mt
        };
    }).catch(function() { return null; });
}

function normTitle(s) {
    if (!s) return "";
    return s.replace(/\[.*?\]/g, " ").replace(/\(.*?\)/g, " ")
        .replace(/\b(dub|dubbed|hd|4k|hindi|tamil|telugu)\b/gi, " ")
        .replace(/\b(dual audio)\b/gi, " ")
        .trim().toLowerCase().replace(/:/g, " ")
        .replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
}

function extractLang(title) {
    if (!title) return "Original";
    var m = title.match(/\[([^\]]+)\]/);
    if (m) {
        var lang = m[1].trim();
        if (lang.toLowerCase().indexOf('dub') >= 0) return lang;
        return lang + ' Dub';
    }
    return "Original";
}

function baseTitle(title) {
    if (!title) return "";
    return title.replace(/\s*S\d+(?:-S?\d+)*$/i, "").replace(/\s*\[.*?\]\s*/g, " ").trim();
}

function searchBox(query) {
    return apiCall('POST', API + '/wefeed-h5api-bff/subject/search', {
        keyword: query, page: 1, perPage: 28, subjectType: 0
    }).then(function(res) {
        return (res && res.data && res.data.items) || [];
    });
}

function findMatches(items, tmdbTitle, tmdbYear, mediaType) {
    var norm = normTitle(tmdbTitle);
    var target = mediaType === 'movie' ? 1 : 2;
    var results = [];
    var seen = {};

    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.subjectType !== target) continue;
        if (seen[it.subjectId]) continue;

        var bt = baseTitle(it.title);
        var nt = normTitle(bt);
        var yr = it.year || (it.releaseDate ? it.releaseDate.substring(0, 4) : null);

        var score = 0;
        if (nt === norm) score += 50;
        else if (nt.indexOf(norm) >= 0 || norm.indexOf(nt) >= 0) score += 15;
        if (tmdbYear && yr && tmdbYear == yr) score += 35;

        if (score >= 40) {
            seen[it.subjectId] = true;
            results.push({
                id: it.subjectId,
                lang: extractLang(it.title),
                dp: it.detailPath || '',
                title: it.title
            });
        }
    }

    results.sort(function(a, b) {
        if (a.lang === "Original") return -1;
        if (b.lang === "Original") return 1;
        return 0;
    });

    return results;
}

function getDownloads(subjectId, se, ep, detailPath) {
    var url = API + '/wefeed-h5api-bff/subject/download?subjectId=' + subjectId;
    if (se != null) url += '&se=' + se;
    if (ep != null) url += '&ep=' + ep;
    return apiCall('GET', url, null, {
        'Referer': SITE + '/watch/' + detailPath
    }).then(function(res) {
        return (res && res.data && res.data.downloads) || [];
    });
}

function getDetail(detailPath) {
    return apiCall('GET', API + '/wefeed-h5api-bff/detail?detailPath=' + detailPath);
}

function buildStreams(downloads, lang) {
    var seen = {};
    var result = [];
    for (var i = 0; i < downloads.length; i++) {
        var dl = downloads[i];
        if (!dl.url || seen[dl.url]) continue;
        seen[dl.url] = true;
        var qual = (dl.resolution || 'Auto') + 'p';
        var ft = null;
        var u = dl.url.toLowerCase();
        if (u.indexOf('.m3u8') >= 0) ft = 'hls';
        else if (u.indexOf('.mp4') >= 0 || u.indexOf('.mkv') >= 0) ft = 'video';
        var nameParts = ['MovieBox'];
        if (lang && lang !== 'Original') nameParts.push(lang);
        nameParts.push(qual);
        result.push({
            name: nameParts.join(' | '),
            title: qual,
            url: dl.url,
            quality: qual,
            type: ft,
            headers: { 'Referer': SITE + '/', 'Origin': SITE },
            provider: 'moviebox'
        });
    }
    return result;
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    if (seasonNum == null) seasonNum = 1;
    if (episodeNum == null) episodeNum = 1;

    return getTmdb(tmdbId, mediaType).then(function(details) {
        if (!details) return [];

        return searchBox(details.title).then(function(items) {
            var matches = findMatches(items, details.title, details.year, details.mediaType);

            if (matches.length === 0) {
                var words = details.title.split(' ');
                if (words.length > 3) {
                    return searchBox(words.slice(0, 3).join(' ')).then(function(items2) {
                        var m2 = findMatches(items2, details.title, details.year, details.mediaType);
                        return processMatches(m2, details, seasonNum, episodeNum);
                    });
                }
                return [];
            }

            return processMatches(matches, details, seasonNum, episodeNum);
        });
    });
}

function processMatches(matches, details, seasonNum, episodeNum) {
    var isTv = details.mediaType === 'tv';
    var se = isTv ? (parseInt(seasonNum, 10) || 1) : 0;
    var ep = isTv ? (parseInt(episodeNum, 10) || 1) : 0;

    var seenIds = {};
    var unique = [];
    for (var i = 0; i < matches.length; i++) {
        if (!seenIds[matches[i].id]) {
            seenIds[matches[i].id] = true;
            unique.push(matches[i]);
        }
    }

    var promises = unique.map(function(m) {
        if (isTv) {
            return getDetail(m.dp).then(function(detailRes) {
                var resource = detailRes && detailRes.data && detailRes.data.resource;
                var useSe = se;
                var useEp = ep;
                if (resource && resource.seasons) {
                    for (var j = 0; j < resource.seasons.length; j++) {
                        if (resource.seasons[j].se == se) {
                            if (resource.seasons[j].maxEp > 0 && ep > resource.seasons[j].maxEp) {
                                useEp = resource.seasons[j].maxEp;
                            }
                            break;
                        }
                    }
                }
                return getDownloads(m.id, useSe, useEp, m.dp).then(function(dls) {
                    return buildStreams(dls, m.lang);
                });
            });
        }
        return getDownloads(m.id, 0, 0, m.dp).then(function(dls) {
            return buildStreams(dls, m.lang);
        });
    });

    return Promise.all(promises).then(function(results) {
        var all = [];
        for (var i = 0; i < results.length; i++) {
            all = all.concat(results[i]);
        }
        all.sort(function(a, b) {
            var qa = parseInt(a.quality) || 0;
            var qb = parseInt(b.quality) || 0;
            if (qb !== qa) return qb - qa;
            var la = a.name.indexOf('Original') >= 0 ? 0 : 1;
            var lb = b.name.indexOf('Original') >= 0 ? 0 : 1;
            return la - lb;
        });
        return all;
    });
}

module.exports = { getStreams: getStreams };
