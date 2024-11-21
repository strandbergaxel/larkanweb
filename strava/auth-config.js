export default function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Return the Strava configuration from environment variables
    res.status(200).json({
        clientId: process.env.STRAVA_CLIENT_ID,
        redirectUri: process.env.STRAVA_REDIRECT_URI
    });
}