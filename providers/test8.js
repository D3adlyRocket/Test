/**
 * Provider: LaMovie para Nuvio
 * Versión: 2.0.4
 * Idioma: Español Latino
 */

const BASE_URL = "https://lamovie.org";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HEADERS_JSON = {
  "User-Agent": USER_AGENT,
  "Accept": "application/json"
};

const HEADERS_HTML = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9"
};

async function request(url, isJson = true) {
  const response = await fetch(url, {
    headers: isJson ? HEADERS_JSON : HEADERS_HTML,
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${url}`);
  }

  return isJson ? response.json() : response.text();
}

function normalizeSlug(text, year) {
  if (!text) return "";
  const clean = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return year ? `${clean}-${year}` : clean;
}

function getServerName(url) {
  if (url.includes("goodstream")) return "GoodStream";
  if (url.includes("hlswish") || url.includes("streamwish")) return "StreamWish";
  if (url.includes("voe.sx") || url.includes("cloudwindow")) return "VOE";
  return "Latino Server";
}

async function resolveGoodStream(embedUrl) {
  try {
    const html = await request(embedUrl, false);
    const match = html.match(/file:\s*"([^"]+)"/);
    if (!match) return null;

    return {
      url: match[1],
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": "https://goodstream.one/",
        "Origin": "https://goodstream.one"
      }
    };
  } catch (e) {
    return null;
  }
}

async function resolveVOE(embedUrl) {
  try {
    let html = await request(embedUrl, false);
    if (/permanentToken/i.test(html)) {
      const redirectMatch = html.match(/window\.location\.href\s*=\s*'([^']+)'/i);
      if (redirectMatch) {
        html = await request(redirectMatch[1], false);
      }
    }

    const match = html.match(/(?:mp4|hls)["']\s*:\s*["']([^"']+)["']/i);
    if (!match) return null;

    let streamUrl = match[1];
    if (streamUrl.startsWith("aHR0")) {
      try { streamUrl = atob(streamUrl); } catch (e) {}
    }

    return {
      url: streamUrl,
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": embedUrl
      }
    };
  } catch (e) {
    return null;
  }
}

async function getTMDBInfo(tmdbId, type) {
  try {
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    const data = await request(url, true);

    return {
      title: type === "movie" ? data.title : data.name,
      originalTitle: type === "movie" ? data.original_title : data.original_name,
      year: (data.release_date || data.first_air_date || "").substring(0, 4)
    };
  } catch (err) {
    return null;
  }
}

async function findPostId(info, type) {
  const category = type === "movie" ? "peliculas" : "series";
  const slugs = [
    normalizeSlug(info.title, info.year),
    normalizeSlug(info.originalTitle, info.year),
    normalizeSlug(info.title),
    normalizeSlug(info.originalTitle)
  ].filter(Boolean);

  const uniqueSlugs = [...new Set(slugs)];

  for (const slug of uniqueSlugs) {
    try {
      const pageUrl = `${BASE_URL}/${category}/${slug}/`;
      const html = await request(pageUrl, false);
      const match = html.match(/rel=['"]shortlink['"]\s+href=['"][^'"]*\?p=(\d+)['"]/);
      if (match) return match[1];
    } catch (e) {}
  }
  return null;
}

async function findEpisodePostId(seriesPostId, season, episode) {
  try {
    const apiUrl = `${BASE_URL}/wp-api/v1/single/episodes/list?_id=${seriesPostId}&season=${season}&page=1&postsPerPage=50`;
    const response = await request(apiUrl, true);
    if (response?.data?.posts) {
      const match = response.data.posts.find((p) => p.season_number == season && p.episode_number == episode);
      return match?._id || null;
    }
  } catch (e) {
    return null;
  }
  return null;
}

async function processEmbed(embed) {
  const embedUrl = embed.url || "";
  let resolved = null;

  if (embedUrl.includes("goodstream")) {
    resolved = await resolveGoodStream(embedUrl);
  } else if (embedUrl.includes("voe")) {
    resolved = await resolveVOE(embedUrl);
  }

  if (!resolved || !resolved.url) return null;

  const serverName = getServerName(embedUrl);
  const isHls = resolved.url.includes(".m3u8");

  // Estructura completa compatible con reproductores nativos de Nuvio
  return {
    name: "LaMovie",
    title: `HD · ${serverName}`,
    type: isHls ? "hls" : "url",
    streamType: isHls ? "hls" : "url",
    url: resolved.url,
    quality: "720p",
    headers: resolved.headers || {},
    behaviorHints: {
      notStreaming: false,
      proxyHeaders: {
        request: resolved.headers || {}
      }
    }
  };
}

async function getStreams(tmdbId, type, season, episode) {
  if (!tmdbId || !type) return [];

  try {
    const info = await getTMDBInfo(tmdbId, type);
    if (!info) return [];

    let postId = await findPostId(info, type);
    if (!postId) return [];

    if (type === "tv" && season && episode) {
      postId = await findEpisodePostId(postId, season, episode);
      if (!postId) return [];
    }

    const playerData = await request(`${BASE_URL}/wp-api/v1/player?postId=${postId}&demo=0`, true);
    if (!playerData?.data?.embeds) return [];

    const promises = playerData.data.embeds.map((embed) => processEmbed(embed));
    const results = await Promise.allSettled(promises);

    return results
      .filter((res) => res.status === "fulfilled" && res.value !== null)
      .map((res) => res.value);

  } catch (error) {
    return [];
  }
}

module.exports = {
  getStreams
};
