# Strava Club Activities Dashboard

## Overview

The Strava Club Activities Dashboard is a web application that allows users to view their running statistics and the activities of club members. It integrates with the Strava API to fetch and display activities, providing insights into performance metrics for both the authenticated user and their club members.

## Features

- **User Authentication**: Users can log in using their Strava account.
- **Activity Summary**: Displays the user's activities for the current month, including total distance and time.
- **Club Activities**: Fetches and displays activities of club members from a specified Strava club.
- **Aggregated Data**: Shows aggregated statistics for the user's activities and club members' activities in a tabular format.

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript, jQuery, Bootstrap
- **Backend**: Node.js, Express
- **Database**: None (uses Strava API directly)
- **API**: Strava API for fetching user and club activities

## Getting Started

### Prerequisites

- Node.js installed on your machine
- A Strava account
- Access to the Strava API (you may need to create an application in the Strava Developer portal)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/strava-club-activities-dashboard.git
   cd strava-club-activities-dashboard
   ```

2. Install the required packages:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your Strava API credentials:

   ```
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   STRAVA_REDIRECT_URI=your_redirect_uri
   CLUB_ID=1172487
   ```

4. Start the server:

   ```bash
   node server.js
   ```

5. Open your browser and navigate to `http://localhost:3000/strava-data.html`.

### Usage

1. Click on the login button to authenticate with your Strava account.
2. After logging in, you will see your activity summary for the current month.
3. The dashboard will also display aggregated activities of club members from the specified club.

## Inputs

- **STRAVA_CLIENT_ID**: Your Strava application client ID.
- **STRAVA_CLIENT_SECRET**: Your Strava application client secret.
- **STRAVA_REDIRECT_URI**: The redirect URI for your Strava application.
- **CLUB_ID**: The ID of the Strava club you want to fetch activities from (default is `1172487`).

## API Endpoints

- **GET /monthly-activities**: Fetches the authenticated user's activities for the current month.
- **GET /club-activities**: Fetches and aggregates activities of club members for the authenticated user.

## Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments

- [Strava API Documentation](https://developers.strava.com/docs/)
- [Leaflet.js](https://leafletjs.com/) for interactive maps
- [Bootstrap](https://getbootstrap.com/) for responsive design