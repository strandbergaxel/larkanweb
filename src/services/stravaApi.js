const axios = require('axios');

class StravaApi {
    constructor() {
        this.clientId = process.env.STRAVA_CLIENT_ID;
        this.clientSecret = process.env.STRAVA_CLIENT_SECRET;
        this.baseUrl = 'https://www.strava.com/api/v3';
    }

    async getToken(code) {
        try {
            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                grant_type: 'authorization_code'
            });
            return response.data;
        } catch (error) {
            console.error('Token exchange error:', error);
            throw error;
        }
    }

    async getAthleteActivities(accessToken) {
        try {
            // Get activities from the last 30 days
            const after = new Date();
            after.setDate(after.getDate() - 30);

            const response = await axios.get(`${this.baseUrl}/athlete/activities`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                params: {
                    after: Math.floor(after.getTime() / 1000),  // Convert to Unix timestamp
                    per_page: 30
                }
            });
            return response.data;
        } catch (error) {
            console.error('Failed to get athlete activities:', error);
            throw error;
        }
    }

    async getMonthlyStats(activities) {
        // Group activities by month and type
        const monthlyStats = activities.reduce((stats, activity) => {
            const date = new Date(activity.start_date);
            const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const type = activity.type;

            if (!stats[monthKey]) {
                stats[monthKey] = {};
            }
            
            if (!stats[monthKey][type]) {
                stats[monthKey][type] = {
                    count: 0,
                    distance: 0,
                    time: 0
                };
            }

            stats[monthKey][type].count += 1;
            stats[monthKey][type].distance += activity.distance;
            stats[monthKey][type].time += activity.moving_time;

            return stats;
        }, {});

        // Convert to array and format values
        return Object.entries(monthlyStats).map(([month, types]) => ({
            month,
            activities: Object.entries(types).map(([type, stats]) => ({
                type,
                count: stats.count,
                distance: Math.round(stats.distance / 1000), // Convert to km
                time: Math.round(stats.time / 3600) // Convert to hours
            }))
        })).sort((a, b) => b.month.localeCompare(a.month)); // Sort by most recent
    }
}

module.exports = new StravaApi();