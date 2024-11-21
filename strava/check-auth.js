export default function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Check if user has valid Strava token in session/cookies
    // This is a placeholder - implement your actual auth check logic
    const isAuthenticated = false; // Default to false unless proven otherwise

    res.status(200).json({ isAuthenticated });
}