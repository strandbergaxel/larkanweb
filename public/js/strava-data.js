document.addEventListener('DOMContentLoaded', function() {
    const isAuthenticated = checkStravaAuth(); // Implement this function
    
    if (isAuthenticated) {
        showStats();
        loadStravaData();
    } else {
        showLogin();
    }
});

function showLogin() {
    document.getElementById('stravaLoginSection').style.display = 'block';
    document.getElementById('stravaStatsSection').style.display = 'none';
}

function showStats() {
    document.getElementById('stravaLoginSection').style.display = 'none';
    document.getElementById('stravaStatsSection').style.display = 'block';
}

document.getElementById('stravaLoginBtn').addEventListener('click', async function() {
    try {
        // Fetch the client ID and redirect URI from the server
        const response = await fetch('/api/strava/auth-config');
        const { clientId, redirectUri } = await response.json();
        
        const scope = 'read,activity:read_all';
        const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
        
        window.location.href = stravaAuthUrl;
    } catch (error) {
        console.error('Failed to initialize Strava login:', error);
        // Handle error appropriately
    }
});

document.getElementById('refreshStats').addEventListener('click', function() {
    loadStravaData();
});

function loadStravaData() {
    // Implement your Strava API calls here
    // Update the stats and activities list
    updateLastSync();
}

function updateLastSync() {
    const now = new Date();
    document.getElementById('lastSync').textContent = 
        `Senast uppdaterad: ${now.toLocaleTimeString()}`;
} 