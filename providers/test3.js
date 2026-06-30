"use strict";

// Settings Layout for Nuvio Local Scrapers
async function onSettings() {
    return [
        { type: "header", label: "Premium Credentials" },
        { type: "input", key: "premiumEmail", label: "Account Email", defaultValue: "" },
        { type: "input", key: "premiumPassword", label: "Account Password", defaultValue: "" },
        { type: "header", label: "Language Preferences" },
        { type: "toggle", key: "langHindi", label: "Enable Hindi 🇮🇳", defaultValue: true },
        { type: "toggle", key: "langTamil", label: "Enable Tamil 🇮🇳", defaultValue: true },
        { type: "toggle", key: "langTelugu", label: "Enable Telugu 🇮🇳", defaultValue: true },
        { type: "toggle", key: "langMalayalam", label: "Enable Malayalam 🇮🇳", defaultValue: true },
        { type: "toggle", key: "langKannada", label: "Enable Kannada 🇮🇳", defaultValue: true },
        { type: "toggle", key: "langBengali", label: "Enable Bengali 🇮🇳", defaultValue: true }
    ];
}

const EINTHUSAN_BASE = "https://einthusan.asaddon.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";
const PROVIDER_NAME = "Einthusan";

const LANGUAGES = {
  langHindi: { path: "hindi", label: "Hindi 🇮🇳", webCode: "hindi" },
  langTamil: { path: "tamil", label: "Tamil 🇮🇳", webCode: "tamil" },
  langTelugu: { path: "telugu", label: "Telugu 🇮🇳", webCode: "telugu" },
  langMalayalam: { path: "malayalam", label: "Malayalam 🇮🇳", webCode: "malayalam" },
  langKannada: { path: "kannada", label: "Kannada 🇮🇳", webCode: "kannada" },
  langBengali: { path: "bengali", label: "Bengali 🇮🇳", webCode: "bengali" }
};

// Strict display ordering layout rules for UI ingestion 
const LANGUAGE_ORDER = ["hindi", "tamil", "telugu", "malayalam", "kannada", "bengali"];

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};

const sessionCache = {};

function getSession(email) {
  const session = sessionCache[`session_${email}`];
  if (!session) return null;
  if (Date.now() - session.createdAt > 2.5 * 60 * 60 * 1000) {
    delete sessionCache[`session_${email}`];
    return null;
  }
  return session.cookieString;
}

function parseAndCombineCookies(existingCookieStr, setCookieHeaders) {
  if (!setCookieHeaders) return existingCookieStr;
  const cookies = {};
  
  if (existingCookieStr) {
    existingCookieStr.split(';').forEach(c => {
      const parts = c.split('=');
      if (parts[0]) cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    });
  }

  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  headers.forEach(header => {
    header.split(',').forEach(individual => {
      const cleanParts = individual.split(';')[0].split('=');
      if (cleanParts[0] && cleanParts[1]) {
        cookies[cleanParts[0].trim()] = cleanParts.slice(1).join('=').trim();
      }
    });
  });

  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function loginAndGetCookies(email, password, langWebCode) {
  if (!email || !password) return "";
  
  const cachedCookie = getSession(email);
  if (cachedCookie) return cachedCookie;

  try {
    const loginUrl = `https://einthusan.tv/account/login/?lang=${langWebCode}`;
    const initRes = await fetch(loginUrl, { headers: DEFAULT_HEADERS });
    const html = await initRes.text();
    
    const csrfMatch = html.match(/name="(?:csrfmiddlewaretoken|_token)"\s+value="([^"]+)"/) || html.match(/value="([^"]+)"\s+name="(?:csrfmiddlewaretoken|_token)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : "";
    
    const setCookieField = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : initRes.headers.get("set-cookie");
    let currentCookies = parseAndCombineCookies("", setCookieField);

    const bodyParams = new URLSearchParams({
      csrfmiddlewaretoken: csrfToken,
      email: email,
      password: password,
      next: '/'
    });

    const loginRes = await fetch(loginUrl, {
      method: "POST",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": currentCookies,
        "Referer": loginUrl
      },
      body: bodyParams.toString(),
      redirect: "manual"
    });

    const postCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : loginRes.headers.get("set-cookie");
    currentCookies = parseAndCombineCookies(currentCookies, postCookies);

    if (!currentCookies.includes("sid=")) {
      return "";
    }

    sessionCache[`session_${email}`] = { cookieString: currentCookies, createdAt: Date.now() };
    return currentCookies;
  } catch (err) {
    return "";
  }
}

async function scrapePremiumTokens(contentId, langWebCode, isSeries, cookieStr) {
  try {
    const typePath = isSeries ? "serial" : "movie";
    const watchPageUrl = `https://einthusan.tv/${cookieStr ? 'premium/' : ''}${typePath}/watch/${contentId}/?lang=${langWebCode || "hindi"}&uhd=true`;

    const headers = { ...DEFAULT_HEADERS, "Referer": "https://einthusan.tv/" };
    if (cookieStr) headers["Cookie"] = cookieStr;

    const response = await fetch(watchPageUrl, { headers });
    if (!response.ok) return null;

    const html = await response.text();
    
    const m3u8AttrRegex = /data-m3u8=["']([^"']*\.mp4(?:\.m3u8)?\?[^"']+)["']/;
    const m3u8Match = html.match(m3u8AttrRegex);
    if (m3u8Match && m3u8Match[1]) {
      const sanitized = m3u8Match[1].replace(/&amp;/g, "&");
      const paramMatch = sanitized.match(/[?&](e=\d+&md5=[a-zA-Z0-9_=-]+)/);
      if (paramMatch) return paramMatch[1];
    }
    
    const anyTokenRegex = /content\/[DB][^.]+\.mp4(?:\.m3u8)?\?(e=\d+&amp;md5=[a-zA-Z0-9_=-]+)/;
    const generalMatch = html.match(anyTokenRegex);
    if (generalMatch) {
      return generalMatch[1].replace(/&amp;/g, "&");
    }
  } catch (err) {
    console.error("Token structural parsing error:", err);
  }
  return null;
}

async function getTmdbMeta(tmdbId, mediaType) {
  const type = mediaType === "tv" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");
const isProxyUrl = (url) => String(url ?? "").includes("workers.dev") || /[?&]url=/.test(String(url ?? ""));

async function resolveProxyUrl(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { ...DEFAULT_HEADERS, "Referer": url },
    });
    const finalUrl = response.url;
    if ([".m3u8", ".mp4", ".mkv"].some((ext) => finalUrl.includes(ext))) return finalUrl;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/plain")) return (await response.text()).trim();
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return data?.url ?? data?.stream ?? data?.src ?? null;
    }
    return finalUrl;
  } catch {
    return null;
  }
}

async function fetchStreams(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.streams)) return [];
    return data.streams.filter((item) => typeof item?.url === "string" && item.url.startsWith("https"));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// MASTER ROUTER & STREAM GENERATOR
// ─────────────────────────────────────────────────────────────
async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === "tv" || mediaType === "series" || season != null || episode != null;
  const s = season ?? 1;
  const e = episode ?? 1;

  try {
    const settings = globalThis.SCRAPER_SETTINGS || {};
    const allowedLanguages = Object.entries(LANGUAGES).filter(([key]) => settings[key] !== false);

    const meta = await getTmdbMeta(tmdbId, isSeries ? "tv" : "movie");
    const movieTitle = meta ? (meta.title || meta.name) : "Movie";
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    const email = settings.premiumEmail || "";
    const password = settings.premiumPassword || "";
    const result = [];

    await Promise.all(
      allowedLanguages.map(async ([_, langConfig]) => {
        const sessionCookieStr = await loginAndGetCookies(email, password, langWebCode);

        let rawStreams = [];
        const endpointBase = `${EINTHUSAN_BASE}/${langConfig.path}`;
        if (!isSeries) {
          rawStreams = await fetchStreams(`${endpointBase}/stream/movie/${imdbId}.json`);
        } else {
          rawStreams = await fetchStreams(`${endpointBase}/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`);
        }

        for (const item of rawStreams) {
          if (!item?.url || item.externalUrl || String(item.url).includes("github.com")) continue;

          let baseStreamUrl = isProxyUrl(item.url) ? await resolveProxyUrl(item.url) : item.url;
          if (!baseStreamUrl) continue;

          const idMatch = baseStreamUrl.match(/\/content\/[DB]([^.]+)\.mp4/);
          if (!idMatch) continue;
          const contentId = idMatch[1];

          let tokenString = "";
          if (sessionCookieStr) {
            tokenString = await scrapePremiumTokens(contentId, langConfig.webCode, isSeries, sessionCookieStr);
          }

          if (!tokenString) {
            const fallbackParams = baseStreamUrl.split("?")[1];
            tokenString = fallbackParams ? fallbackParams.replace(/&amp;/g, "&") : "";
          }

          // FIX 1: cdn1Url uses track 'D' for working 720p playback, cdn2Url targets 'B' for 1080p UHD
          const cdn1Url = `https://cdn1.einthusan.io/etv/content/D${contentId}.mp4?${tokenString}`;
          const cdn2Url = `https://cdn2.einthusan.io/etv/content/B${contentId}.mp4?${tokenString}`;

          const isHindi = langConfig.webCode === "hindi";

          if (isHindi) {
            let finalUhdUrl = cdn2Url;
            try {
              const testRes = await fetch(cdn2Url, { method: 'HEAD', headers: DEFAULT_HEADERS });
              if (!testRes.ok) {
                finalUhdUrl = cdn1Url; 
              }
            } catch (e) {
              finalUhdUrl = cdn1Url; 
            }

            const uhdLayout = `🎦 ${movieTitle}\n💎 1080p Ultra HD | 🗣️ ${langConfig.label}\n🎞️ MP4 (CDN2 Routing) | 🔗 ${PROVIDER_NAME}`;
            result.push({
              name: `${PROVIDER_NAME} | 1080p UHD`,
              title: uhdLayout,
              url: finalUhdUrl,
              langKey: langConfig.webCode, // Attached for prioritization sorting logic
              behaviorHints: item.behaviorHints ?? {}
            });
          }

          const hdLayout = `🎦 ${movieTitle}\n💎 720p HD | 🗣️ ${langConfig.label}\n🎞️ MP4 (CDN1 Routing) | 🔗 ${PROVIDER_NAME}`;
          result.push({
            name: `${PROVIDER_NAME} | 720p HD`,
            title: hdLayout,
            url: cdn1Url,
            langKey: langConfig.webCode, // Attached for prioritization sorting logic
            behaviorHints: item.behaviorHints ?? {}
          });
        }
      })
    );

    // FIX 2: Explicit language mapping filter sort engine
    return result.sort((a, b) => {
      const indexA = LANGUAGE_ORDER.indexOf(a.langKey);
      const indexB = LANGUAGE_ORDER.indexOf(b.langKey);
      
      const weightA = indexA === -1 ? 99 : indexA;
      const weightB = indexB === -1 ? 99 : indexB;
      
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      
      // Secondary sort rule: surface 1080p choice above 720p for the same language
      return a.name.includes("1080p") ? -1 : 1;
    });

  } catch (err) {
    console.error("Global processing failure context:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams, onSettings };
} else {
    global.getStreams = getStreams;
    global.onSettings = onSettings;
}
