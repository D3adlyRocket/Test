
"use strict";

const HDGHARTV_API = "https://hdghartv.cc";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
const BASE_HEADERS = {
  "User-Agent": UA,
  "Referer": HDGHARTV_API + "/"
};

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  const type = isSeries ? "series" : "movies";

  try {
    // 1. Fetch deep metadata from TMDB
    const endpoint = isSeries ? "tv" : "movie";
    const tmdbUrl = `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=external_ids`;
    const meta = await fetch(tmdbUrl).then(r => r.json()).catch(() => null);

    if (!meta) return [];

    const titleName = meta.title || meta.name || "Unknown Title";
    const releaseYear = meta.release_date 
      ? meta.release_date.split('-')[0] 
      : (meta.first_air_date ? meta.first_air_date.split('-')[0] : "2026");

    let runtimeStr = "N/A";
    if (!isSeries && meta.runtime) {
      runtimeStr = `${meta.runtime} min`;
    } else if (isSeries && meta.episode_run_time && meta.episode_run_time.length > 0) {
      runtimeStr = `${meta.episode_run_time[0]} min`;
    }

    // 2. Search HDGHARTV API for the corresponding media item
    const searchRes = await fetch(
      `${HDGHARTV_API}/api/search?q=${encodeURIComponent(titleName)}&type=all&page=1`,
      { headers: BASE_HEADERS }
    ).catch(() => null);

    if (!searchRes || !searchRes.ok) return [];
    const searchData = await searchRes.json().catch(() => null);
    if (!searchData) return [];

    const allItems = [...(searchData.movies || []), ...(searchData.series || [])];
    const matched = allItems.find(item => item.tmdbId === Number(tmdbId));
    if (!matched || !matched._id) return [];

    // 3. Fetch link details
    const detailsRes = await fetch(
      `${HDGHARTV_API}/api/${type}/public/${matched._id}`,
      { headers: BASE_HEADERS }
    ).catch(() => null);

    if (!detailsRes || !detailsRes.ok) return [];
    const details = await detailsRes.json().catch(() => null);
    if (!details) return [];

    let links = [];
    if (!isSeries) {
      links = details.streamingLinks || [];
    } else {
      const targetSeason = (details.seasons || []).find(s => s.seasonNumber === Number(season));
      if (!targetSeason) return [];
      const targetEpisode = (targetSeason.episodes || []).find(e => e.episodeNumber === Number(episode));
      if (!targetEpisode) return [];
      links = targetEpisode.streamingLinks || [];
    }

    const filteredStreams = [];

    // 4. Parse, filter, and apply the exact 4-line layout template
    for (const link of links) {
      if (!link || !link.url) continue;

      const rawTextCombined = `${link.quality || ""} ${link.name || ""} ${link.url}`.toLowerCase();

      // Filter: Keep only 4K (2160p), 1080p, and 720p
      const is4K = /\b(2160p|4k)\b/i.test(rawTextCombined);
      const is1080 = /\b(1080p)\b/i.test(rawTextCombined);
      const is720 = /\b(720p)\b/i.test(rawTextCombined);

      if (!is4K && !is1080 && !is720) continue;

      let resLabel = "1080p";
      let resEmoji = "🔥";
      let rank = 2;

      if (is4K) { 
        resLabel = "2160p"; 
        resEmoji = "💎"; 
        rank = 3;
      } else if (is720) { 
        resLabel = "720p"; 
        resEmoji = "🎬"; 
        rank = 1;
      }

      // Language tracking (Defaulting to Dual-Audio)
      let detectedLang = "Dual-Audio 🌐";
      if (/hindi|hin|🇮🇳/.test(rawTextCombined) && !/multi|dual/.test(rawTextCombined)) {
        detectedLang = "Hindi 🇮🇳";
      }

      // Codecs and stream format parsing
      const isM3U8 = link.url.includes(".m3u8");
      const formatStr = isM3U8 ? "HLS" : (/\b(mp4|avi|m4v)\b/.test(rawTextCombined) ? "MP4" : "MKV");
      const codecStr = /\b(hevc|x265|h265)\b/.test(rawTextCombined) ? "x.265" : "x.264";
      const streamTech = isM3U8 ? "HLS" : "Direct";
      const audioCodec = /\b(ddp|dd\+|eac3|dolby)\b/.test(rawTextCombined) ? "E-AC3" : /\b(ac3|dolby)\b/.test(rawTextCombined) ? "AC3" : "AAC";

      // Build identical 4-line layout
      const subLine1 = isSeries 
        ? `🎦 ${titleName} - (${releaseYear}) | S${season || 1}E${episode || 1}`
        : `🎦 ${titleName} - (${releaseYear})`;

      const layoutDescription = 
        `${subLine1}\n` +
        `${resEmoji} ${resLabel} | 🔊 ${detectedLang} | ⏳ ${runtimeStr}\n` +
        `⚡ ${formatStr} | 🎥 ${codecStr} • ${streamTech} | 🎧 ${audioCodec}\n` +
        `🛰️ Source: HDGharTV`;

      filteredStreams.push({
        rank: rank,
        name: `HDGharTV | ${resLabel} | Dual-Audio`,
        title: layoutDescription,
        description: layoutDescription,
        size: layoutDescription,
        url: link.url,
        headers: BASE_HEADERS,
        behaviorHints: {
          notSupported: false,
          proxyHeaders: {
            request: BASE_HEADERS
          }
        }
      });
    }

    // Sort High to Low quality (2160p -> 1080p -> 720p)
    filteredStreams.sort((a, b) => b.rank - a.rank);
    return filteredStreams.map(({ rank, ...cleanStream }) => cleanStream);

  } catch (err) {
    console.error("Failed to construct layout from HDGHARTV endpoint:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
