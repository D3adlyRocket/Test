"use strict";

// ─── Constants ──────────────────────────────────────────────────────

var SOURCE_NAME = "vidcore.net";
var VIDCORE_BASE = "https://vidcore.net";
var TAG = "VidCore";
var UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
var UA_FALLBACKS = [
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
	"Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];
var HEADERS = {
	"User-Agent": UA,
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.9",
};
var REQUEST_TIMEOUT = 15000; // 15s per request
var ENC_DEC_API = "https://enc-dec.app/api";

// ─── Logging + Failure Helpers (GROUP 1) ──────────────────────────

function logInfo(msg, d) {
	try {
		console.log("[" + TAG + "]", msg, d !== undefined ? d : "");
	} catch (_) {}
}

function logWarn(msg, d) {
	try {
		console.warn("[" + TAG + "]", msg, d !== undefined ? d : "");
	} catch (_) {}
}

function logError(msg, d) {
	try {
		console.error("[" + TAG + "]", msg, d !== undefined ? d : "");
	} catch (_) {}
}

function makeFail(msg, start) {
	return {
		source: SOURCE_NAME,
		status: "error",
		error: msg || "unknown",
		streams: [],
		latency_ms: Date.now() - (start || Date.now()),
	};
}

// ─── HTTP Helpers (GROUP 2) ────────────────────────────────────────

async function httpGet(url, headers) {
	try {
		var raw = await globalThis.http_get(url, headers || HEADERS);
		if (typeof raw === "string") return raw;
		if (raw && raw.body) {
			if (typeof raw.body === "string") return raw.body;
			if (typeof raw.body === "object") return JSON.stringify(raw.body);
		}
		return "";
	} catch (e) {
		throw new Error("httpGet(" + url + "): " + (e.message || e));
	}
}

async function httpGetWithTimeout(url, headers, ms) {
	var label = url && url.length > 50 ? url.substring(0, 50) + "..." : url;
	return await withTimeout(httpGet(url, headers), ms || REQUEST_TIMEOUT, label);
}

function withTimeout(promise, ms, label) {
	var timerId = null;
	var timeoutPromise = new Promise(function (_, reject) {
		timerId = setTimeout(function () {
			timerId = null;
			reject(new Error((label || "request") + " timeout (" + ms + "ms)"));
		}, ms);
	});
	return Promise.race([promise, timeoutPromise]).finally(function () {
		if (timerId !== null) {
			clearTimeout(timerId);
			timerId = null;
		}
	});
}

// ─── Safe JSON + Data Helpers (GROUP 3) ────────────────────────────

function safeJsonParse(str) {
	if (!str || typeof str !== "string") return null;
	try {
		return JSON.parse(str);
	} catch (_) {
		return null;
	}
}

// ─── Quality Helpers (GROUP 4) ─────────────────────────────────────

function extractQuality(url) {
	var u = String(url || "");
	var m = u.match(/(2160p|1440p|1080p|720p|480p|360p)/i);
	if (m) return m[1].toLowerCase();
	if (/\b4k\b/i.test(u)) return "4K";
	return "";
}

function qualityLabel(h) {
	if (h >= 2160) return "2160p";
	if (h >= 1440) return "1440p";
	if (h >= 1080) return "1080p";
	if (h >= 720) return "720p";
	if (h >= 480) return "480p";
	if (h >= 360) return "360p";
	return h ? h + "p" : "Auto";
}

function qualityRank(q) {
	var qs = String(q || "").toLowerCase();
	if (qs.indexOf("2160") !== -1 || qs === "4k") return 7;
	if (qs.indexOf("1440") !== -1 || qs === "2k") return 6;
	if (qs.indexOf("1080") !== -1) return 5;
	if (qs.indexOf("720") !== -1) return 4;
	if (qs.indexOf("480") !== -1) return 3;
	if (qs.indexOf("360") !== -1) return 2;
	if (qs.indexOf("240") !== -1) return 1;
	return 0;
}

// ─── URL Helpers ───────────────────────────────────────────────────

function resolveRelativeUrl(baseUrl, relativePath) {
	if (!baseUrl) return relativePath;
	if (relativePath.indexOf("//") === 0) return "https:" + relativePath;
	if (relativePath.indexOf("/") === 0) {
		var om = baseUrl.match(/^(https?:\/\/[^/]+)/);
		return (om ? om[1] : "") + relativePath;
	}
	var idx = baseUrl.lastIndexOf("/");
	if (idx <= 8) return baseUrl + "/" + relativePath;
	return baseUrl.substring(0, idx + 1) + relativePath;
}

// ─── Stream URL Validation (GROUP 7) ──────────────────────────────

function isValidStreamUrl(url) {
	if (!url || typeof url !== "string") return false;
	if (url.indexOf("https://") !== 0 && url.indexOf("http://") !== 0)
		return false;
	var hostMatch = url.match(/^https?:\/\/([^/]+)/);
	if (!hostMatch || hostMatch[1].length < 3) return false;
	var host = hostMatch[1].toLowerCase();
	if (host === "localhost" || host === "127.0.0.1") return false;
	if (host.indexOf("169.254.") === 0) return false;
	if (host.indexOf("10.") === 0) return false;
	if (host.indexOf("172.") === 0) {
		var parts = host.split(".");
		if (parts.length === 4) {
			var second = parseInt(parts[1], 10);
			if (second >= 16 && second <= 31) return false;
		}
	}
	if (host.indexOf("192.168.") === 0) return false;
	return true;
}

// ─── M3U8 Parser (GROUP 5) ────────────────────────────────────────

function extractCodecs(streamInfLine) {
	var m = streamInfLine.match(/CODECS="([^"]+)"/i);
	return m ? m[1] : "";
}

function codecLabel(codecs) {
	if (!codecs) return "";
	var c = String(codecs).toLowerCase();
	if (c.indexOf("hev1") !== -1 || c.indexOf("hvc1") !== -1) return "HEVC";
	if (c.indexOf("dvh1") !== -1 || c.indexOf("dvhe") !== -1) return "DV";
	if (c.indexOf("av01") !== -1 || c.indexOf("dav1") !== -1) return "AV1";
	if (c.indexOf("avc1") !== -1) return "H.264";
	if (c.indexOf("mp4a") !== -1) return "AAC";
	return codecs;
}

async function parseM3U8Master(playlistUrl, referer) {
	function defaultVariant() {
		return [
			{
				url: playlistUrl,
				quality: extractQuality(playlistUrl) || "Auto",
				height: 0,
				codecLabel: "",
			},
		];
	}

	try {
		var content = await httpGetWithTimeout(
			playlistUrl,
			{
				"User-Agent": UA,
				Accept: "*/*",
				Referer: referer || VIDCORE_BASE + "/",
			},
			10000,
		);

		if (!content || content.indexOf("#EXTM3U") === -1) {
			return {
				variants: defaultVariant(),
				audioTracks: [],
				subtitleTracks: [],
			};
		}

		if (content.indexOf("#EXT-X-STREAM-INF:") === -1) {
			return {
				variants: defaultVariant(),
				audioTracks: [],
				subtitleTracks: [],
			};
		}

		var lines = content.split("\n");
		var variants = [];
		var audioTracks = [];
		var subtitleTracks = [];

		for (var li = 0; li < lines.length; li++) {
			var line = lines[li];

			if (line.indexOf("#EXT-X-STREAM-INF:") !== -1) {
				var resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
				var height = resMatch ? parseInt(resMatch[1], 10) : 0;
				var codecs = extractCodecs(line);
				var cl = codecLabel(codecs);

				for (var ni = li + 1; ni < lines.length; ni++) {
					var urlPart = lines[ni].trim();
					if (urlPart && urlPart.indexOf("#") !== 0) {
						variants.push({
							url:
								urlPart.indexOf("http") === 0
									? urlPart
									: resolveRelativeUrl(playlistUrl, urlPart),
							quality: qualityLabel(height),
							height: height,
							codecLabel: cl,
						});
						break;
					}
				}
			}

			if (line.indexOf("#EXT-X-MEDIA:TYPE=SUBTITLES") !== -1) {
				var subUri = (line.match(/URI="([^"]+)"/) || [])[1];
				if (subUri) {
					subtitleTracks.push({
						url:
							subUri.indexOf("http") === 0
								? subUri
								: resolveRelativeUrl(playlistUrl, subUri),
						language: (line.match(/LANGUAGE="([^"]+)"/) || [])[1] || "en",
						label: (line.match(/NAME="([^"]+)"/) || [])[1] || "Subtitles",
						default: line.indexOf("DEFAULT=YES") !== -1,
					});
				}
			}

			if (line.indexOf("#EXT-X-MEDIA:TYPE=AUDIO") !== -1) {
				var auUri = (line.match(/URI="([^"]+)"/) || [])[1];
				if (auUri) {
					audioTracks.push({
						url:
							auUri.indexOf("http") === 0
								? auUri
								: resolveRelativeUrl(playlistUrl, auUri),
						language: (line.match(/LANGUAGE="([^"]+)"/) || [])[1] || "en",
						label: (line.match(/NAME="([^"]+)"/) || [])[1] || "Audio",
						default: line.indexOf("DEFAULT=YES") !== -1,
					});
				}
			}
		}

		variants.sort(function (a, b) {
			return b.height - a.height;
		});

		if (variants.length === 0) {
			return {
				variants: defaultVariant(),
				audioTracks: audioTracks,
				subtitleTracks: subtitleTracks,
			};
		}

		return {
			variants: variants,
			audioTracks: audioTracks,
			subtitleTracks: subtitleTracks,
		};
	} catch (e) {
		logWarn("parseM3U8Master failed", playlistUrl + ": " + (e.message || e));
		return { variants: defaultVariant(), audioTracks: [], subtitleTracks: [] };
	}
}

// ─── Subtitle Handling (GROUP 8) ──────────────────────────────────

function mapSubtitles(m3u8Subs) {
	var subs = [];
	var seenSubs = {};
	for (var i = 0; i < m3u8Subs.length; i++) {
		var s = m3u8Subs[i];
		if (!s || !s.url) continue;
		if (seenSubs[s.url]) continue;
		seenSubs[s.url] = true;
		subs.push({
			url: s.url,
			label: s.label || s.name || "Subtitles",
			lang: s.language || s.lang || "en",
		});
	}
	if (subs.length > 30) subs = subs.slice(0, 30);
	return subs;
}

// ─── Robust RSC Payload Parsing ────────────────────────────────────

/**
 * Parse Next.js RSC payload from HTML for stream URLs.
 * Handles multiple Next.js versions and string escaping patterns.
 * Returns array of unique stream URLs found.
 */
function extractUrlsFromRscResilient(html) {
	if (!html) return [];
	var urls = [];
	var seen = {};

	function addUrl(u) {
		if (!u || seen[u] || u.length < 20) return;
		seen[u] = true;
		urls.push(u);
	}

	// ── Pattern 1: Standard Next.js 13/14 RSC format ──
	// self.__next_f.push([N, "string data with \"escaped quotes\""])
	var rscPatterns = [
		// Next.js 13+: self.__next_f.push([N, "string"])
		/self\.__next_f\.push\(\[(\d+),\s*"((?:[^"\\]|\\.)*)"\]\)/g,
		// Next.js 14+: self.__next_f.push([N, "string"], [N, "string"]) or array variant
		/self\.__next_f\.push\(\[(\d+),\s*"((?:[^"\\]|\\.)*)"\]/g,
		// Next.js 15+: possibly different format with Uint8Array or different delimiters
		/__next_f\.push\(\[(\d+),\s*"((?:[^"\\]|\\.)*)"\]\)/g,
		// Some versions use single quotes
		/self\.__next_f\.push\(\[\d+,\s*'((?:[^'\\]|\\.)*)'\]\)/g,
		// Fallback: any JSON-looking array in __next_f context
		/__next_f\[["'](\d+)["']\]\s*=\s*["']((?:[^"\\]|\\.)*)["']/g,
		// Alternative: __NEXT_DATA__ format (used in some Next.js versions)
		/<script[^>]*id="__NEXT_DATA__"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g,
	];

	// ── Try all RSC patterns ──
	for (var pi = 0; pi < rscPatterns.length; pi++) {
		var pattern = rscPatterns[pi];
		var match;

		// For __NEXT_DATA__ we handle differently (full JSON)
		if (pi === rscPatterns.length - 1) {
			while ((match = pattern.exec(html)) !== null) {
				try {
					var nextData = JSON.parse(match[1]);
					var props = nextData && nextData.props;
					if (props) {
						extractStreamUrlsFromObject(props, addUrl);
					}
				} catch (_) {}
			}
			continue;
		}

		while ((match = pattern.exec(html)) !== null) {
			var data = match[2];
			// Unescape JSON escape sequences
			data = data.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
			data = data.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

			// Find all http/https URLs
			var urlRe = /https?:\/\/[^"',;)\]}\s<>]+/gi;
			var um;
			while ((um = urlRe.exec(data)) !== null) {
				var u = um[0].replace(/\\/g, "");
				// Filter for streaming-related URLs
				if (
					u.indexOf(".m3u8") !== -1 ||
					u.indexOf(".mp4") !== -1 ||
					u.indexOf("/hls/") !== -1 ||
					u.indexOf("/stream/") !== -1 ||
					u.indexOf("/playlist/") !== -1 ||
					u.indexOf("/manifest") !== -1 ||
					u.indexOf("m3u8") !== -1
				) {
					// Clean up any trailing garbage
					var clean = u.replace(/[^a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=]/g, "");
					if (clean.length > 20) addUrl(clean);
				}
			}
		}
	}

	return urls;
}

function extractStreamUrlsFromObject(obj, addFn) {
	if (!obj || typeof obj !== "object") return;
	if (typeof obj === "string") {
		var m = obj.match(/https?:\/\/[^"'\s,}\]]+\.(?:m3u8|mp4)[^"'\s,}\]]*/i);
		if (m && m[0]) addFn(m[0]);
		return;
	}
	if (Array.isArray(obj)) {
		for (var i = 0; i < obj.length; i++)
			extractStreamUrlsFromObject(obj[i], addFn);
		return;
	}
	var keys = Object.keys(obj);
	for (var ki = 0; ki < keys.length; ki++) {
		var val = obj[keys[ki]];
		if (typeof val === "string") {
			var m2 = val.match(/https?:\/\/[^"'\s,}\]]+\.(?:m3u8|mp4)[^"'\s,}\]]*/i);
			if (m2 && m2[0]) addFn(m2[0]);
		} else if (typeof val === "object") {
			extractStreamUrlsFromObject(val, addFn);
		}
	}
}

// ─── HTML5 Video/Source Tag Parsing ───────────────────────────────

function extractVideoUrlsFromHtml(html) {
	if (!html) return [];
	var urls = [];
	var seen = {};

	function addUrl(u) {
		if (!u || seen[u] || u.length < 20) return;
		seen[u] = true;
		urls.push(u);
	}

	// Pattern 1: <video><source src="..." type="application/x-mpegURL"></video>
	var videoSourceRe =
		/<source[^>]*src=["']([^"']+)["'][^>]*type=["'](?:application\/x-mpegURL|video\/mp4|application\/vnd\.apple\.mpegurl)["'][^>]*>/gi;
	var vm;
	while ((vm = videoSourceRe.exec(html)) !== null) {
		var src = vm[1];
		if (src.indexOf("http") === 0 || src.indexOf("//") === 0) {
			addUrl(src.indexOf("//") === 0 ? "https:" + src : src);
		}
	}

	// Pattern 2: <source src="..." (without type attribute)
	var srcOnlyRe = /<source[^>]*src=["']([^"']+)["']/gi;
	while ((vm = srcOnlyRe.exec(html)) !== null) {
		var src2 = vm[1];
		if (
			(src2.indexOf(".m3u8") !== -1 || src2.indexOf(".mp4") !== -1) &&
			(src2.indexOf("http") === 0 || src2.indexOf("//") === 0)
		) {
			addUrl(src2.indexOf("//") === 0 ? "https:" + src2 : src2);
		}
	}

	// Pattern 3: <video src="...">
	var videoSrcRe = /<video[^>]*src=["']([^"']+)["']/gi;
	while ((vm = videoSrcRe.exec(html)) !== null) {
		var vsrc = vm[1];
		if (
			(vsrc.indexOf(".m3u8") !== -1 || vsrc.indexOf(".mp4") !== -1) &&
			(vsrc.indexOf("http") === 0 || vsrc.indexOf("//") === 0)
		) {
			addUrl(vsrc.indexOf("//") === 0 ? "https:" + vsrc : vsrc);
		}
	}

	// Pattern 4: data-hls or data-src attributes
	var dataAttrRe = /data-(?:hls|src|url|video|stream)=["']([^"']+)["']/gi;
	while ((vm = dataAttrRe.exec(html)) !== null) {
		var ds = vm[1];
		if (
			(ds.indexOf(".m3u8") !== -1 || ds.indexOf(".mp4") !== -1) &&
			(ds.indexOf("http") === 0 || ds.indexOf("//") === 0)
		) {
			addUrl(ds.indexOf("//") === 0 ? "https:" + ds : ds);
		}
	}

	return urls;
}

// ─── Legacy RSC + Script Extraction ────────────────────────────────

function extractUrlsFromRsc(html) {
	// Legacy — kept for backward compatibility
	return extractUrlsFromRscResilient(html);
}

function extractM3U8FromScripts(html) {
	if (!html) return [];
	var results = [];
	var seen = {};

	function addUrl(u) {
		if (!u || seen[u]) return;
		seen[u] = true;
		results.push(u);
	}

	// Direct M3U8 in HTML
	var directRegex = /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi;
	var match;
	while ((match = directRegex.exec(html)) !== null) {
		var url = match[0].trim();
		if (url.length > 20) addUrl(url);
	}

	// Direct MP4 URLs
	var mp4Regex = /https?:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*/gi;
	while ((match = mp4Regex.exec(html)) !== null) {
		var mp4Url = match[0].trim();
		if (mp4Url.length > 20) addUrl(mp4Url);
	}

	// Script tag content
	var scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
	while ((match = scriptRegex.exec(html)) !== null) {
		var scriptContent = match[1];
		var jsonUrlRegex = /https?:\/\/[^"'\s\\,}]+\.(?:m3u8|mp4)[^"'\s\\,}]*/gi;
		var jm;
		while ((jm = jsonUrlRegex.exec(scriptContent)) !== null) {
			var u = jm[0].trim();
			if (u.length > 20) addUrl(u);
		}
		var implicitRe =
			/https?:\/\/[^"'\s<>]+\/(?:hls|stream|playlist|manifest|video|media|cdn)[^"'\s<>]*(?:\?[^"'\s<>]*)?/gi;
		while ((jm = implicitRe.exec(scriptContent)) !== null) {
			var iu = jm[0].trim();
			if (iu.length > 20 && iu.indexOf(".m3u8") === -1) addUrl(iu);
		}
	}

	// Resilient RSC parsing
	var rscUrls = extractUrlsFromRscResilient(html);
	for (var ri = 0; ri < rscUrls.length; ri++) {
		addUrl(rscUrls[ri]);
	}

	// HTML5 video/source tag parsing
	var videoUrls = extractVideoUrlsFromHtml(html);
	for (var vi = 0; vi < videoUrls.length; vi++) {
		addUrl(videoUrls[vi]);
	}

	return results;
}

// ─── API Endpoint Probing ──────────────────────────────────────────

async function tryApiEndpoints(tmdbId, type, season, episode) {
	var sid = encodeURIComponent(String(tmdbId));
	var ssn = encodeURIComponent(String(season || 1));
	var ep = encodeURIComponent(String(episode || 1));
	var isTv = type === "tv";

	var apiPatterns = [
		VIDCORE_BASE + "/api/movie/" + sid,
		VIDCORE_BASE + "/api/tv/" + sid + "/" + ssn + "/" + ep,
		VIDCORE_BASE + "/api/source/" + (isTv ? "tv" : "movie") + "/" + sid,
		VIDCORE_BASE + "/api/stream/" + (isTv ? "tv" : "movie") + "/" + sid,
		VIDCORE_BASE + "/source/" + (isTv ? "tv" : "movie") + "/" + sid,
		VIDCORE_BASE + "/stream/" + (isTv ? "tv" : "movie") + "/" + sid,
		"https://vcore.pro/api/source/" + (isTv ? "tv" : "movie") + "/" + sid,
		"https://www.vcore.pro/api/source/" + (isTv ? "tv" : "movie") + "/" + sid,
		// Additional patterns for different vidcore deployments
		VIDCORE_BASE + "/api/v1/movie/" + sid,
		VIDCORE_BASE + "/api/v1/tv/" + sid + "/" + ssn + "/" + ep,
		VIDCORE_BASE + "/api/v2/movie/" + sid,
		VIDCORE_BASE + "/api/v2/tv/" + sid + "/" + ssn + "/" + ep,
	];

	for (var i = 0; i < apiPatterns.length; i++) {
		try {
			var resp = await httpGetWithTimeout(
				apiPatterns[i],
				{
					"User-Agent": UA,
					Accept: "application/json,text/plain,*/*",
					Referer: VIDCORE_BASE + "/",
				},
				8000,
			);

			if (!resp || resp.length < 10) continue;

			// Skip HTML responses (likely not an API endpoint)
			if (resp.indexOf("<!DOCTYPE") !== -1 || resp.indexOf("<html") !== -1) {
				continue;
			}

			var data = safeJsonParse(resp);
			if (data) {
				var urls = [];
				if (data.url) urls.push(data.url);
				if (data.stream)
					urls.push(
						typeof data.stream === "string" ? data.stream : data.stream.url,
					);
				if (data.sources && Array.isArray(data.sources)) {
					for (var si = 0; si < data.sources.length; si++) {
						if (data.sources[si].url) urls.push(data.sources[si].url);
						if (data.sources[si].file) urls.push(data.sources[si].file);
					}
				}
				if (data.playlist) urls.push(data.playlist);
				if (data.result && data.result.sources) {
					for (var ri = 0; ri < data.result.sources.length; ri++) {
						if (data.result.sources[ri].url)
							urls.push(data.result.sources[ri].url);
						if (data.result.sources[ri].file)
							urls.push(data.result.sources[ri].file);
					}
				}

				for (var ui = 0; ui < urls.length; ui++) {
					if (
						urls[ui] &&
						typeof urls[ui] === "string" &&
						(urls[ui].indexOf(".m3u8") !== -1 ||
							urls[ui].indexOf(".mp4") !== -1) &&
						(urls[ui].indexOf("https://") === 0 ||
							urls[ui].indexOf("http://") === 0)
					) {
						return urls[ui];
					}
				}

				for (var fi = 0; fi < urls.length; fi++) {
					if (
						urls[fi] &&
						typeof urls[fi] === "string" &&
						(urls[fi].indexOf("https://") === 0 ||
							urls[fi].indexOf("http://") === 0)
					) {
						return urls[fi];
					}
				}
			}

			// Find M3U8 in raw text response
			var m3u8Match = resp.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
			if (m3u8Match && m3u8Match[0]) {
				return m3u8Match[0];
			}
		} catch (e) {
			logWarn("tryApiEndpoints", apiPatterns[i] + ": " + (e.message || e));
		}
	}
	return null;
}

// ─── Proxy Fallback ────────────────────────────────────────────────

/**
 * Try enc-dec.app or other proxy APIs as fallback when direct scraping fails.
 */
async function tryProxyFallback(tmdbId, type, season, episode) {
	var isTv = type === "tv" || type === "series";
	var sid = encodeURIComponent(String(tmdbId));

	var proxyPatterns = [
		ENC_DEC_API + "/vidcore/movie/" + sid,
		ENC_DEC_API +
			"/vidcore/tv/" +
			sid +
			"/" +
			(season || 1) +
			"/" +
			(episode || 1),
		"https://embed.su/api/e/" + sid,
		"https://vidlink.pro/api/movie/" + sid,
		"https://vidlink.pro/api/tv/" +
			sid +
			"/" +
			(season || 1) +
			"/" +
			(episode || 1),
	];

	for (var i = 0; i < proxyPatterns.length; i++) {
		try {
			var resp = await httpGetWithTimeout(
				proxyPatterns[i],
				{
					"User-Agent": UA,
					Accept: "application/json,text/plain,*/*",
				},
				10000,
			);

			if (!resp || resp.length < 10) continue;
			if (resp.indexOf("<!DOCTYPE") !== -1 || resp.indexOf("<html") !== -1)
				continue;

			var data = safeJsonParse(resp);
			if (!data) {
				// Try raw URL extraction
				var m3u8Match = resp.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/i);
				if (m3u8Match && m3u8Match[0]) return m3u8Match[0];
				continue;
			}

			// Handle different response formats
			var urls = [];
			if (data.url) urls.push(data.url);
			if (data.stream) {
				if (typeof data.stream === "string") urls.push(data.stream);
				else if (data.stream.url) urls.push(data.stream.url);
			}
			if (data.sources && Array.isArray(data.sources)) {
				for (var si = 0; si < data.sources.length; si++) {
					var src = data.sources[si];
					if (src.url) urls.push(src.url);
					if (src.file) urls.push(src.file);
					if (typeof src === "string" && src.indexOf("http") === 0)
						urls.push(src);
				}
			}
			if (data.source && data.source.url) urls.push(data.source.url);
			if (data.result && data.result.url) urls.push(data.result.url);

			for (var ui = 0; ui < urls.length; ui++) {
				var u = urls[ui];
				if (
					u &&
					typeof u === "string" &&
					(u.indexOf(".m3u8") !== -1 || u.indexOf(".mp4") !== -1) &&
					(u.indexOf("https://") === 0 || u.indexOf("http://") === 0)
				) {
					return u;
				}
			}
		} catch (e) {
			logWarn("proxyFallback", proxyPatterns[i] + ": " + (e.message || e));
		}
	}
	return null;
}

// ─── User-Agent Rotation Self-Healing ─────────────────────────────

async function fetchWithDifferentUAs(url, headers) {
	var allUAs = [UA].concat(UA_FALLBACKS);
	var errors = [];

	for (var ui = 0; ui < allUAs.length; ui++) {
		try {
			var customHeaders = {};
			for (var k in headers) {
				if (Object.prototype.hasOwnProperty.call(headers, k))
					customHeaders[k] = headers[k];
			}
			customHeaders["User-Agent"] = allUAs[ui];

			var resp = await httpGetWithTimeout(url, customHeaders, 10000);
			if (resp && resp.length > 100) {
				return resp;
			}
		} catch (e) {
			errors.push(allUAs[ui] + ": " + (e.message || e));
		}
	}
	return null;
}

// ─── Structured Error Logging ─────────────────────────────────────

var _parseLog = [];

function logParseStep(step, success, detail) {
	_parseLog.push({
		step: step,
		success: success,
		detail: detail || "",
		timestamp: Date.now(),
	});
}

function summarizeParseLog() {
	var lines = [];
	for (var i = 0; i < _parseLog.length; i++) {
		var entry = _parseLog[i];
		lines.push(
			entry.step +
				": " +
				(entry.success ? "OK" : "FAIL") +
				(entry.detail ? " (" + entry.detail + ")" : ""),
		);
	}
	return lines.join(" | ");
}

function clearParseLog() {
	_parseLog = [];
}

// ─── Main Scrape (GROUP 8 - Export) ────────────────────────────────

async function scrapeStreams(params) {
	var start = Date.now();

	if (!params || !params.tmdbId) return makeFail("no tmdbId provided", start);

	var tmdbId = String(params.tmdbId);
	var type = params.type === "tv" || params.type === "series" ? "tv" : "movie";
	var season = parseInt(params.season, 10) || 1;
	var episode = parseInt(params.episode, 10) || 1;

	logInfo("scrapeStreams", type + " " + tmdbId + " S" + season + "E" + episode);
	clearParseLog();

	try {
		var allStreams = [];
		var errors = [];

		// ─── Step 1: Try API endpoints ───
		logParseStep("api_endpoints", false, "starting");
		var apiUrl = await tryApiEndpoints(tmdbId, type, season, episode);
		if (apiUrl) {
			logParseStep("api_endpoints", true, apiUrl.substring(0, 80) + "...");
			logInfo("API endpoint returned URL", apiUrl);
			var parsed = await parseM3U8Master(apiUrl, VIDCORE_BASE + "/");
			var subs = mapSubtitles(parsed.subtitleTracks);

			for (var vi = 0; vi < parsed.variants.length; vi++) {
				var v = parsed.variants[vi];
				var streamObj = {
					url: v.url,
					quality: v.quality,
					type: "hls",
					headers: {
						"User-Agent": UA,
						Referer: VIDCORE_BASE + "/",
					},
				};
				if (subs.length > 0) streamObj.subtitles = subs;
				allStreams.push(streamObj);
			}

			allStreams.push({
				url: apiUrl,
				quality: "Auto",
				type: "hls",
				headers: { "User-Agent": UA, Referer: VIDCORE_BASE + "/" },
			});
		} else {
			logParseStep("api_endpoints", false, "no endpoint returned URL");
		}

		// ─── Step 2: Fetch embed page and extract stream URLs ───
		if (allStreams.length === 0) {
			logParseStep("embed_page", false, "starting");
			var embedUrl =
				type === "tv"
					? VIDCORE_BASE +
						"/tv/" +
						encodeURIComponent(tmdbId) +
						"/" +
						encodeURIComponent(String(season)) +
						"/" +
						encodeURIComponent(String(episode))
					: VIDCORE_BASE + "/movie/" + encodeURIComponent(tmdbId);

			logInfo("Fetching embed page", embedUrl);
			var embedHtml = await fetchWithDifferentUAs(embedUrl, {
				Referer: VIDCORE_BASE + "/",
				Accept: "text/html,application/xhtml+xml",
			});

			if (embedHtml && embedHtml.length > 100) {
				logParseStep("embed_page", true, embedHtml.length + " chars");

				var m3u8Urls = extractM3U8FromScripts(embedHtml);
				logParseStep(
					"rsc_parse",
					m3u8Urls.length > 0,
					m3u8Urls.length + " URL(s) found",
				);

				if (m3u8Urls.length > 0) {
					logInfo("Found stream URLs in embed page", m3u8Urls.length);
					for (var mi = 0; mi < m3u8Urls.length; mi++) {
						var mu = m3u8Urls[mi];
						var parsed2 = await parseM3U8Master(mu, embedUrl);
						var subs2 = mapSubtitles(parsed2.subtitleTracks);

						for (var vi2 = 0; vi2 < parsed2.variants.length; vi2++) {
							var v2 = parsed2.variants[vi2];
							var s2 = {
								url: v2.url,
								quality: v2.quality || "Auto",
								type: "hls",
								headers: { "User-Agent": UA, Referer: embedUrl },
							};
							if (subs2.length > 0) s2.subtitles = subs2;
							allStreams.push(s2);
						}

						allStreams.push({
							url: mu,
							quality: "Auto",
							type: "hls",
							headers: { "User-Agent": UA, Referer: embedUrl },
						});
					}
				} else {
					errors.push(
						"no M3U8 found in embed page (" + embedHtml.length + " chars)",
					);
					logParseStep("embed_extract", false, "no URLs in page");
				}
			} else {
				errors.push("embed page empty or unreachable");
				logParseStep(
					"embed_page",
					false,
					"empty or unreachable (" +
						(embedHtml ? embedHtml.length : 0) +
						" chars)",
				);
			}
		}

		// ─── Step 3: Try alternate domains ───
		if (allStreams.length === 0) {
			logParseStep("alt_domains", false, "starting");
			var altDomains = ["https://vcore.pro"];
			for (var di = 0; di < altDomains.length; di++) {
				var altBase = altDomains[di];
				var altUrl =
					type === "tv"
						? altBase +
							"/tv/" +
							encodeURIComponent(tmdbId) +
							"/" +
							encodeURIComponent(String(season)) +
							"/" +
							encodeURIComponent(String(episode))
						: altBase + "/movie/" + encodeURIComponent(tmdbId);

				try {
					logInfo("Trying alt domain", altUrl);
					var altHtml = await fetchWithDifferentUAs(altUrl, {
						Referer: altBase + "/",
						Accept: "text/html,application/xhtml+xml",
					});

					if (altHtml && altHtml.length > 100) {
						logParseStep(
							"alt_domains",
							true,
							altBase + ": " + altHtml.length + " chars",
						);
						var altM3u8Urls = extractM3U8FromScripts(altHtml);
						for (var ai = 0; ai < altM3u8Urls.length; ai++) {
							var au = altM3u8Urls[ai];
							var parsed3 = await parseM3U8Master(au, altUrl);
							var subs3 = mapSubtitles(parsed3.subtitleTracks);

							for (var vi3 = 0; vi3 < parsed3.variants.length; vi3++) {
								var v3 = parsed3.variants[vi3];
								var s3 = {
									url: v3.url,
									quality: v3.quality || "Auto",
									type: "hls",
									headers: { "User-Agent": UA, Referer: altUrl },
								};
								if (subs3.length > 0) s3.subtitles = subs3;
								allStreams.push(s3);
							}

							allStreams.push({
								url: au,
								quality: "Auto",
								type: "hls",
								headers: { "User-Agent": UA, Referer: altUrl },
							});
						}
					}
				} catch (e) {
					errors.push(altBase + ": " + (e.message || "error"));
					logWarn("Alt domain failed", altBase + ": " + (e.message || e));
				}
			}
		}

		// ─── Step 4: Try proxy fallback ───
		if (allStreams.length === 0) {
			logParseStep("proxy_fallback", false, "starting");
			var proxyUrl = await tryProxyFallback(tmdbId, type, season, episode);
			if (proxyUrl) {
				logParseStep("proxy_fallback", true, proxyUrl.substring(0, 80) + "...");
				logInfo("Proxy fallback returned URL", proxyUrl);
				var parsed4 = await parseM3U8Master(proxyUrl, VIDCORE_BASE + "/");
				var subs4 = mapSubtitles(parsed4.subtitleTracks);

				for (var vi4 = 0; vi4 < parsed4.variants.length; vi4++) {
					var v4 = parsed4.variants[vi4];
					var s4 = {
						url: v4.url,
						quality: v4.quality || "Auto",
						type: "hls",
						headers: { "User-Agent": UA, Referer: VIDCORE_BASE + "/" },
					};
					if (subs4.length > 0) s4.subtitles = subs4;
					allStreams.push(s4);
				}

				allStreams.push({
					url: proxyUrl,
					quality: "Auto",
					type: "hls",
					headers: { "User-Agent": UA, Referer: VIDCORE_BASE + "/" },
				});
			} else {
				logParseStep("proxy_fallback", false, "no URL returned");
			}
		}

		// ─── Final dedup, validate, sort ───
		var seenUrls = {};
		var deduped = [];
		for (var i = 0; i < allStreams.length; i++) {
			var s = allStreams[i];
			if (!s || !s.url) continue;
			if (seenUrls[s.url]) continue;
			if (!isValidStreamUrl(s.url)) continue;

			if (s.subtitles && s.subtitles.length > 1) {
				var subSeen = {};
				var subsDeduped = [];
				for (var j = 0; j < s.subtitles.length; j++) {
					var sub = s.subtitles[j];
					if (!sub || !sub.url || subSeen[sub.url]) continue;
					subSeen[sub.url] = true;
					subsDeduped.push(sub);
				}
				if (subsDeduped.length > 30) subsDeduped = subsDeduped.slice(0, 30);
				s.subtitles = subsDeduped;
			}

			seenUrls[s.url] = true;
			deduped.push(s);
		}

		deduped.sort(function (a, b) {
			var qa = qualityRank(a.quality);
			var qb = qualityRank(b.quality);
			if (qb !== qa) return qb - qa;
			return 0;
		});

		if (deduped.length === 0) {
			var parseSummary = summarizeParseLog();
			logWarn("scrapeStreams failed: " + parseSummary);
			return {
				source: SOURCE_NAME,
				status: "no_streams",
				error: errors.length > 0 ? errors.join("; ") : "no streams found",
				streams: [],
				latency_ms: Date.now() - start,
			};
		}

		logInfo(
			"Returning " +
				deduped.length +
				" streams [" +
				summarizeParseLog() +
				"] in " +
				(Date.now() - start) +
				"ms",
		);
		return {
			source: SOURCE_NAME,
			status: "working",
			streams: deduped,
			latency_ms: Date.now() - start,
		};
	} catch (e) {
		logError("scrapeStreams failed", e && e.message);
		return makeFail(e && e.message ? e.message : String(e), start);
	}
}

module.exports = { getStreams };
