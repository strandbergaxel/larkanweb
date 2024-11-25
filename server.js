const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Add CORS headers for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// API endpoint for Strava club events
app.get('/api/strava/club-events', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        console.log('Fetching club events...');
        const accessToken = await getStravaAccessToken(fetch);
        const clubId = process.env.STRAVA_CLUB_ID;
        
        const response = await fetch(
            `https://www.strava.com/api/v3/clubs/${clubId}/group_events`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Strava API error: ${response.status}`);
        }

        const events = await response.json();
        console.log(`Found ${events.length} events`);
        
        const upcomingEvents = events
            .filter(event => new Date(event.start_date) > new Date())
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

        res.json(upcomingEvents[0] || null);

    } catch (error) {
        console.error('Error fetching club events:', error);
        res.status(500).json({ error: 'Failed to fetch club events', details: error.message });
    }
});

// Define routes for HTML pages
const routes = {
    '/': 'index.html',
    '/about': 'about.html',
    '/evenemang': 'evenemang.html',
    '/bli-medlem': 'bli-medlem.html',
    '/strava-data': 'strava-data.html'
};

// Handle defined routes
Object.entries(routes).forEach(([route, file]) => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', file), (err) => {
            if (err) {
                console.error(`Error sending file ${file}:`, err);
                res.status(404).send('Page not found');
            }
        });
    });
});

// Remove the catch-all route that was sending index.html
// Handle 404s for undefined routes
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), (err) => {
        if (err) {
            res.status(404).send('Page not found');
        }
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available routes:', Object.keys(routes));
    console.log('Environment variables loaded:', {
        STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID ? 'Set' : 'Not set',
        STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET ? 'Set' : 'Not set',
        STRAVA_CLUB_ID: process.env.STRAVA_CLUB_ID ? 'Set' : 'Not set'
    });
});