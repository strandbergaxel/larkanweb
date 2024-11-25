const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const nodemailer = require('nodemailer');
const stravaRoutes = require('./src/routes/strava');

const app = express();

// Add these lines before your routes
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use('/api/strava', stravaRoutes);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Add CORS headers for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Strava token management
let cachedToken = null;
let tokenExpiration = null;

async function getStravaAccessToken(fetch) {
    try {
        if (cachedToken && tokenExpiration && Date.now() < tokenExpiration) {
            return cachedToken;
        }

        // Log the values being used
        console.log('Using Strava credentials:', {
            clientId: process.env.STRAVA_CLIENT_ID,
            clientIdType: typeof process.env.STRAVA_CLIENT_ID,
            hasSecret: !!process.env.STRAVA_CLIENT_SECRET,
            hasRefreshToken: !!process.env.STRAVA_REFRESH_TOKEN
        });

        const body = {
            client_id: parseInt(process.env.STRAVA_CLIENT_ID, 10), // Convert to number
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: process.env.STRAVA_REFRESH_TOKEN
        };

        console.log('Request body:', body);

        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Token request failed: ${response.status}, ${errorData}`);
        }

        const data = await response.json();
        cachedToken = data.access_token;
        tokenExpiration = Date.now() + (data.expires_in - 300) * 1000;
        console.log('New token acquired');
        
        return cachedToken;
    } catch (error) {
        console.error('Error getting Strava token:', error);
        throw error;
    }
}

// Endpoint for all events
app.get('/api/strava/all-events', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        console.log('Fetching all club events...');
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
        
        // Process events to use the first upcoming occurrence if available
        const processedEvents = events.map(event => ({
            ...event,
            start_date: event.upcoming_occurrences?.[0] || event.start_date
        }));

        // Sort all events by date (newest first)
        const sortedEvents = processedEvents.sort((a, b) => 
            new Date(b.start_date) - new Date(a.start_date)
        );

        res.json(sortedEvents);

    } catch (error) {
        console.error('Error fetching club events:', error);
        res.status(500).json({ error: 'Failed to fetch club events', details: error.message });
    }
});

// Endpoint for next upcoming event
app.get('/api/strava/club-events', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        console.log('Fetching upcoming club events...');
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
        
        // Process events to use the first upcoming occurrence if available
        const processedEvents = events.map(event => ({
            ...event,
            start_date: event.upcoming_occurrences?.[0] || event.start_date
        }));

        // Filter for upcoming events and sort by date
        const now = new Date();
        const upcomingEvents = processedEvents
            .filter(event => new Date(event.start_date) > now)
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
    '/events': 'events.html',
    '/join': 'join.html',
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

// Handle 404s for undefined routes
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), (err) => {
        if (err) {
            res.status(404).send('Page not found');
        }
    });
});

app.get('/api/strava/callback', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        const { code } = req.query;
        
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code'
            })
        });

        const data = await response.json();
        console.log('Initial token response:', data);
        
        // Store this refresh_token in your environment variables
        console.log('Refresh token:', data.refresh_token);
        
        res.send('Authorization successful! You can close this window.');
    } catch (error) {
        console.error('Error in callback:', error);
        res.status(500).send('Authorization failed');
    }
});

// Create email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'idrottssallskapetlarkan@gmail.com',
        pass: process.env.EMAIL_PASSWORD
    }
});

// Add this near the top to verify the endpoint is registered
console.log('Setting up /api/join endpoint');

// Membership application endpoint
app.post('/api/join', async (req, res) => {
    console.log('Received join request');
    console.log('Request body:', req.body);
    
    try {
        const { name, email, phone } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'idrottssallskapetlarkan@gmail.com',
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const mailOptions = {
            from: 'idrottssallskapetlarkan@gmail.com',
            to: 'idrottssallskapetlarkan@gmail.com',
            subject: 'Ny medlemsansökan - IS Lärkan',
            html: `
                <h2>Ny medlemsansökan från hemsidan</h2>
                <p><strong>Namn:</strong> ${name}</p>
                <p><strong>E-post:</strong> ${email}</p>
                ${phone ? `<p><strong>Telefon:</strong> ${phone}</p>` : ''}
                <p><em>Skickat: ${new Date().toLocaleString('sv-SE')}</em></p>
            `
        };

        await transporter.sendMail(mailOptions);
        
        const autoReplyOptions = {
            from: 'idrottssallskapetlarkan@gmail.com',
            to: email,
            subject: 'Tack för din ansökan till IS Lärkan',
            html: `
                <h2>Tack för din ansökan!</h2>
                <p>Hej ${name},</p>
                <p>Vi har mottagit din medlemsansökan och återkommer till dig inom kort.</p>
                <br>
                <p>Med vänliga hälsningar,</p>
                <p>IS Lärkan</p>
            `
        };

        await transporter.sendMail(autoReplyOptions);

        res.status(200).json({ message: 'Application received' });
    } catch (error) {
        console.error('Error processing application:', error);
        res.status(500).json({ error: 'Failed to process application' });
    }
});

// Add this test endpoint
app.get('/api/test-email', async (req, res) => {
    try {
        console.log('Testing email configuration...');
        console.log('EMAIL_PASSWORD length:', process.env.EMAIL_PASSWORD?.length || 'not set');
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'idrottssallskapetlarkan@gmail.com',
                pass: process.env.EMAIL_PASSWORD
            }
        });

        console.log('Verifying transporter...');
        await transporter.verify();
        console.log('Transporter verified successfully');

        const testMailOptions = {
            from: 'idrottssallskapetlarkan@gmail.com',
            to: 'idrottssallskapetlarkan@gmail.com',
            subject: 'Test Email',
            text: 'If you receive this, the email configuration is working!'
        };

        console.log('Sending test email...');
        const info = await transporter.sendMail(testMailOptions);
        console.log('Test email sent:', info.response);

        res.json({ 
            success: true, 
            message: 'Test email sent successfully',
            details: info.response
        });
    } catch (error) {
        console.error('Email test failed:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        });
    }
});

app.get('/api/strava/club-stats', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        const accessToken = await getStravaAccessToken(fetch);
        const clubId = process.env.STRAVA_CLUB_ID;
        
        const response = await fetch(
            `https://www.strava.com/api/v3/clubs/${clubId}/stats`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Strava API error: ${response.status}`);
        }

        const stats = await response.json();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching club stats:', error);
        res.status(500).json({ error: 'Failed to fetch club stats' });
    }
});

// Mount the Strava routes
app.use('/api/strava', stravaRoutes);

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

// Add this check at startup
console.log('Environment check on startup:', {
    STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID,
    STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET ? 'Set' : 'Not set',
    STRAVA_REFRESH_TOKEN: process.env.STRAVA_REFRESH_TOKEN ? 'Set' : 'Not set',
    STRAVA_CLUB_ID: process.env.STRAVA_CLUB_ID
});