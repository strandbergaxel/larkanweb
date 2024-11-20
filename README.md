# Larkan Website

## Overview

The Larkan website serves as the online presence for IS Lärkan running club in Stockholm. It provides information about the club, upcoming events, and integrates with Strava for running statistics.

## Features

- **Modern Design**: Clean and responsive user interface
- **Club Information**: Details about IS Lärkan and its activities
- **Event Calendar**: Upcoming running events and weekly runs
- **Strava Integration**: Running statistics for club members
- **Performance Optimized**: Built with vanilla JavaScript for optimal loading speeds

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js
- **APIs**: Strava API integration
- **Development**: npm

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/larkan-website.git
   cd larkan-website
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the development server:

   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to view the website.

## Project Structure
larkan-website/
├── public/ # Static assets and HTML files
│ ├── css/ # Stylesheets
│ ├── js/ # JavaScript files
│ └── images/ # Image assets
├── server/ # Node.js server files
└── README.md # Documentation


## Environment Setup

1. Copy `.env.example` to `.env.local`
2. Fill in the required environment variables:
   - `STRAVA_CLIENT_ID`: Your Strava API client ID
   - `STRAVA_CLIENT_SECRET`: Your Strava API client secret
   - `STRAVA_REDIRECT_URI`: OAuth redirect URI
   - `CLUB_ID`: Your Strava club ID

These environment variables are required for the Strava integration. Never commit the `.env.local` file to the repository.

## Contributing

For internal team members: Please follow the established git workflow and coding standards when contributing to this project.

## License

This project is proprietary and confidential. All rights reserved.