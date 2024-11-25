const express = require('express');
const router = express.Router();

// Strava API credentials from environment variables
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI;
const STRAVA_CLUB_ID = process.env.STRAVA_CLUB_ID;

// Check authentication status
router.get('/check-auth', async (req, res) => {
    try {
        console.log('Checking auth status:', {
            hasToken: !!req.session.stravaAccessToken,
            sessionData: req.session
        });

        // Check if we have a token
        if (!req.session.stravaAccessToken) {
            return res.json({ isAuthenticated: false });
        }

        // Verify token is valid by making a test API call
        const response = await fetch('https://www.strava.com/api/v3/athlete', {
            headers: {
                'Authorization': `Bearer ${req.session.stravaAccessToken}`
            }
        });

        const isAuthenticated = response.ok;
        console.log('Auth check result:', { isAuthenticated, status: response.status });

        res.json({ isAuthenticated });
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(500).json({ error: 'Authentication check failed', details: error.message });
    }
});

// Provide Strava authentication configuration
router.get('/auth-config', (req, res) => {
    try {
        if (!STRAVA_CLIENT_ID || !STRAVA_REDIRECT_URI) {
            throw new Error('Missing Strava configuration');
        }
        res.json({
            clientId: STRAVA_CLIENT_ID,
            redirectUri: STRAVA_REDIRECT_URI
        });
    } catch (error) {
        console.error('Config retrieval failed:', error);
        res.status(500).json({ error: 'Could not retrieve Strava configuration' });
    }
});

// Handle Strava OAuth callback
router.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;
        console.log('Received authorization code:', code);

        const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: STRAVA_CLIENT_ID,
                client_secret: STRAVA_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
            }),
        });

        const tokenData = await tokenResponse.json();
        console.log('Received token data:', tokenData);
        
        // Store tokens and athlete info in session
        req.session.stravaAccessToken = tokenData.access_token;
        req.session.stravaRefreshToken = tokenData.refresh_token;
        req.session.stravaTokenExpiry = tokenData.expires_at;
        req.session.athlete = tokenData.athlete;

        res.send(`
            <script>
                window.opener.location.reload();
                window.close();
            </script>
        `);
    } catch (error) {
        console.error('Strava callback failed:', error);
        res.send(`
            <script>
                window.opener.location.href = '/strava-data?error=auth_failed';
                window.close();
            </script>
        `);
    }
});

// Update the personal stats route to group by activity type
router.get('/personal-stats', async (req, res) => {
    try {
        if (!req.session.stravaAccessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Fetch activities for the last 2 weeks to compare
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const response = await fetch(
            `https://www.strava.com/api/v3/athlete/activities?after=${Math.floor(twoWeeksAgo.getTime() / 1000)}`,
            {
                headers: {
                    'Authorization': `Bearer ${req.session.stravaAccessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch activities');
        }

        const activities = await response.json();

        // Get start dates for current and previous weeks
        const now = new Date();
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay());
        currentWeekStart.setHours(0, 0, 0, 0);

        const previousWeekStart = new Date(currentWeekStart);
        previousWeekStart.setDate(previousWeekStart.getDate() - 7);

        // Calculate stats for both weeks
        const currentWeekStats = {
            distance: 0,
            time: 0,
            elevation: 0,
            activities: 0
        };

        const previousWeekStats = {
            distance: 0,
            time: 0,
            elevation: 0,
            activities: 0
        };

        activities.forEach(activity => {
            const activityDate = new Date(activity.start_date);
            const stats = activityDate >= currentWeekStart ? currentWeekStats : 
                         (activityDate >= previousWeekStart ? previousWeekStats : null);
            
            if (stats) {
                stats.distance += activity.distance / 1000; // km
                stats.time += activity.moving_time / 3600; // hours
                stats.elevation += activity.total_elevation_gain || 0;
                stats.activities += 1;
            }
        });

        // Calculate trends (percentage change)
        const trends = {
            distance: calculateTrend(previousWeekStats.distance, currentWeekStats.distance),
            time: calculateTrend(previousWeekStats.time, currentWeekStats.time),
            elevation: calculateTrend(previousWeekStats.elevation, currentWeekStats.elevation),
            activities: calculateTrend(previousWeekStats.activities, currentWeekStats.activities)
        };

        res.json({
            current: {
                distance: Math.round(currentWeekStats.distance * 10) / 10,
                time: Math.round(currentWeekStats.time * 10) / 10,
                elevation: Math.round(currentWeekStats.elevation),
                activities: currentWeekStats.activities
            },
            trends
        });

    } catch (error) {
        console.error('Personal stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

function calculateTrend(previous, current) {
    if (previous === 0) return current > 0 ? 100 : 0;
    const percentChange = ((current - previous) / previous) * 100;
    return Math.round(percentChange);
}

// Update the club stats route with better error handling and logging
router.get('/club-stats', async (req, res) => {
    try {
        if (!req.session.stravaAccessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clubId = process.env.STRAVA_CLUB_ID;
        if (!clubId) {
            throw new Error('Strava Club ID not configured');
        }

        console.log('Fetching club activities...');
        
        const response = await fetch(
            `https://www.strava.com/api/v3/clubs/${clubId}/activities`,
            {
                headers: {
                    'Authorization': `Bearer ${req.session.stravaAccessToken}`
                }
            }
        );

        if (!response.ok) {
            console.error('Strava API error:', response.status, response.statusText);
            throw new Error('Failed to fetch club activities');
        }

        const activities = await response.json();
        console.log(`Retrieved ${activities.length} club activities`);

        // Calculate stats
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(now.getDate() - now.getDay());
        
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const stats = activities.reduce((acc, activity) => {
            const activityDate = new Date(activity.start_date);
            
            if (activityDate >= weekStart) {
                acc.weeklyDistance += activity.distance / 1000;
                acc.weeklyTime += activity.moving_time / 3600;
            }
            
            if (activityDate >= monthStart) {
                acc.monthlyDistance += activity.distance / 1000;
                if (!acc.activeRunners.includes(activity.athlete.id)) {
                    acc.activeRunners.push(activity.athlete.id);
                }
            }

            return acc;
        }, {
            weeklyDistance: 0,
            weeklyTime: 0,
            monthlyDistance: 0,
            activeRunners: []
        });

        res.json({
            weeklyDistance: Math.round(stats.weeklyDistance * 10) / 10,
            weeklyTime: Math.round(stats.weeklyTime * 10) / 10,
            monthlyDistance: Math.round(stats.monthlyDistance * 10) / 10,
            monthlyActiveRunners: stats.activeRunners.length
        });

    } catch (error) {
        console.error('Club stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add a new route to get athlete info
router.get('/athlete-info', (req, res) => {
    if (!req.session.athlete) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json(req.session.athlete);
});

// Update the club activities route to use the proper Strava API endpoint
router.get('/club-activities', async (req, res) => {
    try {
        if (!req.session.stravaAccessToken) {
            console.log('No access token found in session');
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clubId = process.env.STRAVA_CLUB_ID;
        if (!clubId) {
            console.error('STRAVA_CLUB_ID not set');
            throw new Error('Strava Club ID not configured');
        }

        console.log('Attempting to fetch club activities with:', {
            clubId,
            tokenPrefix: req.session.stravaAccessToken.substring(0, 10) + '...',
            url: `https://www.strava.com/api/v3/clubs/${clubId}/activities`
        });

        const response = await fetch(
            `https://www.strava.com/api/v3/clubs/${clubId}/activities`,
            {
                headers: {
                    'Authorization': `Bearer ${req.session.stravaAccessToken}`
                }
            }
        );

        // Log the response status and headers
        console.log('Strava API response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Strava API error response:', errorText);
            
            // Try to parse as JSON if possible
            try {
                const errorJson = JSON.parse(errorText);
                console.error('Parsed error:', errorJson);
                throw new Error(errorJson.message || 'Failed to fetch club activities');
            } catch (e) {
                throw new Error(`Failed to fetch club activities: ${errorText}`);
            }
        }

        const activities = await response.json();
        console.log(`Successfully fetched ${activities.length} club activities`);

        // Send the activities back to the client
        res.json(activities);

    } catch (error) {
        console.error('Club activities error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Helper function to format duration
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

// Add this route for athlete info
router.get('/athlete', async (req, res) => {
    try {
        if (!req.session.stravaAccessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const response = await fetch('https://www.strava.com/api/v3/athlete', {
            headers: {
                'Authorization': `Bearer ${req.session.stravaAccessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch athlete data');
        }

        const athlete = await response.json();
        res.json({
            firstname: athlete.firstname,
            lastname: athlete.lastname,
            profile: athlete.profile,
            id: athlete.id
        });

    } catch (error) {
        console.error('Athlete info error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 

const fetch = require('node-fetch');

// Cache for the access token
let cachedToken = null;
let tokenExpiration = null;

async function getAccessToken() {
    try {
        // Check if we have a valid cached token
        if (cachedToken && tokenExpiration && Date.now() < tokenExpiration) {
            return cachedToken;
        }

        // If not, request a new token
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                grant_type: 'client_credentials'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get Strava access token');
        }

        const data = await response.json();
        
        // Cache the token and set expiration
        cachedToken = data.access_token;
        // Set expiration to 5 minutes before actual expiration to be safe
        tokenExpiration = Date.now() + (data.expires_in - 300) * 1000;
        
        return cachedToken;
    } catch (error) {
        console.error('Error getting Strava access token:', error);
        throw error;
    }
}

module.exports = { getAccessToken };