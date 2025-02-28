/**
 * Results Controller
 * 
 * Handles retrieving and downloading previously saved query results
 */
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import logger from '../services/logger.service';
import config from '../config';

/**
 * Get a specific JSON results file
 */
export const getJsonResults = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { filename } = req.params;
  
  // Validate filename to prevent directory traversal
  if (!filename || !/^[a-zA-Z0-9_\-\.]+\.json$/.test(filename)) {
    throw new AppError('Invalid filename', 'VALIDATION_ERROR');
  }
  
  // Set the results directory path
  const jsonOutputDir = path.join(process.cwd(), 'query_results');
  const filePath = path.join(jsonOutputDir, filename);
  
  try {
    // Check if file exists
    await fs.access(filePath);
    
    // Read file content
    const fileContent = await fs.readFile(filePath, 'utf8');
    
    // Parse JSON to validate it
    const jsonData = JSON.parse(fileContent);
    
    // Set headers for JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    // Send file
    return res.send(fileContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new AppError('Results file not found', 'NOT_FOUND');
    }
    
    logger.error(`Error retrieving results file: ${filename}`, error);
    throw new AppError('Failed to retrieve results file', 'INTERNAL_ERROR');
  }
});
