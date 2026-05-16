/**
 * Pomfy - Surgical Fix (Nuvio Layout Edition) - SAFE PATCH
 */

// ---------------- UTIL ----------------
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var step = (x) => x.done
      ? resolve(x.value)
      : Promise.resolve(x.value).then(
          v => step(generator.next(v)),
          e => step(generator.throw(e))
        );
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// ---------------- CONSTANTS ----------------
const TMDB_KEY = '3644dd4950b67cd8067b8772de576d6b';
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const API_POMFY = "https://api.pomfy.stream";

const COOKIE =
"SITE_TOTAL_ID=aTYqe6GU65PNmeCXpelwJwAAAMi; __dtsu=104017651574995957BEB724C6373F9E; __cc_id=a44d1e52993b9c2Oaaf40eba24989a06";

const USER_AGENT =
"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

const HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "Referer": "https://pomfy.online/",
  "Cookie": COOKIE
};

// ---------------- TMDB ----------------
async function getTmdbMetadata(tmdbId, type) {
  try {
    const url =
      `${TMDB_BASE_URL}/${type === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`;

    const res = await fetch(url);
    const data = await res.json();

    const date = data.release_date || data.first_air_date || "";

    let duration = "N/A";
    if (type === "movie" && data.runtime) duration = `${data.runtime} min`;
    if (type === "tv" && data.episode_run_time?.length)
      duration = `${data.episode_run_time[0]} min`;

    return {
      name: data.title || data.name || "Pomfy",
      year: date ? date.split("-")[0] : "",
      duration
    };
  } catch {
    return { name: "Pomfy", year: "", duration: "N/A" };
  }
}

// ---------------- TITLE ----------------
function buildTitle(meta, res, lang, format, size, season, episode) {
  const qIcon = res.includes("1080") ? "📺" : "💎";
  const lIcon = "🌍";

  let line1 = "🎬 ";

  if (season && episode) {
    line1 += `S${season} E${episode} | ${meta.name}`;
  } else {
    line1 += `${meta.name}${meta.year ? ` (${meta.year})` : ""}`;
  }

  const line2 = [
    `${qIcon} ${res}`,
    `${lIcon} ${lang}`,
    `💾 ${size || "Variable Size"}`
  ].join(" | ");

  const line3 =
    `🎞️ ${(format || "M3U8").toUpperCase()} | ⏱️ ${meta.duration} | ⚡ Adaptive`;

  return `${line1}\n${line2}\n${line3}`;
}

// ---------------- ENCRYPTION (UNCHANGED) ----------------
// (KEEP YOUR ORIGINAL AES SECTION EXACTLY AS YOU HAD IT)
// IMPORTANT: I am NOT modifying it to avoid breaking streams.

// ---------------- STREAMS ----------------
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  let finalTmdbId = tmdbId;

  try {
    // IMDB conversion
    if (typeof tmdbId === "string" && tmdbId.startsWith("tt")) {
      const url =
        `${TMDB_BASE_URL}/find/${tmdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`;

      const r = await fetch(url);
      const d = await r.json();

      const results =
        mediaType === "tv" ? d.tv_results : d.movie_results;

      if (results?.length) finalTmdbId = results[0].id;
    }

    const s = mediaType === "movie" ? 1 : (season || 1);
    const e = mediaType === "movie" ? 1 : (episode || 1);

    const pomfyUrl =
      mediaType === "movie"
        ? `${API_POMFY}/filme/${finalTmdbId}`
        : `${API_POMFY}/serie/${finalTmdbId}/${s}/${e}`;

    const response = await fetch(pomfyUrl, { headers: HEADERS });
    if (!response.ok) return [];

    const html = await response.text();

    // 🔥 SAFE DEBUG (DO NOT REMOVE)
    console.log("Pomfy:", pomfyUrl);
    console.log("HTML length:", html.length);

    if (!html || html.length < 300) return [];

    // ---------------- FIXED LINK MATCH ----------------
    let linkMatch =
      html.match(/const\s+link\s*=\s*"([^"]+)"/) ||
      html.match(/"link"\s*:\s*"([^"]+)"/) ||
      html.match(/link\s*=\s*'([^']+)'/) ||
      html.match(/https?:\/\/[^"' ]*byse[^"' ]+/);

    if (!linkMatch) {
      console.log("❌ LINK NOT FOUND");
      return [];
    }

    const byseUrl = linkMatch[1] || linkMatch[0];
    const byseId = byseUrl.split("/").pop();

    const detailsResponse = await fetch(
      `https://pomfy-cdn.shop/api/videos/${byseId}/embed/details`,
      {
        headers: {
          "accept": "*/*",
          "referer": byseUrl,
          "x-embed-origin": "api.pomfy.stream",
          "x-embed-parent": byseUrl,
          "user-agent": USER_AGENT,
          "Cookie": COOKIE
        }
      }
    );

    if (!detailsResponse.ok) return [];

    const detailsData = await detailsResponse.json();
    const embedUrl = detailsData?.embed_frame_url;

    if (!embedUrl || !embedUrl.startsWith("http")) {
      console.log("❌ BAD EMBED URL");
      return [];
    }

    const embedDomain = new URL(embedUrl).origin;

    const playbackResponse = await fetch(
      `${embedDomain}/api/videos/${byseId}/embed/playback`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "origin": embedDomain,
          "referer": embedUrl,
          "x-embed-origin": "api.pomfy.stream",
          "x-embed-parent": byseUrl,
          "user-agent": USER_AGENT
        },
        body: JSON.stringify({
          fingerprint: {
            viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a",
            device_id: "b69c7e41fe010d4445b827dd95aa89fc",
            confidence: 0.93
          }
        })
      }
    );

    if (!playbackResponse.ok) return [];

    const playbackData = await playbackResponse.json();

    const decryptResult = decryptPlayback(playbackData.playback);
    if (!decryptResult.success) return [];

    const meta = await getTmdbMetadata(finalTmdbId, mediaType);

    const resLabel =
      decryptResult.url.includes("1080") ? "1080p" :
      decryptResult.url.includes("720") ? "720p" :
      "Auto";

    const size = await getM3U8Size(decryptResult.url, meta.duration);

    streams.push({
      name: `Pomfy | ${resLabel}`,
      title: buildTitle(meta, resLabel, "EN", "m3u8", size, season, episode),
      url: decryptResult.url,
      quality: resLabel.includes("1080") ? 1080 : 720,
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": embedUrl
      }
    });

    return streams;

  } catch (e) {
    console.log("Stream error:", e);
    return [];
  }
}

// ---------------- EXPORT ----------------
module.exports = { getStreams };
