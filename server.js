const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

let accessToken = '';

app.use(cors());
app.use(express.static('public')); // Serve static files from the public directory

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html'); // Serve the index.html file
});

app.get('/auth/strava', (req, res) => {
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${process.env.STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${process.env.STRAVA_REDIRECT_URI}&scope=read,read_all,activity:read`;
    console.log('Authorization URL:', authUrl); // Log the authorization URL
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    const tokenUrl = 'https://www.strava.com/oauth/token';

    try {
        const response = await axios.post(tokenUrl, {
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code'
        });

        accessToken = response.data.access_token; // Store the access token
        console.log('Access Token:', accessToken); // Log the access token
        res.redirect('/strava-data.html'); // Redirect to the Strava data page after login
    } catch (error) {
        console.error('Error obtaining access token:', error.response ? error.response.data : error.message);
        res.status(500).send('Error obtaining access token');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.get('/monthly-activities', async (req, res) => {
    if (!accessToken) {
        return res.status(401).send('Unauthorized: No access token available');
    }

    try {
        const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyActivities = response.data.filter(activity => {
            const activityDate = new Date(activity.start_date);
            return activityDate.getMonth() === currentMonth && activityDate.getFullYear() === currentYear;
        });

        const aggregatedActivities = {};
        const heatmapData = [];

        monthlyActivities.forEach(activity => {
            const type = activity.type;
            if (!aggregatedActivities[type]) {
                aggregatedActivities[type] = {
                    count: 0,
                    totalDistance: 0,
                    totalTime: 0
                };
            }
            aggregatedActivities[type].count += 1;
            aggregatedActivities[type].totalDistance += activity.distance;
            aggregatedActivities[type].totalTime += activity.moving_time;

            // Collect latitude and longitude for heatmap
            if (activity.map && activity.map.summary_polyline) {
                const decodedPath = decodePolyline(activity.map.summary_polyline);
                decodedPath.forEach(point => {
                    // Ensure valid coordinates
                    if (point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180) {
                        heatmapData.push([point.lat, point.lng]);
                    }
                });
            }
        });

        res.json({ aggregatedActivities, heatmapData });
    } catch (error) {
        console.error('Error fetching activities:', error.response ? error.response.data : error.message);
        res.status(500).send('Error fetching activities');
    }
});

// Function to decode polyline
function decodePolyline(encoded) {
    const coordinates = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        coordinates.push({ lat: lat / 1E5, lng: lng / 1E5 });
    }
    return coordinates;
}