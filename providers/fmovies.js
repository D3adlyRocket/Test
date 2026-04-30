"use strict";

const cheerio = require("cheerio-without-node-native");

// --- Configuration & Constants ---
const BASE_URL = "https://4khdhub.click";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// --- Utility Helpers ---
function rot13(str) {
    return str.replace(/[a-zA-Z]/g, (c) => String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
}

function levenshteinDistance(s, t) {
    if (s === t) return 0;
    const n = s.length, m = t.length;
    const d = Array.from({ length: n + 1 }, (_, i) => [i]);
    for (let j = 1; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = s.charAt(i - 1).toLowerCase() === t.charAt(j - 1).toLowerCase() ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        }
    }
    return d[n][m];
}

function formatBytes(val) {
    if (val === 0 || !val) return "N/A";
    const k = 1024, sizes = ["B", "KB", "MB", "GB", "TB"];
    let i = Math.floor(Math.log(val) / Math.log(k));
    return parseFloat((val / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// --- Domain Resolver ---
let domainCache = { url: BASE_URL, ts: 0 };
async function fetchLatestDomain() {
    const now = Date.now();
    if (now - domainCache.ts < 36e5) return domainCache.url;
    try {
        const response = await fetch(DOMAINS_URL);
        const data = await response.json();
        if (data && data["4khdhub"]) {
            domainCache.url = data["4khdhub"];
            domainCache.ts = now;
        }
    } catch (e) {}
    return domainCache.url;
}

// --- Modern Extractor (From 2nd Code) ---
async function resolveRedirectUrl(redirectUrl) {
    try {
        const response = await fetch(redirectUrl, { headers: { "User-Agent": USER_AGENT } });
        const html = await response.text();
        // Uses the specific regex from the working code
        const match = html.match(/'o','(.*?)'/);
        if (!match) return null;
        const step1 = atob(match[1]);
        const step2 = atob(step1);
        const step3 = rot13(step2);
        const step4 = atob(step3);
        const data = JSON.parse(step4);
        return data.o ? atob(data.o) : null;
    } catch (e) {
        return null;
    }
}

// --- Main Stream Logic ---
async function getStreams(tmdbId, type, season, episode) {
    // 1. Get Metadata via TMDB (Logic from 1st code)
    const isSeries = type === "series" || type === "tv";
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const infoRes = await fetch(tmdbUrl);
    const info = await infoRes.json();
    const title = info.name || info.title;
    const year = parseInt((info.first_air_date || info.release_date || "0").split("-")[0]);

    // 2. Resolve Domain & Search
    const domain = await fetchLatestDomain();
    const searchUrl = `${domain}/?s=${encodeURIComponent(title + " " + year)}`;
    const searchHtml = await (await fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } })).text();
    const $ = cheerio.load(searchHtml);
    
    let pageUrl = null;
    $(".movie-card").each((_, el) => {
        const cardTitle = $(el).find(".movie-card-title").text().replace(/\[.*?]/g, "").trim();
        const cardYear = parseInt($(el).find(".movie-card-meta").text());
        const distance = levenshteinDistance(cardTitle, title);

        if (distance < 5 && Math.abs(cardYear - year) <= 1) {
            pageUrl = $(el).attr("href");
            return false;
        }
    });

    if (!pageUrl) return [];

    // 3. Extract Links from Content Page
    const pageHtml = await (await fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } })).text();
    const $p = cheerio.load(pageHtml);
    const results = [];
    const itemsToProcess = [];

    if (isSeries && season && episode) {
        const sStr = "S" + String(season).padStart(2, "0");
        const eStr = "Episode-" + String(episode).padStart(2, "0");
        $p(".episode-item").each((_, el) => {
            if ($p(el).find(".episode-title").text().includes(sStr)) {
                $p(el).find(".episode-download-item").each((_, item) => {
                    if ($p(item).text().includes(eStr)) itemsToProcess.push(item);
                });
            }
        });
    } else {
        $p(".download-item").each((_, el) => itemsToProcess.push(el));
    }

    // 4. Resolve Final Stream URLs (Using working resolver)
    for (const item of itemsToProcess) {
        const metaText = $p(item).text();
        const sizeMatch = metaText.match(/([\d.]+ ?[GM]B)/);
        const resolutionMatch = metaText.match(/\d{3,}p/);
        const resolution = resolutionMatch ? resolutionMatch[0] : (metaText.toLowerCase().includes("4k") ? "2160p" : "HD");

        const links = $p(item).find("a");
        for (let i = 0; i < links.length; i++) {
            const btn = links[i];
            const btnText = $p(btn).text();
            const href = $p(btn).attr("href");

            if (href && (btnText.includes("HubCloud") || btnText.includes("Instant"))) {
                const streamUrl = await resolveRedirectUrl(href);
                if (streamUrl) {
                    results.push({
                        name: `4KHDHub - ${resolution}`,
                        title: `${title} (${year})\n${btnText} | ${sizeMatch ? sizeMatch[0] : "N/A"}`,
                        url: streamUrl,
                        quality: resolution,
                        behaviorHints: { bingeGroup: `4khd-${tmdbId}` }
                    });
                }
            }
        }
    }

    return results;
}

module.exports = { getStreams };
