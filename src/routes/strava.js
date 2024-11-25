const express = require('express');
const session = require('express-session');
const path = require('path');
const stravaApi = require('../services/stravaApi');

const router = express.Router();

router.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Check auth endpoint
router.get('/check-auth', (req, res) => {
    console.log('Session data:', req.session); // Debug log
    const isAuthenticated = !!req.session.stravaAccessToken;
    res.json({ isAuthenticated });
});

// Auth callback endpoint
router.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;
        
        if (!code) {
            throw new Error('No authorization code received');
        }

        // Exchange code for token
        const tokenResponse = await stravaApi.getToken(code);
        
        // Store tokens in session
        req.session.stravaAccessToken = tokenResponse.access_token;
        req.session.stravaRefreshToken = tokenResponse.refresh_token;
        
        // Send HTML that closes popup and messages parent
        res.send(`
            <script>
                window.opener.postMessage('strava-auth-success', '*');
                window.close();
            </script>
        `);
    } catch (error) {
        console.error('Auth callback error:', error);
        res.status(500).send(`
            <script>
                window.opener.postMessage('strava-auth-error', '*');
                window.close();
            </script>
        `);
    }
});

// Auth config endpoint
router.get('/auth-config', (req, res) => {
    try {
        const clientId = process.env.STRAVA_CLIENT_ID;
        const appDomain = req.get('host');
        // Use HTTP for localhost, HTTPS for production
        const protocol = appDomain.includes('localhost') ? 'http' : 'https';
        const redirectUri = `${protocol}://${appDomain}/api/strava/callback`;

        console.log('Auth config:', {
            appDomain,
            protocol,
            redirectUri,
            clientId: clientId ? 'exists' : 'missing'
        });

        if (!clientId) {
            throw new Error('Missing Strava configuration: CLIENT_ID');
        }

        res.json({
            clientId,
            redirectUri
        });
    } catch (error) {
        console.error('Config retrieval failed:', error);
        res.status(500).json({ error: error.message });
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
        const clubId = process.env.STRAVA_CLUB_ID;
        const accessToken = await getAccessToken();
        
        // Fetch club members
        const membersResponse = await fetch(
            `https://www.strava.com/api/v3/clubs/${clubId}/members`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!membersResponse.ok) {
            throw new Error('Failed to fetch club members');
        }

        const members = await membersResponse.json();
        console.log(`Club has ${members.length} members`);

        // Fetch activities for distance stats
        const activitiesResponse = await fetch(
            `https://www.strava.com/api/v3/clubs/${clubId}/activities`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!activitiesResponse.ok) {
            throw new Error('Failed to fetch club activities');
        }

        const activities = await activitiesResponse.json();

        const stats = activities.reduce((acc, activity) => {
            if (activity.type !== 'Run') return acc;
            
            acc.weeklyDistance += activity.distance / 1000;
            acc.monthlyDistance += activity.distance / 1000;

            return acc;
        }, {
            weeklyDistance: 0,
            monthlyDistance: 0
        });

        const statsResponse = {
            weeklyDistance: Math.round(stats.weeklyDistance * 10) / 10,
            monthlyDistance: Math.round(stats.monthlyDistance * 10) / 10,
            memberCount: members.length
        };

        console.log('Final stats:', statsResponse);
        res.json(statsResponse);

    } catch (error) {
        console.error('Club stats error:', error);
        res.status(500).json({ 
            error: error.message,
            fallback: {
                weeklyDistance: 0,
                monthlyDistance: 0,
                memberCount: 0
            }
        });
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

import('node-fetch').then(module => {
    global.fetch = module.default;
});

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
                refresh_token: process.env.STRAVA_REFRESH_TOKEN,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Strava token error:', errorData);
            throw new Error('Failed to get Strava access token');
        }

        const data = await response.json();
        
        // Cache the token and set expiration
        cachedToken = data.access_token;
        tokenExpiration = Date.now() + (data.expires_in - 300) * 1000;
        
        return cachedToken;
    } catch (error) {
        console.error('Error getting Strava access token:', error);
        throw error;
    }
}

// Stats endpoint
router.get('/activities', async (req, res) => {
    try {
        if (!req.session.stravaAccessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const activities = await stravaApi.getAthleteActivities(req.session.stravaAccessToken);
        res.json(activities);
    } catch (error) {
        console.error('Failed to fetch activities:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        if (!req.session.stravaAccessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Get activities first
        const activities = await stravaApi.getAthleteActivities(req.session.stravaAccessToken);
        
        // Calculate stats from activities
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - 7));
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const stats = {
            weeklyDistance: 0,
            weeklyTime: 0,
            monthlyDistance: 0,
            monthlyParticipants: 0
        };

        activities.forEach(activity => {
            const activityDate = new Date(activity.start_date);
            
            if (activityDate >= weekStart) {
                stats.weeklyDistance += activity.distance;
                stats.weeklyTime += activity.moving_time;
            }
            
            if (activityDate >= monthStart) {
                stats.monthlyDistance += activity.distance;
                stats.monthlyParticipants += 1;
            }
        });

        // Convert distances from meters to kilometers
        stats.weeklyDistance = Math.round(stats.weeklyDistance / 1000);
        stats.monthlyDistance = Math.round(stats.monthlyDistance / 1000);

        res.json(stats);
    } catch (error) {
        console.error('Failed to fetch stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = { getAccessToken };
module.exports = router; 