import { getAccessToken } from '../../../utils/strava';

export default async function handler(req, res) {
    try {
        const accessToken = await getAccessToken();
        const clubId = process.env.STRAVA_CLUB_ID;
        
        const response = await fetch(
            `https://www.strava.com/api/v3/clubs/${clubId}/group_events?access_token=${accessToken}`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch club events');
        }

        const events = await response.json();
        
        // Sort events by date and get the next upcoming event
        const upcomingEvents = events
            .filter(event => new Date(event.start_date) > new Date())
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

        res.status(200).json(upcomingEvents[0] || null);
    } catch (error) {
        console.error('Error fetching club events:', error);
        res.status(500).json({ error: 'Failed to fetch club events' });
    }
} 