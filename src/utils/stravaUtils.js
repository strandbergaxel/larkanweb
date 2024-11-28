let cachedToken = null;
let tokenExpiration = null;

async function getStravaAccessToken(fetch) {
    try {
        if (cachedToken && tokenExpiration && Date.now() < tokenExpiration) {
            return cachedToken;
        }

        const body = {
            client_id: parseInt(process.env.STRAVA_CLIENT_ID, 10),
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: process.env.STRAVA_REFRESH_TOKEN
        };

        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Token request failed: ${response.status}`);
        }

        const data = await response.json();
        cachedToken = data.access_token;
        tokenExpiration = Date.now() + (data.expires_in - 300) * 1000;
        
        return cachedToken;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    getStravaAccessToken
}; 