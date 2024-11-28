const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const nodemailer = require('nodemailer');
const stravaRoutes = require('./src/routes/strava');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();

// 1. First, all your middleware
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 2. Define routes for HTML pages
const routes = {
    '/': 'index.html',
    '/about': 'about.html',
    '/events': 'events.html',
    '/membership': 'membership.html',
    '/statistics': 'statistics.html'
};

// 3. Then, all your API routes
app.post('/api/join', async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({ 
                error: 'Namn och e-post krävs'
            });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        // Email to admin
        const adminMailOptions = {
            from: process.env.EMAIL_USER,
            to: 'idrottssallskapetlarkan@gmail.com',
            subject: 'Ny medlemsansökan - IS Lärkan',
            html: `
                <h2>Ny medlemsansökan</h2>
                <p><strong>Namn:</strong> ${name}</p>
                <p><strong>E-post:</strong> ${email}</p>
                <p><strong>Telefon:</strong> ${phone || 'Ej angivet'}</p>
            `
        };

        // Auto-reply to applicant
        const applicantMailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Välkommen till IS Lärkan',
            html: `
                <h2>Tack för din ansökan, ${name}!</h2>
                <p>Vi har mottagit din medlemsansökan till IS Lärkan. Vi kommer att kontakta dig inom kort med mer information om hur du kommer igång som medlem.</p>
                <p>Under tiden kan du:</p>
                <ul>
                    <li>Gå med i vår Strava-klubb: <a href="https://www.strava.com/clubs/1172487">IS Lärkan på Strava</a></li>
                    <li>Följ oss på Instagram: <a href="https://www.instagram.com/is_larkan">@is_larkan</a></li>
                </ul>
                <p>Har du frågor? Svara gärna på detta mail!</p>
                <br>
                <p>Med vänliga hälsningar,<br>IS Lärkan</p>
            `
        };

        await transporter.sendMail(adminMailOptions);
        await transporter.sendMail(applicantMailOptions);

        res.status(200).json({ message: 'Ansökan mottagen' });

    } catch (error) {
        res.status(500).json({ error: 'Ett fel uppstod vid hantering av ansökan' });
    }
});

// Strava routes
app.use('/api/strava', stravaRoutes);

// Direct Strava endpoints in main server file
app.get('/api/strava/all-events', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
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
        
        const processedEvents = events.map(event => ({
            ...event,
            start_date: event.upcoming_occurrences?.[0] || event.start_date
        }));

        const sortedEvents = processedEvents.sort((a, b) => 
            new Date(b.start_date) - new Date(a.start_date)
        );

        res.json(sortedEvents);

    } catch (error) {
        console.error('Error fetching club events:', error);
        res.status(500).json({ error: 'Failed to fetch club events', details: error.message });
    }
});

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

// 4. Then, your static page routes
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

// 5. Finally, your 404 handler and catch-all routes
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), (err) => {
        if (err) {
            res.status(404).send('Page not found');
        }
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

// Endpoint for all events
app.get('/api/strava/all-events', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
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

        // Include both upcoming and past events
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

// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Only use secure cookies in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    proxy: true // Trust the reverse proxy
}));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});