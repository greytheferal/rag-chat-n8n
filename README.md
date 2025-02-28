# rag-chat-n8n
The project creates a streamlined natural language database interface:

1. Users ask questions through a React UI with no need for SQL knowledge
2. On initialization, the system dynamically discovers and caches the database schema, incorporating it into the LLM system prompt
3. Backend processes questions using OpenAI to generate SQL based on the question, conversation context, and cached schema
4. Queries are executed via n8n workflow which handles execution, error checking, file conversion, and comprehensive logging
5. Query results are processed by a second OpenAI call that transforms technical data into natural language responses
6. The frontend receives the complete package and enables file downloads of results, with SQL queries visible only in development mode
