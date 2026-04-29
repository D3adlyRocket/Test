(function() {
    /**
     * @type {import('@skystream/sdk').Manifest}
     */
    // var manifest is injected at runtime

    // --- PARSER (JsoupLite) ---
    class JNode {
        constructor(tag = null, attrs = {}, parent = null) {
            this.tag = tag; this.attrs = attrs; this.parent = parent; this.children = []; this.text = "";
        }
        attr(name) { return this.attrs[name] || ""; }
        textContent() {
            let t = this.text;
            for (const c of this.children) t += c.textContent();
            return t;
        }
        matches(selector) {
            if (!this.tag) return false;
            if (selector[0] === "#") return this.attrs.id === selector.slice(1);
            if (selector[0] === ".") return (this.attrs.class || "").split(/\s+/).includes(selector.slice(1));
            return this.tag === selector;
        }
        selectFirst(selector) {
            for (const c of this.children) {
                if (c.matches(selector)) return c;
                const r = c.selectFirst(selector);
                if (r) return r;
            }
            return null;
        }
        select(selector, out = []) {
            for (const c of this.children) {
                if (c.matches(selector)) out.push(c);
                c.select(selector, out);
            }
            return out;
        }
    }

    class JsoupLite {
        constructor(html) {
            this.root = new JNode("root");
            let current = this.root;
            const re = /<\/?[^>]+>|[^<]+/g;
            let m;
            while ((m = re.exec(html))) {
                const token = m[0];
                if (token.startsWith("</")) {
                    if (current.parent) current = current.parent;
                } else if (token.startsWith("<")) {
                    const selfClosing = token.endsWith("/>") || ["br", "img", "meta"].includes(token.replace(/^<|\/?>$/g, "").trim().split(/\s+/)[0].toLowerCase());
                    const clean = token.replace(/^<|\/?>$/g, "").trim();
                    const parts = clean.split(/\s+/);
                    const tag = parts.shift().toLowerCase();
                    const attrs = {};
                    for (const p of parts) {
                        const i = p.indexOf("=");
                        if (i > 0) attrs[p.slice(0, i)] = p.slice(i + 1).replace(/^["']|["']$/g, "");
                    }
                    const node = new JNode(tag, attrs, current);
                    current.children.push(node);
                    if (!selfClosing) current = node;
                } else {
                    const text = token.trim();
                    if (text) {
                        const t = new JNode(null, {}, current); t.text = text; current.children.push(t);
                    }
                }
            }
        }
    }

    // --- CONFIG ---
    const DECODER_API = "https://enc-dec.app/api/dec-movies-flix"; 
    const TOKEN_API = "https://enc-dec.app/api/enc-movies-flix";

    const Headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": manifest.baseUrl + "/"
    };

    // --- HELPERS ---
    async function getToken(id) {
        try {
            const res = await http_get(`${TOKEN_API}?text=${encodeURIComponent(id)}`, Headers);
            return JSON.parse(res.body)?.result || "";
        } catch { return ""; }
    }

    // --- CORE FUNCTIONS ---
    async function getHome(cb) {
        try {
            const res = await http_get(`${manifest.baseUrl}/home`, Headers);
            const doc = new JsoupLite(res.body);
            const items = doc.root.select(".item").map(node => {
                const a = node.selectFirst("a.title");
                return new MultimediaItem({
                    title: a ? a.textContent().trim() : "Unknown",
                    url: a ? new URL(a.attr("href"), manifest.baseUrl).toString() : "",
                    posterUrl: node.selectFirst("img")?.attr("data-src") || node.selectFirst("img")?.attr("src")
                });
            });
            cb({ success: true, data: { "Recently Added": items } });
        } catch (e) {
            cb({ success: false, message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const res = await http_get(`${manifest.baseUrl}/search?keyword=${encodeURIComponent(query)}`, Headers);
            const doc = new JsoupLite(res.body);
            const items = doc.root.select(".item").map(node => {
                const a = node.selectFirst("a.title");
                return new MultimediaItem({
                    title: a ? a.textContent().trim() : "Unknown",
                    url: a ? new URL(a.attr("href"), manifest.baseUrl).toString() : "",
                    posterUrl: node.selectFirst("img")?.attr("data-src")
                });
            });
            cb({ success: true, data: items });
        } catch { cb({ success: false, data: [] }); }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, Headers);
            const doc = new JsoupLite(res.body);
            const movieID = doc.root.selectFirst("#movie-rating")?.attr("data-id");
            const keyword = url.split("/").pop();

            // Fetch Episode List
            const token = await getToken(movieID);
            const epRes = await http_get(`${manifest.baseUrl}/ajax/v2/episodes?id=${movieID}&keyword=${keyword}&_=${token}`, Headers);
            const epHtml = JSON.parse(epRes.body).result;
            const epDoc = new JsoupLite(epHtml);

            const episodes = epDoc.root.select("a.ep-item").map((el, i) => new Episode({
                name: el.textContent().trim() || `Episode ${i + 1}`,
                url: el.attr("data-id"), // This is the EID
                episode: i + 1,
                season: 1
            }));

            cb({ success: true, data: new MultimediaItem({
                title: doc.root.selectFirst("h1.title")?.textContent()?.trim(),
                url: url,
                episodes: episodes
            })});
        } catch (e) { cb({ success: false, errorCode: "LOAD_FAILED" }); }
    }

    async function loadStreams(eid, cb) {
        try {
            const token = await getToken(eid);
            // 1. Get Server List
            const serverRes = await http_get(`${manifest.baseUrl}/ajax/v2/links?id=${eid}&_=${token}`, Headers);
            const serverHtml = JSON.parse(serverRes.body).result;
            const sDoc = new JsoupLite(serverHtml);
            
            const results = [];
            for (const server of sDoc.root.select(".server-item")) {
                const lid = server.attr("data-id");
                const sName = server.textContent().trim();
                const lToken = await getToken(lid);

                // 2. Get Encrypted Source
                const sourceRes = await http_get(`${manifest.baseUrl}/ajax/v2/source?id=${lid}&_=${lToken}`, Headers);
                const encrypted = JSON.parse(sourceRes.body).result;

                // 3. Decrypt Source via API
                const decRes = await http_post(DECODER_API, { "Content-Type": "application/json" }, JSON.stringify({ text: encrypted }));
                const videoUrl = JSON.parse(decRes.body).result;

                if (videoUrl) {
                    results.push(new StreamResult({
                        url: videoUrl,
                        source: "Nuvio - " + sName,
                        quality: 1080
                    }));
                }
            }
            cb({ success: true, data: results });
        } catch { cb({ success: false }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
