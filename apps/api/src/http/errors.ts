import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); } }
export function notFound(_req: Request, _res: Response, next: NextFunction) { next(new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.')); }
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the submitted information.', details: error.flatten() } });
  if (error instanceof HttpError) return res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
  console.error('Unhandled request error', error instanceof Error ? error.message : error);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The server could not complete this request.' } });
}
