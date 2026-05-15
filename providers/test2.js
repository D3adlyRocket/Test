/**
 * ZinkMovies Provider for Nuvio
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const PROVIDER_NAME = "Asura | ZinkMovies";
const MAIN_URL = "https://new7.zinkmovies.biz";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

let visitedUrls = new Set();

function makeStream(name, title, url, quality, headers = {}) {
  return { 
    name: PROVIDER_NAME + " | " + name, 
    title: title, 
    url: url, 
    quality: quality, 
    headers: headers,
    type: "direct" 
  };
}

async function resolveHubCloud(url, label, quality) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    const html = await res.text();
    const streams = [];

    const instantMatch = html.match(/https:\/\/video-downloads\.googleusercontent\.com\/[^'"]+/g);
    if (instantMatch) {
        instantMatch.forEach(link => streams.push(makeStream("Direct", label, link, quality)));
        return streams;
    }

    const blogMatch = html.match(/href=['"]([^'"]+gamerxyt\.com[^'"]+)['"]/);
    if (blogMatch) {
        const blogRes = await fetch(blogMatch[1], { 
            headers: { "Referer": url, "Cookie": "xyt=1; xla=s4t" } 
        });
        const blogHtml = await blogRes.text();
        const googleLinks = blogHtml.match(/https:\/\/video-downloads\.googleusercontent\.com\/[^'"]+/g);
        if (googleLinks) {
            googleLinks.forEach(link => streams.push(makeStream("Direct", label, link, quality)));
        }
    }
    return streams;
  } catch (e) { return []; }
}

async function resolveZinkCloud(url, label, quality) {
  try {
    const fileID = url.split("/").pop();
    const domain = url.split("//")[0] + "//" + url.split("//")[1].split("/")[0];
    const workerRes = await fetch(domain + "/server-handler.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify({ server: "worker", random_id: fileID })
    });
    const workerData = await workerRes.json();
    if (workerData && workerData.url) return [makeStream("Worker", label, workerData.url, quality)];
  } catch (e) { return []; }
  return [];
}

// THIS IS THE MAIN FUNCTION NUVIO CALLS
async function getStreams(tmdbId, mediaType, season, episode) {
  visitedUrls.clear();
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const tmdbRes = await fetch(tmdbUrl);
    const tmdbData = await tmdbRes.json();
    const title = mediaType === "tv" ? tmdbData.name : tmdbData.title;
    if (!title) return [];

    const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(title)}`;
    const searchRes = await fetch(searchUrl, { headers: HEADERS });
    const searchHtml = await searchRes.text();
    
    // Improved Regex to find the post link
    const firstMatch = searchHtml.match(/href="(https:\/\/new7\.zinkmovies\.biz\/[^"]+)"/);
    if (!firstMatch) return [];

    const pageRes = await fetch(firstMatch[1], { headers: HEADERS });
    const pageHtml = await pageRes.text();
    
    // Find all potential link aggregators
    const foundLinks = pageHtml.match(/https:\/\/(linkstore|hubcloud|zinkcloud)[^\s"']+/g) || [];

    const allStreams = [];
    for (const link of foundLinks) {
        if (link.includes("zinkcloud")) {
            allStreams.push(...(await resolveZinkCloud(link, title, "HD")));
        } else if (link.includes("hubcloud")) {
            allStreams.push(...(await resolveHubCloud(link, title, "HD")));
        }
    }
    return allStreams;
  } catch (e) { return []; }
}

// --- CRITICAL NUVIO EXPORT ---
// Most Nuvio apps look for the function on the global object or module.exports
if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams };
} else {
    // This is the "Safety Net" for Nuvio
    globalThis.getStreams = getStreams;
}
