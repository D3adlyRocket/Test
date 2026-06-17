var cheerio = require('cheerio-without-node-native');

var BASE_URL = 'https://huhu.to';
var API_KEY = 'ov262WdL5UdUUz4mwsOKLCFy3mLmLKXiN3Yz';
var LOKKE_PING_URL = 'https://www.lokke.app/api/app/ping';
var OHA_RESOLVE_URL = 'https://huhu.to/web-vod/mediaurl-resolve.json';
var OHA_ITEM_URL = 'https://huhu.to/mediaurl-item.json';
var OHA_SOURCE_URL = 'https://huhu.to/mediaurl-source.json';

var DEFAULT_HEADERS = {
    'Authorization': 'Bearer ' + API_KEY,
    'Accept': 'application/json',
    'Origin': BASE_URL,
    'Referer': BASE_URL + '/'
};

// Known Voe mirror domains that need to be rewritten to voe.sx
var VOE_MIRRORS = [
    '19turanosephantasia.com', '20demidistance9elongations.com', '30sensualizeexpression.com',
    '321naturelikefurfuroid.com', '35volitantplimsoles5.com', '449unceremoniousnasoseptal.com',
    '745mingiestblissfully.com', 'adrianmissionminute.com', 'alleneconomicmatter.com',
    'antecoxalbobbing1010.com', 'apinchcaseation.com', 'audaciousdefaulthouse.com',
    'availedsmallest.com', 'bigclatterhomesguideservice.com', 'boonlessbestselling244.com',
    'bradleyviewdoctor.com', 'brittneystandardwestern.com', 'brucevotewithin.com',
    'charlestoughrace.com', 'christopheruntilpoint.com', 'chromotypic.com',
    'chuckle-tube.com', 'cindyeyefinal.com', 'counterclockwisejacky.com',
    'crownmakermacaronicism.com', 'crystaltreatmenteast.com', 'cyamidpulverulence530.com',
    'diananatureforeign.com', 'donaldlineelse.com', 'edwardarriveoften.com',
    'erikcoldperson.com', 'figeterpiazine.com', 'fittingcentermondaysunday.com',
    'fraudclatterflyingcar.com', 'gamoneinterrupted.com', 'generatesnitrosate.com',
    'goofy-banana.com', 'graceaddresscommunity.com', 'greaseball6eventual20.com',
    'guidon40hyporadius9.com', 'heatherdiscussionwhen.com', 'housecardsummerbutton.com',
    'jamessoundcost.com', 'jamiesamewalk.com', 'jasminetesttry.com',
    'jayservicestuff.com', 'jennifercertaindevelopment.com', 'jilliandescribecompany.com',
    'johnalwayssame.com', 'jonathansociallike.com', 'josephseveralconcern.com',
    'kathleenmemberhistory.com', 'kellywhatcould.com', 'kennethofficialitem.com',
    'kinoger.ru', 'kristiesoundsimply.com', 'lancewhosedifficult.com',
    'launchreliantcleaverriver.com', 'lauradaydo.com', 'lisatrialidea.com',
    'loriwithinfamily.com', 'lukecomparetwo.com', 'lukesitturn.com',
    'mariatheserepublican.com', 'matriculant401merited.com', 'maxfinishseveral.com',
    'metagnathtuggers.com', 'michaelapplysome.com', 'mikaylaarealike.com',
    'nathanfromsubject.com', 'nectareousoverelate.com', 'nonesnanking.com',
    'paulkitchendark.com', 'realfinanceblogcenter.com', 'rebeccaneverbase.com',
    'reputationsheriffkennethsand.com', 'richardsignfish.com', 'roberteachfinal.com',
    'robertordercharacter.com', 'robertplacespace.com', 'sandratableother.com',
    'sandrataxeight.com', 'scatch176duplicities.com', 'sethniceletter.com',
    'shannonpersonalcost.com', 'simpulumlamerop.com', 'smoki.cc',
    'stevenimaginelittle.com', 'strawberriesporail.com', 'telyn610zoanthropy.com',
    'timberwoodanotia.com', 'toddpartneranimal.com', 'toxitabellaeatrebates306.com',
    'uptodatefinishconferenceroom.com', 'v-o-e-unblock.com', 'valeronevijao.com',
    'walterprettytheir.com', 'wolfdyslectic.com', 'yodelswartlike.com'
];

// Extracts a clean domain name from a full URL string
function extractDomain(url) {
    if (!url || typeof url !== 'string') return 'Server';
    var matches = url.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
    var domain = matches && matches[1];
    if (domain) {
        return domain.replace(/^www\./i, '');
    }
    return 'Server';
}

// Standardizes miscellaneous Doodstream variations to the exact https://dood.yt/w/ID format
function normalizeDoodUrl(url) {
    if (!url || typeof url !== 'string') return url;
    
    // Checks host against your comprehensive Doodstream pattern list
    var isDood = url.match(/dood|do[0-9]go|doood|dooood|ds2play|ds2video|dsvplay|d0o0d|do0od|d0000d|d000d|myvidplay|vidply|all3do|doply|vide0|vvide0|d-s/i);
    if (isDood) {
        // Extracts the alphanumeric media ID out of paths like /d/ID, /e/ID, /w/ID or directly from raw pathing
        var match = url.match(/\/[dew]\/([a-zA-Z0-9]+)/) || url.match(/\/([a-zA-Z0-9]+)(?:\?|$)/);
        if (match && match[1]) {
            return 'https://dood.yt/w/' + match[1];
        }
    }
    return url;
}

// Rewrites Voe links and known Voe mirrors to use the base voe.sx domain cleanly
function normalizeVoeUrl(url) {
    if (!url || typeof url !== 'string') return url;
    
    var host = extractDomain(url);
    var isVoeMirror = VOE_MIRRORS.indexOf(host) !== -1 || url.indexOf('voe') !== -1;
    
    if (isVoeMirror) {
        var match = url.match(/(?:\/voe)?\/([a-zA-Z0-9]+)(?:\?|$)/);
        if (match && match[1]) {
            return 'https://voe.sx/' + match[1];
        }
    }
    return url;
}

function getLokkeHandshakePayload() {
    return {
        token: 'VKm7XwPbumwb9aeGoVi1fHa6ut1v41a5s6t-yzVQ4qZfN-VwHrdLcD18xPpL4qdzY92xAJiWD_7UZshSngIn_GTbU1uPRTuGFqYQCOBkXzu9YOUPV-u-EbB1WaSZjd6srGhQ',
        reason: 'app-blur',
        locale: 'de',
        theme: 'dark',
        metadata: {
            device: { 
                type: 'Handset', 
                brand: 'Apple', 
                model: 'iPhone 15 Pro', 
                name: 'iPhone', 
                uniqueId: 'E9B56A1F-810A-4C23-9D22-C8542FBB0D1C' 
            },
            os: { name: 'ios', version: '18.7.7', abis: ['ARM64E'], host: 'unknown' },
            app: { platform: 'ios', version: '1.0.2', buildId: '1.0.2', engine: 'jsc', installer: 'TestFlight' },
            version: { package: 'app.lokke.main', binary: '1.0.2', js: '1.0.4' },
        },
        appFocusTime: 0,
        playerActive: false,
        playDuration: 0,
        devMode: true,
        hasAddon: true,
        castConnected: false,
        package: 'app.lokke.main',
        version: '1.0.4',
        process: 'app',
        firstAppStart: Date.now(),
        lastAppStart: Date.now(),
        ipLocation: null,
        adblockEnabled: true,
        proxy: { supported: ['openvpn'], engine: 'openvpn', enabled: false, autoServer: true, id: 'fi-hel' },
        iap: { supported: true, error: 'No in-app payment subscriptions found' }
    };
}

// Executes the recursive Oha Task loop for URLs requiring client-side page fetching (like Voe)
function handleOhaTaskLoop(ohaResult, ohaHeaders) {
    if (!ohaResult || ohaResult.kind !== 'taskRequest') {
        return Promise.resolve(ohaResult);
    }

    var taskData = ohaResult.data || {};
    var targetUrl = taskData.url;
    var params = taskData.params || {};
    var targetHeaders = params.headers || {};
    var method = params.method || 'GET';

    var requestHeaders = Object.assign({}, targetHeaders, {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    return fetch(targetUrl, {
        method: method,
        headers: requestHeaders
    })
    .then(function(clientRes) {
        return clientRes.text().then(function(responseText) {
            var responseHeaders = {};
            if (typeof clientRes.headers.entries === 'function') {
                for (var pair of clientRes.headers.entries()) {
                    responseHeaders[pair[0]] = pair[1];
                }
            }

            var taskResponsePayload = {
                kind: "taskResponse",
                id: ohaResult.id,
                data: {
                    type: "fetch",
                    status: clientRes.status,
                    url: clientRes.url,
                    headers: responseHeaders,
                    text: responseText
                }
            };

            return fetch(OHA_RESOLVE_URL, {
                method: 'POST',
                headers: ohaHeaders,
                body: JSON.stringify(taskResponsePayload)
            });
        });
    })
    .then(function(nextRes) { return nextRes.json(); })
    .then(function(nextOhaResult) {
        return handleOhaTaskLoop(nextOhaResult, ohaHeaders);
    });
}

function resolveDirectMediaUrl(targetHostUrl, itemLanguage) {
    var finalTargetUrl = normalizeDoodUrl(targetHostUrl);
    finalTargetUrl = normalizeVoeUrl(finalTargetUrl);

    return fetch(LOKKE_PING_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Lokke/1.0.2 (iPhone; CPU iPhone OS 18_7_7 like Mac OS X)'
        },
        body: JSON.stringify(getLokkeHandshakePayload())
    })
    .then(function(res) { return res.json(); })
    .then(function(lokkeData) {
        var signature = lokkeData && lokkeData.addonSig;
        if (!signature) throw new Error('OhaTo: Signature validation failed');

        var ohaHeaders = {
            'Content-Type': 'application/json',
            'mediaurl-signature': signature,
            'User-Agent': 'MediaUrl/2',
            'Accept-Language': 'de-DE,de;q=0.9',
            'Accept': '*/*'
        };

        var ohaInputPayload = {
            language: itemLanguage || 'de',
            region: 'CH',
            url: finalTargetUrl,
            clientVersion: '3.0.2'
        };

        return fetch(OHA_RESOLVE_URL, {
            method: 'POST',
            headers: ohaHeaders,
            body: JSON.stringify(ohaInputPayload)
        })
        .then(function(res) { return res.json(); })
        .then(function(initialOhaResult) {
            return handleOhaTaskLoop(initialOhaResult, ohaHeaders);
        });
    })
    .then(function(ohaResult) {
        if (!ohaResult) return finalTargetUrl;
        
        var resolvedUrl = ohaResult.url || ohaResult.file || ohaResult.stream || 
                          (ohaResult.streams && ohaResult.streams[0] && ohaResult.streams[0].url) || 
                          (ohaResult.links && ohaResult.links[0]) || finalTargetUrl;
        return resolvedUrl;
    })
    .catch(function() {
        return finalTargetUrl;
    });
}

function getFinalRedirect(url) {
    return fetch(url, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
        redirect: 'follow'
    })
    .then(function(res) { return res.url; })
    .catch(function() { return url; });
}

function handleLegacyLinksFlow(ohaId) {
    var linksUrl = BASE_URL + '/web-vod/api/links?id=' + ohaId;

    return fetch(linksUrl, { headers: DEFAULT_HEADERS })
        .then(function(res) { return res.json(); })
        .then(function(links) {
            if (!Array.isArray(links) || links.length === 0) return [];

            var promises = links.map(function(link) {
                if (!link.url) return Promise.resolve(null);

                var streamApiUrl = BASE_URL + '/web-vod/api/get?link=' + encodeURIComponent(link.url);

                return getFinalRedirect(streamApiUrl)
                    .then(function(finalUrl) {
                        var language = 'de';
                        if (link.languages && link.languages[0]) {
                            language = link.languages[0];
                        } else if (link.language) {
                            language = link.language;
                        }

                        var qualityTag = link.tag || 'HD';
                        var cleanUrl = normalizeVoeUrl(normalizeDoodUrl(finalUrl));
                        var hostDomain = extractDomain(cleanUrl);

                        return resolveDirectMediaUrl(cleanUrl, language).then(function(directUrl) {
                            return {
                                name: language.toUpperCase() + ' - ' + qualityTag,
                                title: '',
                                url: directUrl,
                                quality: qualityTag,
                                size: hostDomain,
                                headers: {
                                    'User-Agent': 'MediaUrl/2',
                                    'Referer': 'https://dood.li/'
                                },
                                provider: 'ohato'
                            };
                        });
                    })
                    .catch(function() { return null; });
            });

            return Promise.all(promises);
        })
        .then(function(results) {
            return results.filter(function(item) { return item !== null; });
        })
        .catch(function() { return []; });
}

function handleLokkeFlow(movieData) {
    return fetch(LOKKE_PING_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Lokke/1.0.2 (iPhone; CPU iPhone OS 18_7_7 like Mac OS X)'
        },
        body: JSON.stringify(getLokkeHandshakePayload())
    })
    .then(function(res) { return res.json(); })
    .then(function(lokkeResp) {
        var signature = lokkeResp && lokkeResp.addonSig;
        if (!signature) throw new Error('Missing Lokke Signature');

        var ohaHeaders = {
            'Content-Type': 'application/json',
            'mediaurl-signature': signature,
            'User-Agent': 'MediaUrl/2',
            'Accept-Language': 'de-DE,de;q=0.9',
            'Accept': '*/*'
        };

        var itemPayload = {
            language: movieData.language,
            region: movieData.region,
            type: movieData.type,
            ids: movieData.ids,
            name: movieData.name,
            episode: movieData.episode,
            clientVersion: movieData.clientVersion
        };

        return fetch(OHA_ITEM_URL, {
            method: 'POST',
            headers: ohaHeaders,
            body: JSON.stringify(itemPayload)
        })
        .then(function() {
            return fetch(OHA_SOURCE_URL, {
                method: 'POST',
                headers: ohaHeaders,
                body: JSON.stringify(movieData)
            });
        })
        .then(function(res) { return res.json(); })
        .then(function(finalData) {
            var candidates = Array.isArray(finalData) 
                ? finalData 
                : (finalData.streams || finalData.sources || finalData.items || []);

            var streamPromises = candidates.map(function(s) {
                var urlStr = s && (s.url || s.file || s.source || s.stream);
                if (!urlStr) return Promise.resolve(null);

                var language = 'de';
                if (s.languages && s.languages[0]) {
                    language = s.languages[0];
                } else if (s.language || s.lang) {
                    language = s.language || s.lang;
                } else if (movieData.language) {
                    language = movieData.language;
                }

                var qualityTag = s.tag || s.quality || 'HD';
                var cleanUrl = normalizeVoeUrl(normalizeDoodUrl(urlStr));
                var hostDomain = extractDomain(cleanUrl);

                return resolveDirectMediaUrl(cleanUrl, language).then(function(directUrl) {
                    return {
                        name: language.toUpperCase() + ' - ' + qualityTag,
                        title: '',
                        url: directUrl,
                        quality: qualityTag,
                        size: hostDomain,
                        headers: {
                            'User-Agent': 'MediaUrl/2',
                            'Referer': BASE_URL + '/'
                        },
                        provider: 'ohato'
                    };
                });
            });

            return Promise.all(streamPromises);
        })
        .then(function(resolvedStreams) {
            return resolvedStreams.filter(function(item) { return item !== null; });
        });
    })
    .catch(function() { return []; });
}

function getStreams(tmdbId, type, season, episode) {
    var isSeries = (type === 'series' || type === 'show' || type === 'tv');
    var ohaId = isSeries ? 'series.' + tmdbId + '.' + season + '.' + (episode || 1) : 'movie.' + tmdbId;
    var infoUrl = BASE_URL + '/web-vod/api/info?id=' + ohaId;

    return fetch(infoUrl, { headers: DEFAULT_HEADERS })
        .then(function(res) {
            if (!res.ok) return null;
            return res.json();
        })
        .then(function(vodData) {
            if (!vodData) {
                return handleLegacyLinksFlow(ohaId);
            }

            var dynamicMovieData = {
                language: 'de',
                region: 'CH',
                type: isSeries ? 'series' : 'movie',
                ids: {
                    tmdb_id: String(vodData.tmdb_id || vodData.tmdbId || tmdbId),
                    imdb_id: String(vodData.imdb_id || vodData.imdbId || '')
                },
                name: (vodData.name || vodData.title || 'Media Title'),
                originalName: vodData.original_name || vodData.originalTitle || vodData.name || vodData.title,
                releaseDate: vodData.release_date || vodData.releaseDate,
                nameTranslations: vodData.nameTranslations || { de: vodData.name || vodData.title },
                episode: isSeries ? {
                    ids: {
                        tmdb_episode_id:
                            (vodData.episode && (vodData.episode.tmdb_episode_id || vodData.episode.tmdbEpisodeId)) ||
                            vodData.tmdb_episode_id || vodData.tmdbEpisodeId || undefined
                    },
                    name: (vodData.episode && (vodData.episode.name || vodData.episode.title)) || undefined,
                    releaseDate: (vodData.episode && (vodData.episode.release_date || vodData.episode.releaseDate)) || undefined,
                    season: season,
                    episode: episode || 1
                } : {},
                clientVersion: '3.0.2'
            };

            return handleLokkeFlow(dynamicMovieData);
        })
        .catch(function(err) {
            console.log('[OHA.TO] Error: ' + err.message);
            return [];
        });
}

module.exports = { getStreams };
