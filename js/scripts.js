async function fetchLatestRuns() {
    // Uncomment the following line to use the actual API call
    // const accessToken = await fetchAccessToken(); // Fetch the access token from your server

    // Mock data for testing
    const mockActivities = [
        {
            name: "Morning Run",
            start_date: "2023-10-01T07:00:00Z",
            distance: 5000,
            moving_time: 1800
        },
        {
            name: "Evening Run",
            start_date: "2023-10-02T18:00:00Z",
            distance: 7000,
            moving_time: 2400
        }
    ];

    // Simulate a delay to mimic an API call
    setTimeout(() => {
        displayLatestRuns(mockActivities);
    }, 1000);
}

function displayLatestRuns(activities) {
    const runsDiv = document.getElementById('latest-runs');
    if (activities.length === 0) {
        runsDiv.innerHTML = '<p>Inga senaste löpningar funna.</p>';
        return;
    }

    runsDiv.innerHTML = activities.map(activity => `
        <div class="run">
            <h5>${activity.name}</h5>
            <p>Datum: ${new Date(activity.start_date).toLocaleString()}</p>
            <p>Distans: ${(activity.distance / 1000).toFixed(2)} km</p>
            <p>Tid: ${activity.moving_time} sekunder</p>
        </div>
    `).join('');
}