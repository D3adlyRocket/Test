/**
 * FourKHDHub - Final Resolution Fix
 * Focus: Force resolution into the 'title' string and improve regex matching.
 */

// ... (previous boilerplate remains the same)

function parseQuality(text) {
  const value = (text || "").toLowerCase();
  // Improved regex to catch more variations found in filenames
  if (/2160p|4k|uhd|ultrahd/i.test(value)) return "4K";
  if (/1440p|2k/i.test(value)) return "1440p";
  if (/1080p|fhd/i.test(value)) return "1080p";
  if (/720p|hd/i.test(value)) return "720p";
  if (/480p|sd/i.test(value)) return "480p";
  return "Auto";
}

// UPDATED: This function now injects the Quality directly into the displayTitle
function buildDisplayMeta(sourceTitle = "", url = "") {
  const source = inferSourceLabel(sourceTitle, url);
  const lang = inferLanguageLabel(sourceTitle);
  const quality = parseQuality(sourceTitle);
  
  return {
    displayName: `${PROVIDER_NAME} - ${lang}`,
    // By putting Quality here, it is guaranteed to show in the UI list
    displayTitle: `${source} | ${quality} | ${lang}`
  };
}

function buildStream(title, url, quality = "Auto", headers = {}) {
  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) {
    finalUrl += finalUrl.includes("#") ? "" : "#.mkv";
  }
  
  const parsed = parseQuality(title);
  const finalQuality = parsed !== "Auto" ? parsed : quality;
  const meta = buildDisplayMeta(title, finalUrl);

  return {
    name: meta.displayName,
    title: meta.displayTitle, // The UI "Title" now contains the resolution string
    url: finalUrl,
    quality: finalQuality,    // The UI "Badge" uses this property
    headers: Object.keys(headers).length ? headers : void 0
  };
}

// ... (Rest of the scraping logic remains identical)

function resolveHubcloud(url, sourceTitle, referer) {
  return __async(this, null, function* () {
    const baseHeaders = referer ? { Referer: referer } : {};
    let entryUrl = url;
    if (!/hubcloud\.php/i.test(url)) {
      const html2 = yield fetchText(url, { headers: baseHeaders });
      const $2 = import_cheerio_without_node_native2.default.load(html2);
      const raw = $2("#download").attr("href");
      if (!raw) return [];
      entryUrl = fixUrl(raw, url);
    }
    const html = yield fetchText(entryUrl, { headers: __spreadValues({ Referer: url }, baseHeaders) });
    const $ = import_cheerio_without_node_native2.default.load(html);
    const size = $("i#size").first().text().trim();
    // CRITICAL: We grab the header here as it usually contains the "4K" or "1080p" string
    const header = $("div.card-header").first().text().trim() || sourceTitle;
    const details = cleanFileDetails(header);
    const quality = parseQuality(header);
    const extras = [details, size].filter(Boolean).join(" | ");
    const streams = [];
    
    $("a.btn[href]").each((_, el) => {
      const link = fixUrl($(el).attr("href"), entryUrl);
      const text = $(el).text().trim().toLowerCase();
      if (!link) return;
      
      // We pass the 'header' (which has the resolution) into buildStream
      if (text.includes("buzzserver")) {
        streams.push(buildStream(`${header} - BuzzServer`, link, quality, { Referer: entryUrl }));
        return;
      }
      if (text.includes("pixel") || text.includes("pixeldrain")) {
        streams.push(buildStream(`${header} - Pixeldrain`, link, quality, { Referer: entryUrl }));
        return;
      }
      // Default fallback
      streams.push(buildStream(header, link, quality, { Referer: entryUrl }));
    });
    return streams;
  });
}

// ... (Rest of the file)
