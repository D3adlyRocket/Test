/**
 * FourKHDHub - Refactored for Clean UI and Correct Resolution
 */

// ... (Keep existing __async, __spread, and boilerplate at the top)

// --- REFACTORED UTILITIES ---

function parseQuality(text) {
  const value = (text || "").toLowerCase();
  if (/2160p|4k|uhd/i.test(value)) return "4K";
  if (/1440p/i.test(value)) return "1440p";
  if (/1080p/i.test(value)) return "1080p";
  if (/720p/i.test(value)) return "720p";
  if (/480p/i.test(value)) return "480p";
  return "HD"; // Default to HD instead of Auto for better UI appearance
}

function inferLanguageLabel(text = "") {
  const v = text.toLowerCase();
  if (/\btr\b|turkce|türkçe/.test(v)) return "TR";
  if (/\ben\b|english/.test(v)) return "EN";
  if (v.includes("dual")) return "Dual Audio";
  if (v.includes("dublaj") || v.includes("dubbed")) return "Dubbed";
  if (v.includes("altyazi") || v.includes("sub")) return "Subtitles";
  return "Multi"; // Replaced "Unknown" with "Multi" for a cleaner look
}

function buildDisplayMeta(sourceTitle = "", url = "", quality = "") {
  const source = inferSourceLabel(sourceTitle, url);
  const lang = inferLanguageLabel(sourceTitle);
  
  // Create a clean display title: "Source | Quality | Language"
  return {
    displayName: `${PROVIDER_NAME} - ${quality}`,
    displayTitle: `${source} • ${quality} • ${lang}`
  };
}

// --- UPDATED RESOLVER ---

async function resolveHubcloud(url, sourceTitle, referer) {
  const baseHeaders = referer ? { Referer: referer } : {};
  let entryUrl = url;
  
  if (!/hubcloud\.php/i.test(url)) {
    const html2 = await fetchText(url, { headers: baseHeaders });
    const $2 = import_cheerio_without_node_native2.default.load(html2);
    const raw = $2("#download").attr("href");
    if (!raw) return [];
    entryUrl = fixUrl(raw, url);
  }

  const html = await fetchText(entryUrl, { headers: { Referer: url, ...baseHeaders } });
  const $ = import_cheerio_without_node_native2.default.load(html);
  
  const size = $("i#size").first().text().trim();
  const header = $("div.card-header").first().text().trim();
  
  // Extracting Clean Metadata
  const details = cleanFileDetails(header);
  const quality = parseQuality(header);
  const extraInfo = [details, size].filter(Boolean).join(" | ");

  const streams = [];
  $("a.btn[href]").each((_, el) => {
    const link = fixUrl($(el).attr("href"), entryUrl);
    const text = $(el).text().trim().toLowerCase();
    if (!link) return;

    const sourceName = text.includes("pixel") ? "Pixeldrain" : 
                       text.includes("buzz") ? "BuzzServer" : "Direct";
    
    // Build Clean Stream Object
    const meta = buildDisplayMeta(header, link, quality);
    
    streams.push({
      name: meta.displayName,
      title: `${sourceName} [${extraInfo}]`, // Neater secondary line
      url: link.includes("pixeldrain") && !link.includes("?download") ? `${link}?download` : link,
      quality: quality,
      headers: { Referer: entryUrl }
    });
  });
  return streams;
}

// --- UPDATED buildStream (Fallback) ---
function buildStream(title, url, quality = "HD", headers = {}) {
  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) {
    finalUrl += finalUrl.includes("#") ? "" : "#.mkv";
  }
  
  const q = parseQuality(title) || quality;
  const meta = buildDisplayMeta(title, finalUrl, q);
  
  return {
    name: meta.displayName,
    title: meta.displayTitle,
    url: finalUrl,
    quality: q,
    headers: Object.keys(headers).length ? headers : void 0
  };
}
