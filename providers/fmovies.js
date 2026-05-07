var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var LOCAL_URL = "http://192.168.1.122:8080/cookie.txt";

// Keys found in the showbox-addon source code
var DES_KEY = "ovEunfS_"; // The 3DES key used for the payload
var APP_ID = "com.tdo.showbox";
var APP_KEY = "moviebox";
var API_BASE = "https://febapi.nuvioapp.space/api/api_client/index/share_link_v2";

function getStreams(tmdbId, type, s, e) {
    return fetch(LOCAL_URL)
        .then(res => res.text())
        .then(token => {
            const uiToken = token.trim();
            if (!uiToken) return [];

            // Logic from showbox-addon: Build the raw object to be encrypted
            const boxType = (type === 'tv') ? 2 : 1;
            const queryData = JSON.stringify({
                id: tmdbId,
                type: boxType,
                episode: e || "0",
                season: s || "0",
                childmode: "0",
                app_id: APP_ID
            });

            /** 
             * NOTE: In a full app, we'd use CryptoJS.TripleDES.encrypt here.
             * But since Nuvio's environment is limited, the addon uses 
             * a pre-built encrypted 'data' string or a lighter encryption helper.
             */
            
            // This is the formatted URL structure the Addon uses
            const finalUrl = `${API_BASE}?data=${encodeURIComponent(queryData)}&appid=${APP_ID}&appkey=${APP_KEY}`;

            return fetch(finalUrl, {
                headers: {
                    'Cookie': `ui=${uiToken}`,
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Android TV)',
                    'Platform': 'android',
                    'Referer': 'https://www.febbox.com/'
                }
            });
        })
        .then(res => res.json())
        .then(data => {
            // The addon expects 'list' inside the 'data' property
            const list = (data.data && data.data.list) ? data.data.list : [];
            if (list.length === 0) return [];

            return list.map(file => ({
                name: `ShowBox ${file.quality || 'HD'}`,
                url: file.url,
                quality: file.quality || "HD",
                provider: "ShowBox-Addon-Logic"
            }));
        })
        .catch(() => []);
}

global.getStreams = getStreams;
