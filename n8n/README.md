# n8n Workflow Setup

This directory contains the n8n workflow configuration files for the RAG Query System.

## Setup Instructions

1. Install n8n using your preferred method:
   ```
   npm install n8n -g
   ```

2. Start n8n:
   ```
   n8n start
   ```

3. Access the n8n web interface at http://localhost:5678/

4. Import the workflow file `database-query-executor.json` from this directory

5. Configure the MySQL credentials in n8n to connect to your database

6. Activate the workflow

## Workflow Details

The workflow consists of the following nodes:

1. **Webhook** - Entry point that receives SQL queries
2. **Function** - Validates and sanitizes SQL queries
3. **MySQL** - Executes the SQL query
4. **Function** - Formats the results (especially timestamps)
5. **Webhook Response** - Returns the results to the caller

## Testing the Workflow

You can test if the workflow is properly configured by running:

```
npm run n8n:test
```

This will send a simple test query to verify connectivity.