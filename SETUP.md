# RAG Query System Setup Guide

This document provides a comprehensive guide to setting up and running the RAG Query System.

## Components Overview

1. **Backend Server**: Node.js + Express + TypeScript
2. **Database**: MySQL (Cloud-hosted or local)
3. **Workflow Engine**: n8n
4. **AI Integration**: OpenAI API
5. **Frontend**: Embedded HTML/JS interface

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v16 or later)
- npm (v7 or later)
- MySQL (v8.0 or later)
- OpenAI API key
- Git

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit the `.env` file and update the following values:

- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`: Your MySQL database connection details
- `OPENAI_API_KEY`: Your OpenAI API key
- `N8N_WEBHOOK_URL`: URL to your n8n webhook (typically http://localhost:5678/webhook/execute-query)

### 4. Set Up n8n

#### Install and Start n8n

```bash
npm install n8n -g
n8n start
```

#### Import the Workflow

1. Access the n8n web interface at http://localhost:5678/
2. Go to Workflows â†’ Import From File
3. Select the file from `n8n/database-query-executor.json`
4. Configure the MySQL credentials in the MySQL nodes
5. Save and activate the workflow

### 5. Set Up the Database

```bash
npm run db:setup
```

This will create the necessary tables and sample data in your database.

### 6. Verify Connections

Test the database connection:

```bash
npm run db:refresh
```

Test the n8n webhook connection:

```bash
npm run n8n:test
```

### 7. Start the Development Server

```bash
npm run dev
```

The server will start on http://localhost:3001

### 8. Test the API

You can run a comprehensive API test with:

```bash
npm run api:test
```

### 9. Access the Web Interface

Open your browser and navigate to http://localhost:3001

## Usage Examples

Try asking questions like:

- "Show me all active users"
- "When did user John Doe last log in?"
- "How many users have registered in October 2023?"
- "What's the email address of user David Wilson?"

## Troubleshooting

### Database Connection Issues

If you're having trouble connecting to the database:

1. Verify your `.env` settings
2. Ensure the database server is running
3. Check that the user has appropriate permissions
4. If using SSL, ensure SSL is properly configured

### n8n Webhook Issues

If the n8n webhook isn't working:

1. Verify n8n is running
2. Check that the workflow is activated
3. Ensure the webhook URL in your `.env` matches the n8n webhook URL
4. Check the MySQL credentials in the n8n workflow

### OpenAI API Issues

If you're experiencing issues with OpenAI:

1. Verify your API key is correct
2. Check for rate limits or quota issues
3. Ensure you have proper billing set up for the API

## Project Structure

```
.
â”œâ”€â”€ db/                  # Database scripts
â”œâ”€â”€ n8n/                 # n8n workflow files
â”œâ”€â”€ public/              # Static frontend files
â”œâ”€â”€ src/                 # Source code
â”‚   â”œâ”€â”€ config/          # Configuration files
â”‚   â”œâ”€â”€ controllers/     # Request handlers
â”‚   â”œâ”€â”€ middleware/      # Express middleware
â”‚   â”œâ”€â”€ routes/          # API routes
â”‚   â”œâ”€â”€ services/        # Business logic
â”‚   â”œâ”€â”€ types/           # TypeScript type definitions
â”‚   â”œâ”€â”€ utils/           # Utility functions
â”‚   â””â”€â”€ app.ts           # Application entry point
â”œâ”€â”€ .env                 # Environment variables
â”œâ”€â”€ .gitignore           # Git ignore file
â”œâ”€â”€ package.json         # Node.js dependencies
â”œâ”€â”€ README.md            # Project overview
â”œâ”€â”€ SETUP.md             # This setup guide
â””â”€â”€ tsconfig.json        # TypeScript configuration
```

## Deployment Considerations

For production deployment:

1. Use a process manager like PM2
2. Set up proper logging
3. Configure a reverse proxy like Nginx
4. Use a production-grade database setup
5. Implement proper authentication
6. Set `NODE_ENV=production` in your environment variables

## Support

If you need help or have questions, please open an issue on the repository or contact the project maintainers.
