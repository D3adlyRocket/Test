/**
 * xpass - Built from src/xpass/
 * Generated: 2026-05-11T13:43:18.800Z
 */
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/xpass/constants.js
var XPASS_API = "https://play.xpass.top";
var BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": `${XPASS_API}/`
};

// src/xpass/utils.js
function generateM3u8(_0, _1) {
  return __async(this, arguments, function* (streamName, masterUrl, headers = {}) {
    try {
      console.log(`[Xpass] Parsing master m3u8: ${masterUrl}`);
      const resp = yield fetch(masterUrl, { headers });
      const text = yield resp.text();
      const baseUri = masterUrl.substring(0, masterUrl.lastIndexOf("/")) + "/";
      const results = [];
      const regex = /#EXT-X-STREAM-INF:.*?RESOLUTION=(\d+x\d+).*?\n([^\n]+)/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const res = match[1].split("x")[1] + "p";
        let url = match[2].trim();
        if (!url.startsWith("http")) {
          if (url.startsWith("/")) {
            const root = new URL(masterUrl).origin;
            url = root + url;
          } else {
            url = baseUri + url;
          }
        }
        results.push({
          quality: res,
          url
        });
      }
      if (results.length === 0) {
        return [{ quality: "Auto", url: masterUrl }];
      }
      return results;
    } catch (err) {
      console.warn(`[Xpass] Error parsing M3U8, returning master URL.`, err);
      return [{ quality: "Auto", url: masterUrl }];
    }
  });
}

// src/xpass/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(`[Xpass] Fetching streams for ${mediaType} ${tmdbId}`);
    const streams = [];
    try {
      const embedUrl = mediaType === "tv" ? `${XPASS_API}/e/tv/${tmdbId}/${season}/${episode}` : `${XPASS_API}/e/movie/${tmdbId}`;
      console.log(`[Xpass] Navigating to Embed: ${embedUrl}`);
      const resp = yield fetch(embedUrl, { headers: BASE_HEADERS });
      const html = yield resp.text();
      const backupsMatch = html.match(new RegExp("var backups\\s*=\\s*(\\[.*?\\])\\s*(?:;|<\\/script>)", "s"));
      if (!backupsMatch) {
        console.log(`[Xpass] No backups variable found in page source.`);
        return [];
      }
      let backups = [];
      try {
        backups = JSON.parse(backupsMatch[1]);
      } catch (e) {
        console.error(`[Xpass] Failed parsing backups JSON:`, e);
        return [];
      }
      console.log(`[Xpass] Found ${backups.length} servers.`);
      for (const backup of backups) {
        try {
          const serverName = backup.name || "Default";
          let serverUrl = backup.url;
          if (!serverUrl)
            continue;
          if (!serverUrl.startsWith("http")) {
            serverUrl = XPASS_API + serverUrl;
          }
          console.log(`[Xpass] Fetching JSON from backup server: ${serverUrl}`);
          const jsonResp = yield fetch(serverUrl, { headers: BASE_HEADERS });
          const data = yield jsonResp.json();
          const playlist = data.playlist || [];
          if (playlist.length === 0)
            continue;
          const sources = playlist[0].sources || [];
          for (const src of sources) {
            const fileUrl = src.file;
            if (!fileUrl || !fileUrl.startsWith("http"))
              continue;
            const isM3u8 = src.type && src.type.toLowerCase().includes("hls") || fileUrl.includes(".m3u8");
            if (isM3u8) {
              const variants = yield generateM3u8(serverName, fileUrl, BASE_HEADERS);
              variants.forEach((v) => {
                streams.push({
                  name: serverName,
                  title: v.quality,
                  url: v.url,
                  quality: v.quality,
                  headers: {
                    "Referer": `${XPASS_API}/`,
                    "User-Agent": BASE_HEADERS["User-Agent"]
                  },
                  provider: "xpass"
                });
              });
            } else {
              streams.push({
                name: serverName,
                title: "Auto",
                url: fileUrl,
                quality: "Auto",
                headers: {
                  "Referer": `${XPASS_API}/`,
                  "User-Agent": BASE_HEADERS["User-Agent"]
                },
                provider: "xpass"
              });
            }
          }
          if (streams.length > 0) {
            console.log(`[Xpass] Found functional stream on ${serverName}, stopping search.`);
            break;
          }
        } catch (srvErr) {
          console.warn(`[Xpass] Failed querying server ${backup.name}:`, srvErr.message);
        }
      }
    } catch (error) {
      console.error(`[Xpass] Unexpected overall error:`, error.message);
    }
    console.log(`[Xpass] Returning ${streams.length} parsed streams.`);
    return streams;
  });
}
module.exports = { getStreams };
