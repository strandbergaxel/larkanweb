# Larkan Website

## Overview

The Larkan website is a modern web application built with Next.js that serves as the online presence for Larkan. It provides information about the company, its services, and ways to get in touch.

## Features

- **Modern Design**: Clean and responsive user interface
- **Company Information**: Detailed information about Larkan and its services
- **Contact Form**: Easy way for potential clients to get in touch
- **Performance Optimized**: Built with modern web technologies for optimal loading speeds

## Technologies Used

- **Frontend**: Next.js, React
- **Deployment**: Vercel
- **Development**: TypeScript

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/strandbergaxel/larkan-website.git
   cd larkan-website
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Run the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to view the website.

## Project Structure
larkan-website/
├── app/ # Next.js app directory
├── components/ # React components
├── public/ # Static assets
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