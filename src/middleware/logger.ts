import { Request, Response, NextFunction } from 'express';

export const logger = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
    
    const timestamp = new Date().toISOString();
    const method = req.method;
    const path = req.originalUrl || req.url;
    const status = res.statusCode;

    console.log(`[${timestamp}] ${method} ${path} ${status} - ${durationMs}ms`);
  });

  next();
};