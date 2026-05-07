var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var LOCAL_URL = "http://192.168.1.176:8080/cookie.txt";
var API_BASE = "https://febapi.nuvioapp.space/api";

function getStreams(tmdbId, type, s, e) {
    return fetch(LOCAL_URL)
        .then(res => res.text())
        .then(token => {
            const uiToken = token.trim();
            if (!uiToken) return [];

            // STEP 1: Get the FebBox/ShowBox Internal ID (Mapping)
            // type 1 = movie, type 2 = tv
            const boxType = (type === 'tv') ? 2 : 1;
            const idUrl = `${API_BASE}/febbox/id?id=${tmdbId}&type=${boxType}`;

            return fetch(idUrl, {
                headers: { 'Cookie': `ui=${uiToken}`, 'User-Agent': 'Mozilla/5.0' }
            })
            .then(res => res.json())
            .then(data => {
                const shareKey = data.share_key || data.id;
                if (!shareKey) return [];

                // STEP 2: Get the actual links for this shareKey
                const listUrl = `${API_BASE}/febbox/files/${shareKey}`;
                return fetch(listUrl, {
                    headers: { 'Cookie': `ui=${uiToken}`, 'User-Agent': 'Mozilla/5.0' }
                });
            })
            .then(res => res.json())
            .then(fileData => {
                // If the array is empty, the cookie is likely expired or invalid
                if (!fileData || !fileData.list) return [];

                return fileData.list.map(file => ({
                    name: `ShowBox ${file.quality || 'HD'}`,
                    url: file.url, // Note: some versions need a 3rd step to fetch the final URL
                    quality: file.quality || "HD",
                    provider: "ShowBox-Repo-Logic"
                }));
            });
        })
        .catch(() => []);
}

global.getStreams = getStreams;
