import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      (req as any).userId = decoded.userId;
      (req as any).userEmail = decoded.email;
      (req as any).userRole = decoded.role;
    } catch (error) {
      // Invalid token, but don't block - just don't set user info
      // Routes can decide if they require authentication
    }
  }

  next();
}

// Middleware that requires authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Middleware that requires admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if ((req as any).userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
