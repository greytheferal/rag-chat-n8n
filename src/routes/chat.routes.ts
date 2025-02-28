/**
 * Chat Routes
 * 
 * Defines API routes for chat functionality including natural language processing
 * and database query execution.
 */
import { Router } from 'express';
import { processChat, getSchema, executeRawQuery } from '../controllers/chat.controller';
import { getJsonResults } from '../controllers/results.controller';

const router = Router();

/**
 * @route POST /api/chat
 * @description Process a natural language chat message
 * @access Public
 */
router.post('/', processChat);

/**
 * @route GET /api/chat/schema
 * @description Get database schema information
 * @access Public
 */
router.get('/schema', getSchema);

/**
 * @route POST /api/chat/query
 * @description Execute a raw SQL query (for testing/debugging)
 * @access Public
 */
router.post('/query', executeRawQuery);

/**
 * @route GET /api/chat/results/:filename
 * @description Get a specific JSON result file
 * @access Public
 */
router.get('/results/:filename', getJsonResults);

export default router;
