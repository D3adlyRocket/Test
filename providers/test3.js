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

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};

// ─────────────────────────────────────────────────────────────
// NATIVE COOKIE & SESSION STORAGE
// ─────────────────────────────────────────────────────────────
const sessionCache = {};

function getSession(email) {
  const session = sessionCache[`session_${email}`];
  if (!session) return null;
  if (Date.now() - session.createdAt > 2.5 * 60 * 60 * 1000) { // 2.5 Hours Expiry
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

// ─────────────────────────────────────────────────────────────
// NATIVE FETCH AUTHENTICATION ENGINE
// ─────────────────────────────────────────────────────────────
async function loginAndGetCookies(email, password, langWebCode) {
  if (!email || !password) return "";
  
  const cachedCookie = getSession(email);
  if (cachedCookie) return cachedCookie;

  console.log(`[Premium Engine] Authorizing user session for ${email}...`);
  try {
    const loginUrl = `https://einthusan.tv/account/login/?lang=${langWebCode}`;
    
    // Step 1: Initialize token context
    const initRes = await fetch(loginUrl, { headers: DEFAULT_HEADERS });
    const html = await initRes.text();
    
    // Cross-check alternative token properties via standard regex match
    const csrfMatch = html.match(/name="(?:csrfmiddlewaretoken|_token)"\s+value="([^"]+)"/) || html.match(/value="([^"]+)"\s+name="(?:csrfmiddlewaretoken|_token)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : "";
    
    // Parse initial cookies using modern environment fallback structures
    const setCookieField = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : initRes.headers.get("set-cookie");
    let currentCookies = parseAndCombineCookies("", setCookieField);

    // Step 2: Request authentication handshake
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
      redirect: "manual" // Handle state transformations cleanly
    });

    const postCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : loginRes.headers.get("set-cookie");
    currentCookies = parseAndCombineCookies(currentCookies, postCookies);

    if (!currentCookies.includes("sid=")) {
      console.warn("[Premium Engine] ⚠️ Subscription payload 'sid' absent. Defaulting to standard stream resolution.");
      return "";
    }

    sessionCache[`session_${email}`] = { cookieString: currentCookies, createdAt: Date.now() };
    console.log(`[Premium Engine] ✅ Active Subscriber Session Ready.`);
    return currentCookies;
  } catch (err) {
    console.error("[Premium Engine] Authentication execution failed:", err);
    return "";
  }
}

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");

const isProxyUrl = (url) =>
  String(url ?? "").includes("workers.dev") || /[?&]url=/.test(String(url ?? ""));

// ─────────────────────────────────────────────────────────────
// PREMIUM RESOLVER CORE
// ─────────────────────────────────────────────────────────────
async function scrapeOfficialUhdLink(lowQualityUrl, langWebCode, isSeries) {
  if (!lowQualityUrl || !lowQualityUrl.includes("einthusan.")) return lowQualityUrl;

  try {
    const idMatch = lowQualityUrl.match(/\/content\/([DB])([^.]+)\.mp4/);
    if (!idMatch) return lowQualityUrl;
    const contentId = idMatch[2];

    const typePath = isSeries ? "serial" : "movie";
    
    // Check global variables for premium credentials dynamically
    const settings = globalThis.SCRAPER_SETTINGS || {};
    const email = settings.premiumEmail || "";
    const password = settings.premiumPassword || "";
    
    // Gather premium session string if configured
    const sessionCookieStr = await loginAndGetCookies(email, password, langWebCode || "hindi");
    
    const targetEndpoint = sessionCookieStr ? "premium/movie" : "movie";
    const watchPageUrl = `https://einthusan.tv/${sessionCookieStr ? 'premium/' : ''}${typePath}/watch/${contentId}/?lang=${langWebCode || "hindi"}&uhd=true`;

    const requestHeaders = { ...DEFAULT_HEADERS };
    if (sessionCookieStr) {
      requestHeaders["Cookie"] = sessionCookieStr;
    }

    const response = await fetch(watchPageUrl, { headers: requestHeaders });
    if (!response.ok) return lowQualityUrl;

    const html = await response.text();
    
    // 1. Try Primary Check: data-m3u8 attribute
    const m3u8AttrRegex = /data-m3u8=["']([^"']*\.mp4(?:\.m3u8)?\?[^"']+)["']/;
    const m3u8Match = html.match(m3u8AttrRegex);
    
    if (m3u8Match && m3u8Match[1]) {
      let tokenParameters = m3u8Match[1].replace(/&amp;/g, "&");
      
      tokenParameters = tokenParameters.replace(/\/content\/[DB]/, "/content/B");
      tokenParameters = tokenParameters.replace(".mp4.m3u8?", ".mp4?");
      
      if (!tokenParameters.startsWith("/")) {
        tokenParameters = "/etv/content/" + tokenParameters;
      }
      return `https://cdn1.einthusan.io${tokenParameters}`;
    }
    
    // 2. Try Secondary Check: data-mp4-link attribute
    const mp4LinkRegex = /data-mp4-link=["']([^"']+)["']/;
    const mp4Match = html.match(mp4LinkRegex);
    if (mp4Match && mp4Match[1]) {
      let cleanMp4 = mp4Match[1].replace(/&amp;/g, "&");
      
      cleanMp4 = cleanMp4.replace(/\/content\/[DB]/, "/content/B");
      cleanMp4 = cleanMp4.replace(".mp4.m3u8?", ".mp4?");
      cleanMp4 = cleanMp4.replace(/^https:\/\/[^\/]+/, "https://cdn1.einthusan.io");
      return cleanMp4;
    }

    // 3. Robust Fallback: Handle general regex captures
    const anyTokenRegex = /content\/[DB][^.]+\.mp4(?:\.m3u8)?\?e=(\d+)&amp;md5=([a-zA-Z0-9_=-]+)/;
    const generalMatch = html.match(anyTokenRegex);
    if (generalMatch) {
      const freshExpiry = generalMatch[1];
      const freshMd5 = generalMatch[2];
      return `https://cdn1.einthusan.io/etv/content/B${contentId}.mp4?e=${freshExpiry}&md5=${freshMd5}`;
    }

  } catch (err) {
    console.error("Automated UHD link compilation failed:", err);
  }
  
  return lowQualityUrl.replace("/content/D", "/content/B");
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

async function resolveProxyUrl(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { ...DEFAULT_HEADERS, "Referer": url },
    });
    const finalUrl = response.url;
    if ([".m3u8", ".mp4", ".mkv"].some((ext) => finalUrl.includes(ext))) {
      return finalUrl;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/plain")) {
      const text = await response.text();
      return text.trim() || null;
    }
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return data?.url ?? data?.stream ?? data?.src ?? null;
    }
    return finalUrl || null;
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
    
    return data.streams.filter((item) => {
      if (typeof item?.url !== "string" || !item.url.startsWith("https")) return false;
      const innerMatch = item.url.match(/[?&]url=(https?:\/\/[^&]+)/);
      return !innerMatch || innerMatch[1].startsWith("https");
    });
  } catch {
    return [];
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === "tv" || mediaType === "series" || season != null || episode != null;
  const s = season ?? 1;
  const e = episode ?? 1;

  try {
    const settings = globalThis.SCRAPER_SETTINGS || {};
    const allowedLanguages = Object.entries(LANGUAGES).filter(([key]) => {
        return settings[key] !== false;
    });

    const meta = await getTmdbMeta(tmdbId, isSeries ? "tv" : "movie");
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    const allStreams = [];

    await Promise.all(
      allowedLanguages.map(async ([_, langConfig]) => {
        let rawStreams = [];
        const endpointBase = `${EINTHUSAN_BASE}/${langConfig.path}`;

        if (!isSeries) {
          rawStreams = await fetchStreams(`${endpointBase}/stream/movie/${imdbId}.json`);
        } else {
          rawStreams = await fetchStreams(`${endpointBase}/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`);
          if (rawStreams.length === 0) {
            rawStreams = await fetchStreams(`${endpointBase}/stream/series/${imdbId}:${parseInt(s, 10)}:${parseInt(e, 10)}.json`);
          }
        }

        rawStreams.forEach((stream) => {
          allStreams.push({ 
            ...stream, 
            langLabel: langConfig.label,
            langWebCode: langConfig.webCode 
          });
        });
      })
    );

    if (allStreams.length === 0) return [];

    const result = [];

    for (const item of allStreams) {
      if (!item?.url || item.externalUrl || String(item.url).includes("github.com")) continue;

      let baseStreamUrl = isProxyUrl(item.url)
        ? await resolveProxyUrl(item.url)
        : item.url;

      if (!baseStreamUrl) continue;

      const uhdStreamUrl = await scrapeOfficialUhdLink(baseStreamUrl, item.langWebCode, isSeries);
      const lang = item.langLabel; 

      const uhdLayout = `🎦 ${meta.title || meta.name}\n💎 1080p Ultra HD | 🗣️ ${lang}\n🎞️ MP4 | 🔗 ${PROVIDER_NAME}`;
      result.push({
        name: `${PROVIDER_NAME} | 1080p UHD | ${lang}`,
        title: uhdLayout,
        size: uhdLayout,
        description: uhdLayout,
        url: uhdStreamUrl,
        behaviorHints: item.behaviorHints ?? {}
      });

      const hdLayout = `🎦 ${meta.title || meta.name}\n💎 720p HD | 🗣️ ${lang}\n🎞️ MP4 | 🔗 ${PROVIDER_NAME}`;
      result.push({
        name: `${PROVIDER_NAME} | 720p HD | ${lang}`,
        title: hdLayout,
        size: hdLayout,
        description: hdLayout,
        url: baseStreamUrl,
        behaviorHints: item.behaviorHints ?? {}
      });
    }

    return result;
  } catch (err) {
    console.error("Fetch failed:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams, onSettings };
} else {
    global.getStreams = getStreams;
    global.onSettings = onSettings;
}
