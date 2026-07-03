"use strict";

const PROVIDER_NAME = "AnikotoTV"; 
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c"; 
const TVDB_API_KEY = "777140fb-de92-440a-aec2-95eb51e2d7ab"; 

const MOBILE_UAS = [ 
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36", 
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36", 
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36", 
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" 
]; 

function getHeaders(extra) { 
  var ua = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)]; 
  var h = { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" }; 
  if (extra) { for (var k in extra) { h[k] = extra[k]; } } 
  return h; 
} 

var _tvdbToken = null; 
async function getTvdbToken() { 
  if (_tvdbToken) return _tvdbToken; 
  try { 
    var res = await fetch("https://api4.thetvdb.com/v4/login", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ apikey: TVDB_API_KEY }) 
    }); 
    if (res.ok) { 
      var data = await res.json(); 
      if (data && data.data && data.data.token) _tvdbToken = data.data.token; 
    } 
  } catch (e) {} 
  return _tvdbToken; 
} 

async function getTMDBDetails(tmdbId, mediaType, season, episode) {
  const type = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
  let url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
  
  if (String(tmdbId).startsWith("tt")) {
    url = `https://api.themoviedb.org/3/find/${tmdbId}?external_source=imdb_id&api_key=${TMDB_API_KEY}`;
  }

  try {
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return { title: "Anime Title", year: "2026", epTitle: `Episode ${episode}`, duration: "24 min" };
    const data = await res.json();
    
    let target = data;
    if (String(tmdbId).startsWith("tt")) {
      target = type === 'tv' ? data.tv_results?.[0] : data.movie_results?.[0];
    }
    if (!target) return { title: "Anime Title", year: "2026", epTitle: `Episode ${episode}`, duration: "24 min" };

    const title = type === 'tv' ? target.name : target.title;
    const dateStr = target.release_date || target.first_air_date || "";
    const year = dateStr ? dateStr.split("-")[0] : "2026";
    
    let epTitle = `Episode ${episode}`;
    let duration = "24 min";
    
    if (type === 'tv' && target.id && season && episode) {
      try {
        const epUrl = `https://api.themoviedb.org/3/tv/${target.id}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
        const epRes = await fetch(epUrl, { headers: getHeaders() });
        if (epRes.ok) {
          const epData = await epRes.json();
          if (epData.name) epTitle = epData.name;
          if (epData.runtime) duration = `${epData.runtime} min`;
        }
      } catch (e) {}
    } else if (type === 'movie' && target.runtime) {
      duration = `${target.runtime} min`;
    }

    return { title, year, epTitle, duration };
  } catch (e) {
    return { title: "Anime Title", year: "2026", epTitle: `Episode ${episode}`, duration: "24 min" };
  }
}

async function getTMDBTitle(tmdbId, mediaType) {
  const data = await getTMDBDetails(tmdbId, mediaType);
  return { title: data.title, numericId: tmdbId };
}

async function getTMDBSeasonName(tmdbId, season) {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_API_KEY}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return data.name;
    }
  } catch (e) {}
  return null;
}

async function aniListBridge(title) {
  const query = ` query ($search: String) { Media (search: $search, type: ANIME) { id idMal } } `;
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: Object.assign(getHeaders(), { "Content-Type": "application/json", "Accept": "application/json" }),
      body: JSON.stringify({ query: query, variables: { search: title } })
    });
    const data = await res.json();
    if (data && data.data && data.data.Media) {
      return { malId: data.data.Media.idMal, aniId: data.data.Media.id, absEp: null };
    }
  } catch (e) {}
  return null;
}

async function getMalId(tmdbId, mediaType, season, episode) {
  try {
    let url = `https://arm.haglund.dev/api/v2/tmdb?id=${tmdbId}`;
    if (mediaType === 'tv' || mediaType === 'series') url += `&s=${season}&e=${episode}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.mal || data.mal_id || data.anilist || data.ani_id) {
        return { malId: data.mal || data.mal_id, aniId: data.anilist || data.ani_id, absEp: data.episode || episode };
      }
    }
  } catch (e) {}

  const tmdbData = await getTMDBTitle(tmdbId, mediaType);
  let searchTitle = tmdbData.title;
  const numericTmdbId = tmdbData.numericId;
  if (searchTitle) {
    let originalSearchTitle = searchTitle;
    if ((mediaType === 'tv' || mediaType === 'series') && season > 1 && numericTmdbId) {
      const seasonName = await getTMDBSeasonName(numericTmdbId, season);
      if (seasonName) {
        if (seasonName.toLowerCase().includes(searchTitle.toLowerCase())) {
          searchTitle = seasonName;
        } else {
          searchTitle = `${searchTitle} ${seasonName}`;
        }
      } else {
        searchTitle = `${searchTitle} Season ${season}`;
      }
    }
    let mapping = await aniListBridge(searchTitle);
    let usedFallback = false;
    if ((!mapping || (mapping && !mapping.malId)) && searchTitle !== originalSearchTitle) {
      mapping = await aniListBridge(originalSearchTitle);
      usedFallback = true;
    }
    if (mapping) {
      mapping.absEp = episode;
      mapping.usedFallback = usedFallback;
      mapping.name = tmdbData.title;
      return mapping;
    }
  }
  return null;
}

async function extractHLS(embedUrl, domain) {
  try {
    const hdrs = Object.assign(getHeaders(), { "Referer": `https://${domain}/` });
    const res = await fetch(embedUrl, { headers: hdrs });
    if (!res.ok) return null;
    const html = await res.text();
    let match = html.match(/data-id="(\d+)"/);
    if (!match) {
      const iframeMatch = html.match(/<iframe[^>]*src="([^"]+)"/);
      if (iframeMatch) {
        const iframeUrl = iframeMatch[1].startsWith('http') ? iframeMatch[1] : `https://${domain}${iframeMatch[1]}`;
        const iframeRes = await fetch(iframeUrl, { headers: hdrs });
        if (iframeRes.ok) {
          const iframeHtml = await iframeRes.text();
          match = iframeHtml.match(/data-id="(\d+)"/);
        }
      }
    }
    if (!match) return null;
    const dataId = match[1];
    const sourceUrl = `https://${domain}/stream/getSources?id=${dataId}`;
    const sourceRes = await fetch(sourceUrl, { headers: Object.assign(getHeaders(), { "X-Requested-With": "XMLHttpRequest", "Referer": embedUrl }) });
    if (!sourceRes.ok) return null;
    const json = await sourceRes.json();
    if (json.sources && json.sources.file) {
      const subtitles = [];
      if (json.tracks) {
        for (const track of json.tracks) {
          if (track.kind === "captions" || track.kind === "subtitles") {
            subtitles.push({ id: track.label || track.file || "Unknown", url: track.file, language: 'eng' });
          }
        }
      }
      var quality = "1080p";
      try {
        const m3u8Res = await fetch(json.sources.file, { headers: { "Referer": `https://${domain}/` } });
        if (m3u8Res.ok) {
          const m3u8Text = await m3u8Res.text();
          var qMatch = m3u8Text.match(/RESOLUTION=\d+x(\d+)/);
          if (qMatch) quality = qMatch[1] + "p";
        }
      } catch (e) {}
      return { url: json.sources.file, quality: quality, subtitles: subtitles, headers: { "Referer": `https://${domain}/`, "Origin": `https://${domain}` } };
    }
  } catch (e) {}
  return null;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) return null;
  return await res.json();
}

async function getAbsoluteEpisode(tmdbId, mediaType, season, episode, seriesName) {
  if (mediaType === 'movie') return 1;
  let absEp = episode;
  let imdbId = null;
  let tvdbId = null;
  try {
    const extRes = await fetchJson(`https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
    if (extRes) {
      imdbId = extRes.imdb_id;
      tvdbId = extRes.tvdb_id;
    }
  } catch (e) {}
  if (!tvdbId && seriesName) {
    try {
      const tvdbToken = await getTvdbToken();
      if (tvdbToken) {
        const searchRes = await fetchJson(`https://api4.thetvdb.com/v4/search?query=${encodeURIComponent(seriesName)}`, { headers: { 'Authorization': 'Bearer ' + tvdbToken } });
        if (searchRes && searchRes.data) {
          const match = searchRes.data.find(s => s.type === 'series');
          if (match) {
            const idStr = match.id || match.tvdb_id;
            if (idStr) tvdbId = parseInt(String(idStr).replace(/^series-/, ''), 10);
          }
        }
      }
    } catch (e) {}
  }
  if (tvdbId) {
    try {
      const tvdbToken = await getTvdbToken();
      if (tvdbToken) {
        const epRes = await fetchJson(`https://api4.thetvdb.com/v4/series/${tvdbId}/episodes/default?season=${season}`, { headers: { 'Authorization': 'Bearer ' + tvdbToken } });
        if (epRes && epRes.data && epRes.data.episodes) {
          const matchedEp = epRes.data.episodes.find(e => e.seasonNumber == season && e.number == episode);
          if (matchedEp && matchedEp.absoluteNumber) return matchedEp.absoluteNumber;
        }
      }
    } catch(e) {}
  }
  if (imdbId) {
    try {
      const cineUrl = `https://aiometadata.elfhosted.com/stremio/80d082c4-6e99-4c97-a67d-3d9e242685ce/meta/series/${imdbId}.json`;
      const cineRes = await fetch(cineUrl);
      if (cineRes.ok) {
        const txt = await cineRes.text();
        let previousSeasonsCount = 0;
        let foundSeasons = false;
        const regex = /"season"\s*:\s*(\d+)/g;
        let match;
        while ((match = regex.exec(txt)) !== null) {
          foundSeasons = true;
          const s = parseInt(match[1]);
          if (s > 0 && s < season) previousSeasonsCount++;
        }
        if (foundSeasons) return previousSeasonsCount + episode;
      }
    } catch(e) {}
  }
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const res = await fetchJson(tmdbUrl, {});
    if (res && res.seasons) {
      let calculatedAbs = 0;
      const validSeasons = res.seasons.filter(s => s.season_number > 0 && s.season_number < season);
      for (let s of validSeasons) { calculatedAbs += s.episode_count; }
      calculatedAbs += episode;
      return calculatedAbs;
    }
  } catch (e) {}
  return absEp;
}

// ======================================
// MAIN PROCESSING PRESENTATION LAYER
// ======================================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const mapping = await getMalId(tmdbId, mediaType, season, episode);
    if (!mapping || (!mapping.malId && !mapping.aniId)) return [];

    const isMal = !!mapping.malId;
    const targetId = isMal ? mapping.malId : mapping.aniId;
    const idType = isMal ? 'mal' : 'ani';
    
    let epNum = mediaType === 'movie' ? 1 : mapping.absEp;
    if (mediaType !== 'movie' && mapping.usedFallback && season > 1) {
      epNum = await getAbsoluteEpisode(tmdbId, mediaType, season, episode, mapping.name);
    }

    const metaDetails = await getTMDBDetails(tmdbId, mediaType, season, episode);

    const streams = [];
    const domains = [ { id: "Vidstream", domain: "megaplay.buzz" } ];

    for (const srv of domains) {
      const fetchTypes = ['sub', 'dub'];
      for (const type of fetchTypes) {
        const streamUrl = `https://${srv.domain}/stream/${idType}/${targetId}/${epNum}/${type}`;
        const data = await extractHLS(streamUrl, srv.domain);
        
        if (data) {
          const matchedQuality = (data.quality || "1080p").toUpperCase();
          
          // Generate your conditional Line 3 dynamic strings explicitly
          const displayLang = type === "sub" ? "🇯🇵 Japanese" : "🇺🇲 English";
          const displayAudioType = type === "sub" ? "SUB" : "DUB";
          const cleanLangHeader = type === "sub" ? "Japanese (SUB)" : "English (DUB)";
          
          const formatType = data.url.includes(".m3u8") ? "HLS" : "M3U8";

          // ==========================================
          // CUSTOM MULTI-LINE MOBILE COMPATIBLE PRESENTATION
          // ==========================================
          // Top bold header title card
          const headerText = `${PROVIDER_NAME} | ${matchedQuality} | (${cleanLangHeader})`;

          // Subheading Line 1
          const line1 = `🎦 ${metaDetails.title} - (${metaDetails.year})`;

          // Subheading Line 2
          const line2 = mediaType === 'movie' 
            ? `🎬 Movie Presentation`
            : `🎬 S${season || 1} E${episode || 1} - ${metaDetails.epTitle}`;

          // Subheading Line 3 (Refactored String Structure)
          const line3 = `✨ ${matchedQuality} | ${displayLang} • 🗣️ ${displayAudioType}`;

          // Subheading Line 4 (Updated duration icon to ⏳)
          const line4 = `⚡ ${formatType} | ⏳ ${metaDetails.duration} | 🔗 ${srv.id}`;

          const fullLayout = `${line1}\n${line2}\n${line3}\n${line4}`;

          streams.push({
            name: headerText,
            title: fullLayout,
            size: fullLayout, 
            description: fullLayout,
            url: data.url,
            subtitles: data.subtitles,
            headers: data.headers
          });
        }
      }
    }
    return streams;
  } catch (e) {
    return [];
  }
}

async function search(args) { return []; }
async function getCatalog(args) { return []; }
async function getItemDetails(args) { return []; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams, search, getCatalog, getItemDetails };
} else {
  global.getStreams = getStreams;
}
