// provider.js
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { URL } = require('url');

let MAIN_URL = 'https://cinemalux.pro';
const URLS_JSON = 'https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json';

async function fetchText(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.text();
}

async function fetchDocument(url, opts = {}) {
  const absoluteUrl = new URL(url, MAIN_URL).toString();
  const txt = await fetchText(absoluteUrl, opts);
  return cheerio.load(txt);
}

async function initMainUrl() {
  try {
    const text = await fetchText(URLS_JSON);
    const json = JSON.parse(text || '{}');
    const u = json.cinemaluxe;
    if (u && u.length) MAIN_URL = u;
  } catch (e) {
    // keep default
  }
}
initMainUrl();

async function getTitleFromImdbId(imdbId) {
    const url = `https://www.imdb.com/title/${imdbId}/`;
    const $ = await fetchDocument(url);
    const title = $('head > title').text().replace(' - IMDb', '').trim();
    return title;
}

async function makePostRequest(jsonString, url, action) {
  let item;
  try {
    item = JSON.parse(jsonString);
  } catch (e) {
    const cleaned = jsonString.replace(/^\s*var\s+\w+\s*=\s*/, '').replace(/;$/, '');
    item = JSON.parse(cleaned);
  }
  const params = new URLSearchParams();
  params.append('token', item.token || '');
  params.append('id', item.id != null ? String(item.id) : '');
  params.append('time', item.time != null ? String(item.time) : '');
  params.append('post', item.post || '');
  params.append('redirect', item.redirect || '');
  params.append('cacha', item.cacha || '');
  params.append('new', item.new ? 'true' : 'false');
  params.append('link', item.link || '');
  params.append('action', action || '');

  const res = await fetch(url, {
    method: 'POST',
    body: params.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual'
  });
  const loc = res.headers.get('location') || '';
  return loc;
}

async function bypass(url) {
  try {
    const text = await fetchText(url);
    const m = /link":"([^"]+)"/.exec(text);
    if (m && m[1]) {
      const enc = m[1].replace(/\\\//g, '/');
      try {
        const decoded = Buffer.from(enc, 'base64').toString('utf8');
        if (decoded) return decoded;
      } catch (e) {
        // fallback
      }
    }

    const postUrlMatch = /"soralink_ajaxurl":"([^"]+)"/.exec(text);
    const jsonDataMatch = /var\s+item\s*=\s*(\{.*?\});/s.exec(text);
    const soraLinkMatch = /"soralink_z"\s*:\s*"([^"]+)"/.exec(text);

    if (postUrlMatch && jsonDataMatch && soraLinkMatch) {
      const postUrl = postUrlMatch[1].replace(/\\\//g, '/');
      const jsonData = jsonDataMatch[1];
      const action = soraLinkMatch[1];
      try {
        const location = await makePostRequest(jsonData, postUrl, action);
        return location || url;
      } catch (e) {
        return url;
      }
    }

    return url;
  } catch (e) {
    return url;
  }
}

function elementToSearchResult(el, $, type) {
  const img = $(el).find('img');
  const title = img.attr('alt') || $(el).find('.title').text().trim();
  const href = $(el).find('a').attr('href') || '';
  const poster = img.attr('data-src') || img.attr('src') || null;
  if (!title || !href) return null;
  return {
    id: new URL(href, MAIN_URL).toString(),
    title: title.trim(),
    poster,
    type: type
  };
}

async function getMainPage(categoryPath, page = 1) {
    const url = new URL(categoryPath, MAIN_URL).toString();
    const $ = await fetchDocument(url);
    const home = [];
    $('article.item').each((i, el) => {
        const title = $(el).find('img').attr('alt') || $(el).find('.title').text().trim();
        const href = $(el).find('a').attr('href') || '';
        const poster = $(el).find('img').attr('data-src') || $(el).find('img').src || null;
        if (title && href) {
            home.push({
                id: new URL(href, MAIN_URL).toString(),
                name: title.trim(),
                poster
            });
        }
    });
    return { name: categoryPath, items: home };
}

async function search(query, page = 1) {
    const url = `${MAIN_URL}/page/${page}/?s=${encodeURIComponent(query)}`;
    const $ = await fetchDocument(url);
    const results = [];
    $('div.result-item').each((i, el) => {
        const href = $(el).find('a').attr('href') || '';
        const type = href.includes('/series/') ? 'series' : 'movie';
        const r = elementToSearchResult(el, $, type);
        if (r) results.push(r);
    });
    return { results };
}

async function load(url) {
  const $ = await fetchDocument(url);
  const title = $('div.data > h1').text().trim() || $('title').text().trim();
  const poster = $('div.poster > img').attr('data-src') || $('div.poster > img').attr('src') || null;
  const description = $('div.wp-content > p').text().trim() || '';

  const isSeries = url.includes('series');

  if (isSeries) {
    const episodes = [];
    $('div.wp-content div.ep-button-container > a').each((i, el) => {
        const href = $(el).attr('href');
        const name = $(el).text().trim();
        if (href) {
            episodes.push({
                id: new URL(href, MAIN_URL).toString(),
                title: name,
                released: new Date()
            });
        }
    });

    return {
      id: url,
      title,
      poster,
      description,
      type: 'series',
      videos: episodes
    };
  } else {
    // For movies, we will return the stream directly
    return {
      id: url,
      title,
      poster,
      description,
      type: 'movie'
    };
  }
}


async function resolveStreams(id) {
  if (/\.m3u8($|\?)/i.test(id) || /\.mp4($|\?)/i.test(id)) {
    return [{ url: id, quality: 'auto', isM3U8: /\.m3u8/i.test(id) }];
  }
  try {
    const bypassedUrl = await bypass(id);
    const $ = await fetchDocument(bypassedUrl);
    const streams = [];

    $('video source').each((i, s) => {
      const src = $(s).attr('src');
      const label = $(s).attr('label') || $(s).attr('data-res') || '';
      if (src) {
        streams.push({ url: new URL(src, MAIN_URL).toString(), quality: label || 'auto', isM3U8: /\.m3u8/i.test(src) });
      }
    });

    $('iframe').each((i, f) => {
      const src = $(f).attr('src');
      if (!src) return;
      const full = new URL(src, MAIN_URL).toString();
      streams.push({ url: full, quality: 'auto', isM3U8: /\.m3u8/i.test(full) });
    });

    const dataSrc = $('.player').attr('data-src') || '';
    if (dataSrc) {
      try {
        const decoded = Buffer.from(dataSrc, 'base64').toString('utf8');
        const matches = decoded.match(/https?:\/\/[^'"\s]+(?:m3u8|mp4)/g) || [];
        for (const u of matches) streams.push({ url: u, quality: 'auto', isM3U8: /\.m3u8/i.test(u) });
      } catch (e) {
        // ignore
      }
    }

    $('a').each((i, a) => {
      const href = $(a).attr('href') || '';
      if (/player|watch|embed|link/i.test(href) || /\.php\?id=/.test(href)) {
        streams.push({ url: new URL(href, MAIN_URL).toString(), quality: 'auto', isM3U8: /\.m3u8/i.test(href) });
      }
    });

    const seen = new Set();
    const out = [];
    for (const s of streams) {
      if (!s.url) continue;
      const urlStr = s.url.toString();
      if (seen.has(urlStr)) continue;
      seen.add(urlStr);
      out.push(s);
    }

    if (out.length > 0) {
        return out;
    } else {
        //if no streams found, return the bypassed url
        return [{ url: bypassedUrl, quality: 'auto', isM3U8: /\.m3u8/i.test(bypassedUrl) }];
    }


  } catch (e) {
    return [{ url: id, quality: 'auto', isM3U8: /\.m3u8/i.test(id) }];
  }
}

module.exports = {
  getMainPage,
  search,
  meta: load,
  stream: resolveStreams,
  getTitleFromImdbId
};
