# RAG Query System Frontend

This directory contains a React-based frontend for the RAG Query System.

## Setup Instructions

1. Install dependencies:
   ```
   cd frontend
   npm install
   ```

2. Create a `.env` file with your backend API URL:
   ```
   REACT_APP_API_URL=http://localhost:3001
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Access the application at http://localhost:3000

## Features

- Chat interface for natural language queries
- Display of SQL queries generated from natural language
- Data visualization of query results
- Conversation history

## Building for Production

To build the application for production:

```
npm run build
```

The build files will be in the `build` directory and can be served by any static web server.