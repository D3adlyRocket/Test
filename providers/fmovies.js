(function () {
    const DEBUG = false;
    function log(...a)  { if (DEBUG) console.log("[HMZ]", ...a); }
    function warn(...a) { if (DEBUG) console.warn("[HMZ WARN]", ...a); }
    function err(...a)  { console.error("[HMZ ERR]", ...a); }

    const DOMAINS_URL  = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

    const FALLBACK_DOMAINS = [
        "https://hindmoviez.cafe",
        "https://hindmoviez.com",
        "https://hindmoviez.net",
        "https://hindmoviez.in"
    ];

    const SKIP_PATTERNS = [
        /t\.me\//i, /telegram\./i, /facebook\.com/i, /instagram\.com/i,
        /twitter\.com/i, /youtube\.com/i, /doubleclick/i,
        /googlesyndication/i, /adservice/i, /disqus\.com/i,
        /whatsapp/i, /bit\.ly/i, /tinyurl/i, /rebrand\.ly/i,
        /linkskit/i, /contact/i, /disclaimer/i
    ];

    const HTTP_CACHE_TTL   = 5  * 60 * 1000;
    const DOMAIN_CACHE_TTL = 30 * 60 * 1000;
    const STREAM_CACHE_TTL = 10 * 60 * 1000;
    const POOL_HIGH  = 12;
    const POOL_MED   =  6;
    const POOL_LOW   =  4;
    const RETRY_SLEEP = 60;

    const httpCache     = new Map();
    const inFlightGets  = new Map();
    const streamCache   = new Map();
    const siteDomains   = new Set(FALLBACK_DOMAINS.map(getOrigin));

    let cachedMainUrl   = null;
    let cachedMainUrlAt = 0;
    let resolvingMainUrl = null;

    let _prewarm = null;
    function prewarm() {
        if (!_prewarm) _prewarm = resolveMainUrl(false).catch(() => {});
        return _prewarm;
    }

    function getOrigin(url) {
        const m = String(url || "").match(/^https?:\/\/[^/]+/i);
        return m ? m[0].replace(/\/$/, "") : "";
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function unique(arr) { return [...new Set((arr || []).filter(Boolean))]; }

    function toBase64Url(text) {
        const input = String(text || "");
        const utf8 = [];
        for (let i = 0; i < input.length; i++) {
            const code = input.charCodeAt(i);
            if (code < 0x80) { utf8.push(code); }
            else if (code < 0x800) { utf8.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f)); }
            else { utf8.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f)); }
        }
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let out = "";
        for (let i = 0; i < utf8.length; i += 3) {
            const a = utf8[i], b = i+1 < utf8.length ? utf8[i+1] : 0, c = i+2 < utf8.length ? utf8[i+2] : 0;
            const t = (a << 16) | (b << 8) | c;
            out += chars[(t >> 18) & 63] + chars[(t >> 12) & 63];
            out += i+1 < utf8.length ? chars[(t >> 6) & 63] : "=";
            out += i+2 < utf8.length ? chars[t & 63] : "=";
        }
        return out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    function isBlockedBody(body) {
        const text = String(body || "");
        return /just a moment/i.test(text)
            || /checking if the site connection is secure/i.test(text)
            || /cf-browser-verification/i.test(text)
            || (/attention required/i.test(text) && /cloudflare/i.test(text));
    }

    function isGoodUrl(url) {
        if (!url || !url.startsWith("http")) return false;
        for (const p of SKIP_PATTERNS) if (p.test(url)) return false;
        return true;
    }

    function stripTags(s) {
        return (s || "")
            .replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, " ")
            .replace(/\s+/g, " ").trim();
    }

    function allHrefs(html, baseUrl) {
        const found = [];
        for (const m of String(html || "").matchAll(/<a[^>]+href=["']([^"'#\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi))
            found.push({ href: resolveUrl(m[1], baseUrl || ""), text: stripTags(m[2] || "").trim() });
        return found;
    }

    function resolveUrl(href, base) {
        if (!href) return null;
        if (href.startsWith("http")) return href;
        if (href.startsWith("//")) return `https:${href}`;
        const origin = getOrigin(base);
        const cleanBase = String(base || "").replace(/[?#].*$/, "");
        const dir = cleanBase.endsWith("/") ? cleanBase.slice(0, -1) : cleanBase.replace(/\/[^/]*$/, "");
        if (href.startsWith("/")) return origin + href;
        return `${dir}/${href}`
            .replace(/^https?:\/\//i, m => m.replace("//", "__PROTO__"))
            .replace(/\/{2,}/g, "/").replace("__PROTO__", "//");
    }

    function cleanTitle(raw) {
        return (raw || "")
            .replace(/\b(480p|720p|1080p|4K|HDRip|BluRay|WEBRip|WEB-DL|DVDRip|HEVC|x264|x265|AAC|DD5\.1|ESub)\b/gi, "")
            .replace(/\s{2,}/g, " ").trim() || "Unknown";
    }

    function qualityOf(s) {
        const t = (s || "").toLowerCase();
        if (/\b(4k|2160p)\b/.test(t)) return 2160;
        if (/\b1080p\b/.test(t)) return 1080;
        if (/\b720p\b/.test(t)) return 720;
        if (/\b480p\b/.test(t)) return 480;
        return 0;
    }

    function specsLabel(s) {
        return [
            /\b(480p|720p|1080p|2160p|4K)\b/i,
            /\b(HEVC|x264|x265|AVC)\b/i,
            /\b(BluRay|WEBRip|WEB-DL|HDRip|DVDRip)\b/i,
            /\b(AAC|DD5\.1|DDP5\.1|DTS|AC3|Atmos)\b/i,
            /\b(ESub|MSub)\b/i
        ].map(p => (s || "").match(p)?.[0]).filter(Boolean).map(x => `[${x}]`).join("");
    }

    function parseContainerValue(body, label) {
        const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return stripTags(
            body.match(new RegExp(`<p[^>]*>\\s*<strong>\\s*${esc}\\s*:\\s*([^<]+)</strong>\\s*</p>`, "i"))?.[1] ||
            body.match(new RegExp(`<p[^>]*>\\s*<strong>\\s*${esc}\\s*:?\\s*</strong>\\s*([^<]+)</p>`, "i"))?.[1] ||
            body.match(new RegExp(`(?:^|>|\\s)${esc}\\s*:?\\s*([^<\\n]+)`, "i"))?.[1] || ""
        );
    }

    function parseAnchorsByClass(body, classPart, baseUrl) {
        const out = [];
        for (const m of String(body || "").matchAll(/<a([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
            const attrs = `${m[1] || ""} ${m[3] || ""}`;
            if (!new RegExp(`class=["'][^"']*${classPart}[^"']*["']`, "i").test(attrs)) continue;
            out.push({ href: resolveUrl(m[2], baseUrl), text: stripTags(m[4] || "") });
        }
        return out;
    }

    function parseAnchorsContainingButtonClass(body, classPart, baseUrl) {
        const out = [];
        const re = new RegExp(
            `<a[^>]+href=["']([^"']+)["'][^>]*>[\\s\\S]*?<button[^>]+class=["'][^"']*${classPart}[^"']*["'][^>]*>([\\s\\S]*?)<\\/button>[\\s\\S]*?<\\/a>`,
            "gi"
        );
        for (const m of String(body || "").matchAll(re))
            out.push({ href: resolveUrl(m[1], baseUrl), text: stripTags(m[2] || "") });
        return out;
    }

    function isCandidateStreamPageUrl(url) {
        return /hshare\.|gdirect\.|gdshine\.|hcloud\.|gdtot\.|redirect\.php|file\.php/i.test(String(url || ""));
    }

    async function pooledMap(items, limit, mapper) {
        const list = items || [];
        if (!list.length) return [];
        const results = new Array(list.length);
        let cursor = 0;
        await Promise.all(
            Array.from({ length: Math.min(limit, list.length) }, async () => {
                while (cursor < list.length) {
                    const idx = cursor++;
                    try { results[idx] = await mapper(list[idx], idx); }
                    catch (e) { results[idx] = null; err("pooledMap:", e.message || e); }
                }
            })
        );
        return results;
    }

    async function raceFirst(promises) {
        return new Promise(resolve => {
            let pending = promises.length;
            if (!pending) return resolve(null);
            for (const p of promises) {
                Promise.resolve(p).then(v => { if (v != null) resolve(v); })
                    .catch(() => {})
                    .finally(() => { if (--pending === 0) resolve(null); });
            }
        });
    }

    async function httpGetCached(url, ttl = HTTP_CACHE_TTL, force = false) {
        const key = String(url);
        const now = Date.now();
        const cached = httpCache.get(key);
        if (!force && cached && cached.expiresAt > now) return cached.value;
        if (!force && inFlightGets.has(key)) return inFlightGets.get(key);
        const job = (async () => {
            const value = await http_get(url);
            httpCache.set(key, { value, expiresAt: now + ttl });
            return value;
        })();
        inFlightGets.set(key, job);
        try { return await job; }
        finally { inFlightGets.delete(key); }
    }

    async function fetchWithRetry(url, {
        attempts     = 2,
        ttl          = HTTP_CACHE_TTL,
        force        = false,
        allowBlocked = false
    } = {}) {
        let lastErr = null;
        for (let i = 0; i < attempts; i++) {
            try {
                const res = await httpGetCached(url, ttl, force || i > 0);
                if (!allowBlocked && isBlockedBody(res.body)) throw new Error("Blocked by anti-bot");
                return res;
            } catch (e) {
                lastErr = e;
                if (i + 1 < attempts) await sleep(RETRY_SLEEP * (i + 1));
            }
        }
        throw lastErr;
    }

    async function postText(url, body, headers = {}) {
        if (typeof http_post === "function") {
            let lastErr = null;
            for (const attempt of [
                () => http_post(url, headers, body),
                () => http_post(url, body, headers)
            ]) {
                try {
                    const res = await attempt();
                    return {
                        status:  res?.status  ?? 200,
                        body:    res?.body    ?? "",
                        headers: res?.headers ?? {}
                    };
                } catch (e) { lastErr = e; }
            }
            throw lastErr || new Error(`POST failed: ${url}`);
        }
        if (typeof fetch === "function") {
            const res = await fetch(url, { method: "POST", headers, body });
            return { status: res.status, body: await res.text(), headers: {} };
        }
        throw new Error("POST not supported");
    }

    async function postJson(url, body, headers = {}) {
        return postText(url, typeof body === "string" ? body : JSON.stringify(body || {}), {
            "content-type": "application/json", ...headers
        });
    }

    function parseJsonSafe(text) { try { return JSON.parse(text); } catch (_) { return null; } }

    async function isHealthyDomain(url) {
        try {
            const res = await fetchWithRetry(`${url}/`, { attempts: 1, ttl: DOMAIN_CACHE_TTL });
            return !isBlockedBody(res.body);
        } catch (_) { return false; }
    }

    async function resolveMainUrl(force = false) {
        const now = Date.now();
        if (!force && cachedMainUrl && (now - cachedMainUrlAt) < DOMAIN_CACHE_TTL) return cachedMainUrl;
        if (!force && resolvingMainUrl) return resolvingMainUrl;

        resolvingMainUrl = (async () => {
            const candidates = [];
            try {
                const res = await fetchWithRetry(DOMAINS_URL, { attempts: 2, ttl: DOMAIN_CACHE_TTL, force });
                const d = JSON.parse(res.body);
                const c = d.hindmoviez || d.hindmoviez_url;
                if (c) candidates.push(c);
            } catch (e) { err("domains.json:", e.message); }

            candidates.push(...FALLBACK_DOMAINS);
            const uniq = unique(candidates);

            const winner = await raceFirst(
                uniq.map(domain =>
                    isHealthyDomain(domain).then(ok => ok ? domain.replace(/\/$/, "") : null)
                )
            );

            cachedMainUrl   = winner || FALLBACK_DOMAINS[0];
            cachedMainUrlAt = Date.now();
            siteDomains.add(getOrigin(cachedMainUrl));
            return cachedMainUrl;
        })();

        try { return await resolvingMainUrl; }
        finally { resolvingMainUrl = null; }
    }

    async function getMainUrl()    { return resolveMainUrl(false); }
    async function refreshMainUrl(){ return resolveMainUrl(true); }

    async function rewriteToActiveDomain(url) {
        const currentOrigin = getOrigin(url);
        if (!siteDomains.has(currentOrigin)) return url;
        const mainUrl = await getMainUrl();
        const activeOrigin = getOrigin(mainUrl);
        return currentOrigin === activeOrigin ? url : url.replace(currentOrigin, activeOrigin);
    }

    async function siteRequest(url, { attempts = 2, ttl = HTTP_CACHE_TTL } = {}) {
        let current = await rewriteToActiveDomain(url);
        let lastErr = null;
        for (let i = 0; i < attempts; i++) {
            try {
                const res = await fetchWithRetry(current, { attempts: 2, ttl, force: i > 0 });
                if (isBlockedBody(res.body)) throw new Error("Blocked by anti-bot");
                return { ...res, url: current };
            } catch (e) {
                lastErr = e;
                const freshMain = await refreshMainUrl();
                if (siteDomains.has(getOrigin(current)))
                    current = current.replace(getOrigin(current), getOrigin(freshMain));
            }
        }
        throw lastErr;
    }

    async function fetchFinal(url, maxHops = 5, opts = {}) {
        let cur = url;
        for (let i = 0; i < maxHops; i++) {
            let res;
            try {
                res = await fetchWithRetry(cur, {
                    attempts: 2, ttl: opts.ttl ?? HTTP_CACHE_TTL, allowBlocked: !!opts.allowBlocked
                });
            } catch (e) { err("fetchFinal:", e.message); return { url: cur, body: "" }; }

            const body = res.body || "";
            if (res.headers?.location) { cur = resolveUrl(res.headers.location, cur); continue; }
            const meta = body.match(/<meta[^>]+http-equiv="refresh"[^>]+content="[^;]*;\s*url=([^"'>\s]+)/i);
            if (meta) { cur = resolveUrl(meta[1].replace(/['"]/g, ""), cur); continue; }
            const js = body.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i)
                    || body.match(/location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i);
            if (js) { cur = resolveUrl(js[1], cur); continue; }
            return { url: cur, body };
        }
        return { url: cur, body: "" };
    }

    function parseArticles(html, mainUrl) {
        const items = [];
        const articleMatches = String(html || "").match(/<article[\s\S]*?<\/article>/gi) || [];
        const blocks = articleMatches.length
            ? articleMatches
            : (String(html || "").match(/<div[^>]+class="[^"]*\bpost\b[^"]*"[\s\S]*?<\/div>/gi) || []);

        for (const block of blocks) {
            const tm = block.match(/<h[23][^>]*class="[^"]*entry-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
                    || block.match(/<h[23][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[23]>/i);
            const rawTitle = tm ? stripTags(tm[1]) : null;
            if (!rawTitle) continue;
            const hm = block.match(/<a[^>]+href="([^"]+)"/i);
            const href = hm ? resolveUrl(hm[1], mainUrl) : null;
            if (!href) continue;
            const pm = block.match(/<img[^>]+data-src="([^"]+)"/i) || block.match(/<img[^>]+src="([^"]+)"/i);
            items.push(new MultimediaItem({
                title: cleanTitle(rawTitle),
                url: href,
                posterUrl: pm?.[1] || null,
                type: /Season/i.test(rawTitle) ? "series" : "movie"
            }));
        }
        return items;
    }

    async function getHome(cb) {
        try {
            const mainUrl = await getMainUrl();
            const sections = [
                { name: "Home",           path: "" },
                { name: "Movies",         path: "movies" },
                { name: "Web Series",     path: "web-series" },
                { name: "Korean Dramas",  path: "dramas/korean-drama" },
                { name: "Chinese Dramas", path: "dramas/chinese-drama" },
                { name: "Anime",          path: "anime" }
            ];

            const results = await Promise.all(
                sections.map(async section => {
                    const url = section.path ? `${mainUrl}/${section.path}` : mainUrl;
                    try {
                        const res = await siteRequest(url, { attempts: 2, ttl: HTTP_CACHE_TTL });
                        return [section.name, parseArticles(res.body, mainUrl)];
                    } catch (e) {
                        err("getHome section:", e.message);
                        return [section.name, []];
                    }
                })
            );

            const homeData = {};
            for (const [name, items] of results)
                if (items?.length) homeData[name] = items;

            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const mainUrl = await getMainUrl();
            const res = await siteRequest(`${mainUrl}/?s=${encodeURIComponent(query)}`, { attempts: 2, ttl: HTTP_CACHE_TTL });
            cb({ success: true, data: parseArticles(res.body, mainUrl) });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function buildSeriesEpisodes(html, mainUrl) {
        const map = {};
        const seasonEntries = [];
        const sRe = /<h[23][^>]*>[\s\S]*?Season\s*(\d+)[\s\S]*?<\/h[23]>[\s\S]*?<a[^>]+href="([^"]+)"/gi;
        let sm;
        while ((sm = sRe.exec(html)) !== null) {
            const season = parseInt(sm[1], 10);
            const listUrl = resolveUrl(sm[2], mainUrl);
            if (season && listUrl) seasonEntries.push({ season, listUrl });
        }

        await Promise.all(
            seasonEntries.map(async ({ season, listUrl }) => {
                try {
                    const lr = await siteRequest(listUrl, { attempts: 2, ttl: HTTP_CACHE_TTL });
                    for (const { href, text } of allHrefs(lr.body, listUrl)) {
                        const epMatch = text.match(/Episode\s*(\d+)/i)
                                     || text.match(/\bEp\.?\s*(\d+)/i)
                                     || text.match(/\bE(\d+)\b/i);
                        if (!epMatch || !isGoodUrl(href)) continue;
                        const episode = parseInt(epMatch[1], 10);
                        const key = `${season}_${episode}`;
                        if (!map[key]) map[key] = { season, episode, pageUrls: [] };
                        map[key].pageUrls.push(href);
                    }
                } catch (e) { err("season list fetch:", e.message); }
            })
        );

        return Object.values(map).map(ep =>
            new Episode({
                name:    `Episode ${ep.episode}`,
                url:     JSON.stringify(unique(ep.pageUrls)),
                season:  ep.season,
                episode: ep.episode
            })
        ).sort((a, b) => a.season !== b.season ? a.season - b.season : a.episode - b.episode);
    }

    async function collectMovieLinks(html, mainUrl) {
        const candidates = new Set();

        for (const re of [
            /<a[^>]+class="[^"]*maxbutton[^"]*"[^>]+href="([^']+)"/gi,
            /<a[^>]+class="[^"]*download-btn[^"]*"[^>]+href="([^']+)"/gi
        ]) {
            for (const m of String(html || "").matchAll(re))
                candidates.add(resolveUrl(m[1], mainUrl));
        }

        for (const { href, text } of allHrefs(html, mainUrl))
            if (isGoodUrl(href) && /download|480p|720p|1080p|4k|mvlink/i.test(text))
                candidates.add(href);

        if (candidates.size === 0) {
            const content = html.match(/<div[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || html;
            return unique(allHrefs(content, mainUrl).map(x => x.href).filter(isGoodUrl));
        }

        const nestedResults = await pooledMap([...candidates], POOL_HIGH, async (listUrl) => {
            const pageUrl = await rewriteToActiveDomain(listUrl);
            const { body } = await siteRequest(pageUrl, { attempts: 2, ttl: HTTP_CACHE_TTL });
            const content = body.match(/<div[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || body;
            return allHrefs(content, pageUrl)
                .map(x => x.href)
                .filter(href => isGoodUrl(href) && isCandidateStreamPageUrl(href));
        });

        return unique(nestedResults.flat());
    }

    async function signHshareUrl(url) {
        const match = String(url || "").match(/^https?:\/\/hshare\.ink\/\?id=([^&#]+)/i);
        if (!match) return url;
        const rawId = decodeURIComponent(match[1]);
        const encodedId = toBase64Url(rawId);
        const res = await postText("https://mvlink.site/wp-admin/admin-ajax.php",
            `action=hindshare_sign&d=${encodeURIComponent(encodedId)}`,
            { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }
        );
        return parseJsonSafe(res.body || "")?.data?.url || url;
    }

    async function extractPageStreams(pageUrl) {
        const key = String(pageUrl);
        const now = Date.now();
        const cached = streamCache.get(key);
        if (cached && cached.expiresAt > now) return cached.value;

        const job = (async () => {
            pageUrl = await signHshareUrl(pageUrl);

            if (/gdshine\./i.test(pageUrl)) {
                const id = String(pageUrl).replace(/[?#].*$/, "").split("/").filter(Boolean).pop();
                if (id) {
                    try {
                        const fileRes = await fetchWithRetry(`https://gdshine.org/api/files/s/${id}`, {
                            attempts: 2, ttl: HTTP_CACHE_TTL, allowBlocked: true
                        });
                        const fileData = parseJsonSafe(fileRes.body)?.data;
                        if (fileData?.id) {
                            const workerRes = await postJson(`https://gdshine.org/api/downloads/${fileData.id}/via-worker`, {});
                            const copyUrl = parseJsonSafe(workerRes.body)?.data?.copyUrl;
                            if (copyUrl && isGoodUrl(copyUrl))
                                return [{ url: copyUrl, quality: qualityOf(fileData.name),
                                    source: `[Gdshine]${specsLabel(fileData.name)}`.trim(), headers: {} }];
                        }
                    } catch (e) { err("gdshine fast-path:", e.message); }
                }
            }

            const { url: resolvedPageUrl, body } = await fetchFinal(pageUrl, 3, { ttl: HTTP_CACHE_TTL, allowBlocked: true });
            const fileName = parseContainerValue(body, "Name")
                          || stripTags(body.match(/<title>([^<]+)<\/title>/i)?.[1] || "");
            const fileSize = parseContainerValue(body, "Size");
            const specs    = specsLabel(fileName);

            const btns = parseAnchorsByClass(body, "btn", resolvedPageUrl)
                .filter(btn => isGoodUrl(btn.href))
                .sort((a, b) => {
                    const score = t => {
                        t = String(t || "").toLowerCase();
                        if (t.includes("gdshine") || t.includes("gd shine")) return 0;
                        if (t.includes("gdirect")) return 1;
                        if (t.includes("hpage") || t.includes("hcloud")) return 2;
                        if (t.includes("gdtot")) return 3;
                        return 4;
                    };
                    return score(a.text) - score(b.text);
                });

            const result = await raceFirst(
                btns.map(async btn => {
                    try {
                        const { url: btnPageUrl, body: btnBody } = await fetchFinal(btn.href, 4, {
                            ttl: HTTP_CACHE_TTL, allowBlocked: true
                        });
                        const heading = stripTags(btnBody.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "");
                        const quality = qualityOf(heading) || qualityOf(fileName) || qualityOf(btn.text);
                        const finalLinks = unique([
                            ...parseAnchorsByClass(btnBody, "button", btnPageUrl),
                            ...parseAnchorsContainingButtonClass(btnBody, "button", btnPageUrl)
                        ].map(link => link && isGoodUrl(link.href) ? JSON.stringify(link) : null))
                            .map(link => JSON.parse(link));

                        if (!finalLinks.length) return null;
                        const link = finalLinks[0];
                        return [{
                            url:     link.href,
                            quality,
                            source:  `[${link.text || "HCloud"}]${specs}${fileSize ? `[${fileSize}]` : ""}`.trim(),
                            headers: { Referer: btnPageUrl }
                        }];
                    } catch (e) {
                        err("btn page failed:", e.message);
                        return null;
                    }
                })
            );

            return result || [];
        })();

        streamCache.set(key, { value: job, expiresAt: now + STREAM_CACHE_TTL });
        try { return await job; }
        catch (e) { streamCache.delete(key); throw e; }
    }

    async function load(url, cb) {
        try {
            const mainUrl = await getMainUrl();
            const realUrl = await rewriteToActiveDomain(url);
            const res = await siteRequest(realUrl, { attempts: 2, ttl: HTTP_CACHE_TTL });
            const html = res.body;

            let name = null, imdbRating = null, releaseYear = null, docGenres = [];

            const liRe = /<li>([\s\S]*?)<\/li>/gi;
            let lm;
            while ((lm = liRe.exec(html)) !== null) {
                const liHtml = lm[1];
                const sm = liHtml.match(/<strong>([\s\S]*?)<\/strong>/i);
                if (!sm) continue;
                const key   = stripTags(sm[1]).split(":")[0].trim();
                const inner = (stripTags(sm[1]).split(":")[1] || "").trim();
                const val   = stripTags(liHtml.replace(sm[0], "")).trim() || inner;
                if (key === "Name") name = val || null;
                else if (key === "IMDB Rating") imdbRating = inner.split("/")[0].trim() || null;
                else if (key === "Release Year") releaseYear = val || null;
                else if (key === "Genre") docGenres = val.split(",").map(s => s.trim()).filter(Boolean);
            }

            if (!name) { const m = html.match(/(?:Name|Movie Name)\s*:\s*([^\n<]+)/i); if (m) name = stripTags(m[1]).trim(); }
            if (!releaseYear) { const m = html.match(/(?:Release Year|Year)\s*:\s*(\d{4})/i); if (m) releaseYear = m[1]; }

            const title    = name || "Unknown";
            const poster   = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] || null;
            const heading  = stripTags(html.match(/<h1[^>]*class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
            const isSeries = /Season/i.test(heading);

            if (isSeries) {
                const episodes = await buildSeriesEpisodes(html, mainUrl);
                cb({ success: true, data: new MultimediaItem({
                    title, url: realUrl, posterUrl: poster, bannerUrl: poster,
                    type: "series", year: parseInt(releaseYear) || undefined,
                    score: parseFloat(imdbRating) || undefined,
                    genres: docGenres, episodes
                })});
                return;
            }

            const pageUrls = await collectMovieLinks(html, mainUrl);
            cb({ success: true, data: new MultimediaItem({
                title, url: realUrl, posterUrl: poster, bannerUrl: poster,
                type: "movie", year: parseInt(releaseYear) || undefined,
                score: parseFloat(imdbRating) || undefined,
                genres: docGenres,
                episodes: [new Episode({ name: "Movie", url: JSON.stringify(pageUrls), season: 1, episode: 1 })]
            })});
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const parsed  = JSON.parse(url);
            const pageUrls = Array.isArray(parsed) ? unique(parsed) : [];
            if (!pageUrls.length) { cb({ success: true, data: [] }); return; }

            const extracted = await pooledMap(pageUrls, POOL_HIGH, extractPageStreams);
            const seenUrls  = new Set();
            const results   = [];

            for (const group of extracted) {
                for (const stream of group || []) {
                    if (!stream?.url || seenUrls.has(stream.url)) continue;
                    seenUrls.add(stream.url);
                    results.push(new StreamResult(stream));
                }
            }

            results.sort((a, b) => (b.quality || 0) - (a.quality || 0));
            cb({ success: true, data: results });
        } catch (e) {
            err("loadStreams:", e);
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    for (const ctx of [
        typeof globalThis !== "undefined" ? globalThis : null,
        typeof window    !== "undefined" ? window    : null,
        typeof global    !== "undefined" ? global    : null
    ]) {
        if (ctx) { ctx.getHome = getHome; ctx.search = search; ctx.load = load; ctx.loadStreams = loadStreams; }
    }

    prewarm();
})();

// ─────────────────────────────────────────────────────────────────────────────
//  Plug‑in bridge: TMDB → HindMoviez streams via the fast.js engine
// ─────────────────────────────────────────────────────────────────────────────

var PLUGIN_TAG   = '[HindMoviez]';
var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var HM_WORKER    = 'https://hindmoviez.s4nch1tt.workers.dev';

function hmProxyUrl(rawUrl) {
    if (!rawUrl) return rawUrl;
    return HM_WORKER + '/hm/proxy?url=' + encodeURIComponent(rawUrl);
}

/**
 * Entry point expected by the add‑on framework.
 * Uses the fast.js search → load → loadStreams pipeline.
 */
async function getStreams(tmdbId, type, season, episode) {
    try {
        // 1. Get TMDB details to build a search query
        const isSeries = (type === 'series' || type === 'tv');
        const tmdbUrl = 'https://api.themoviedb.org/3/' +
            (isSeries ? 'tv' : 'movie') + '/' + tmdbId +
            '?api_key=' + TMDB_API_KEY;

        const tmdbResp = await fetch(tmdbUrl).then(r => r.json());
        const query = isSeries ? tmdbResp.name : tmdbResp.title;
        if (!query) return [];

        // 2. Search on HindMoviez using the fast.js search (uses optimal domains, caching, etc.)
        const searchResults = await new Promise((resolve, reject) => {
            // fast.js search expects a callback
            search(query, function(result) {
                if (result.success) resolve(result.data);
                else reject(new Error(result.message || 'Search failed'));
            });
        });

        if (!searchResults || !searchResults.length) return [];

        // 3. Pick the best matching item (first result; you can add fuzzy matching later)
        const bestMatch = searchResults[0];
        if (!bestMatch || !bestMatch.url) return [];

        // 4. Load the full page to get episode/movie links
        const loadResult = await new Promise((resolve, reject) => {
            load(bestMatch.url, function(result) {
                if (result.success) resolve(result.data);
                else reject(new Error(result.message || 'Load failed'));
            });
        });

        let episodeUrls = [];
        if (loadResult.type === 'series') {
            const eps = loadResult.episodes || [];
            // Filter by requested season/episode if both given, otherwise take all
            const targetEp = eps.find(ep =>
                (typeof season === 'undefined' ? true : ep.season == season) &&
                (typeof episode === 'undefined' ? true : ep.episode == episode)
            );
            if (targetEp) episodeUrls = JSON.parse(targetEp.url);
            else episodeUrls = []; // no matching episode
        } else {
            // Movie: get the (single) episode urls
            const movieEp = (loadResult.episodes && loadResult.episodes[0]);
            episodeUrls = movieEp ? JSON.parse(movieEp.url) : [];
        }

        if (!episodeUrls.length) return [];

        // 5. Extract actual streams from the scraped page URLs
        const streams = await new Promise((resolve, reject) => {
            loadStreams(JSON.stringify(episodeUrls), function(result) {
                if (result.success) resolve(result.data);
                else reject(new Error(result.message || 'Stream extraction failed'));
            });
        });

        // 6. Map to the output format expected by the add‑on (and optionally wrap with proxy)
        return streams.map(stream => ({
            name: '🎬 HindMoviez | ' + (stream.source || 'Direct') + ' | ' + (stream.quality || '720p') + 'p',
            title: '📺 ' + (stream.quality || '720p') + 'p • 💾 ' + (stream.source || ''),
            url: hmProxyUrl(stream.url),
            quality: stream.quality || 720,
            behaviorHints: { notWebReady: false }
        }));
    } catch (e) {
        console.error(PLUGIN_TAG, 'getStreams error:', e);
        return [];
    }
}

// Export for both CommonJS and global environment
if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
else { global.getStreams = getStreams; }
