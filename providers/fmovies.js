/**
 * FourKHDHub - Fixed & Refactored
 * This version ensures resolutions are parsed correctly for the UI.
 */

// ... (Keep your original __async and boilerplate at the top)

var PROVIDER_NAME = "FourKHDHub";

// 1. IMPROVED QUALITY PARSING
function parseQuality(text) {
    const value = (text || "").toLowerCase();
    if (/2160p|4k|uhd/i.test(value)) return "4K";
    if (/1440p/i.test(value)) return "1440p";
    if (/1080p/i.test(value)) return "1080p";
    if (/720p/i.test(value)) return "720p";
    if (/480p/i.test(value)) return "480p";
    return "HD"; 
}

// 2. CLEANER DISPLAY LABELS
function buildDisplayMeta(sourceTitle = "", url = "", quality = "HD") {
    const v = sourceTitle.toLowerCase();
    let lang = "Multi";
    if (/\btr\b|turkce|türkçe/.test(v)) lang = "TR";
    else if (/\ben\b|english/.test(v)) lang = "EN";
    else if (v.includes("dual")) lang = "Dual";

    const source = url.toLowerCase().includes("hubcloud") ? "HubCloud" : 
                   url.toLowerCase().includes("pixeldrain") ? "Pixeldrain" : "Source";

    return {
        displayName: `${PROVIDER_NAME} - ${lang} - ${quality}`,
        displayTitle: `${source} • ${quality} • ${lang}`
    };
}

// 3. FIXED HUBCLOUD RESOLVER
async function resolveHubcloud(url, sourceTitle, referer) {
    try {
        const baseHeaders = referer ? { "Referer": referer } : {};
        let entryUrl = url;
        
        if (!/hubcloud\.php/i.test(url)) {
            const html2 = await fetchText(url, { headers: baseHeaders });
            const $2 = import_cheerio_without_node_native2.default.load(html2);
            const raw = $2("#download").attr("href");
            if (raw) entryUrl = fixUrl(raw, url);
        }

        const html = await fetchText(entryUrl, { headers: { "Referer": url, ...baseHeaders } });
        const $ = import_cheerio_without_node_native2.default.load(html);
        
        const size = $("i#size").first().text().trim();
        const header = $("div.card-header").first().text().trim();
        const quality = parseQuality(header);
        const details = cleanFileDetails(header);
        const extraInfo = [details, size].filter(Boolean).join(" | ");

        const streams = [];
        $("a.btn[href]").each((_, el) => {
            const link = fixUrl($(el).attr("href"), entryUrl);
            const text = $(el).text().trim().toLowerCase();
            if (!link) return;

            // Determine specific server name
            let server = "Mirror";
            if (text.includes("buzz")) server = "BuzzServer";
            else if (text.includes("pixel")) server = "Pixeldrain";
            else if (text.includes("fsl") || text.includes("direct")) server = "Direct";

            const meta = buildDisplayMeta(header, link, quality);

            streams.push({
                name: meta.displayName,
                title: `${server} [${extraInfo}]`, // This makes the UI look neat
                url: link,
                quality: quality,
                headers: { "Referer": entryUrl }
            });
        });
        return streams;
    } catch (e) {
        return [];
    }
}

// 4. MAIN EXTRACTION FIX
async function extractStreams(tmdbId, mediaType, season, episode) {
    const { trTitle, origTitle, shortTitle } = await getTmdbTitle(tmdbId, mediaType);
    
    let contentUrl = null;
    if (trTitle) contentUrl = await searchContent(trTitle, mediaType);
    if (!contentUrl && origTitle) contentUrl = await searchContent(origTitle, mediaType);
    
    if (!contentUrl) return [];

    const html = await fetchText(contentUrl);
    const $ = import_cheerio_without_node_native2.default.load(html);
    
    const isMoviePage = $("div.episodes-list").length === 0;
    let links = (mediaType === "movie" || isMoviePage) 
        ? collectMovieLinks($, contentUrl) 
        : collectEpisodeLinks($, contentUrl, season, episode);

    const allStreams = [];
    for (const linkItem of links) {
        const resolved = await resolveLink(linkItem.url, linkItem.label, contentUrl);
        if (resolved) allStreams.push(...resolved);
    }

    return dedupeStreams(allStreams);
}

// Ensure resolveLink calls our fixed resolveHubcloud
async function resolveLink(rawUrl, sourceTitle, referer = "") {
    let url = rawUrl;
    if (url.includes("id=")) {
        const redirected = await getRedirectLinks(url);
        if (redirected) url = redirected;
    }

    const lower = url.toLowerCase();
    if (lower.includes("hubcloud")) {
        return await resolveHubcloud(url, sourceTitle, referer);
    }
    // ... (Keep other resolvers like HubDrive/Pixeldrain)
    return [];
}
