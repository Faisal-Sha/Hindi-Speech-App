// backend/middleware/familyAuth.js
const rateLimit = require('express-rate-limit');
const { supabase } = require('../supabaseClient');
const { getFamilyAccountWithProfiles, profileBelongsToAccount } = require('../database');

/**
 * Authentication middleware for family accounts
 * Verifies that the request has a valid account-level JWT token
 * Adds account info to req.account if valid
 */
const authenticateAccount = async (req, res, next) => {
  try {
    console.log(`🔐 Authenticating account for ${req.method} ${req.path}`);
    
    // Get token from Authorization header (format: "Bearer TOKEN")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      console.log('❌ No authentication token provided');
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please login to access this resource'
      });
    }
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.log('❌ Invalid or expired token');
      return res.status(403).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired. Please login again.'
      });
    }

    // Get account information
    const account = await getFamilyAccountWithProfiles(user.email);
    if (!account) {
      console.log('❌ Account not found for user');
      return res.status(403).json({
        error: 'Account not found',
        message: 'No account linked with this user'
      });
    }

    // Add account info to request object for use in routes
    req.account = {
      email: account.email,
      accountName: account.accountName,
      isVerified: account.isVerified,
      maxProfiles: account.maxProfiles,
      profiles: account.profiles
    };

    console.log(`✅ Account authenticated: ${req.account.accountName} (${req.account.email})`);
    next();
    
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Authorization middleware for profile access
 * Ensures the authenticated account owns the requested profile
 * Should be used after authenticateAccount
 */
const authorizeProfileAccess = async (req, res, next) => {
  try {
    console.log(`🔍 Authorizing profile access for ${req.method} ${req.path}`);
    
    // Get the profile ID from request params (e.g., /data/:userId)
    const profileId = req.params.userId || req.params.profileId;
    const accountEmail = req.account?.email;
    
    if (!accountEmail) {
      console.log('❌ No authenticated account found');
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please login to access this resource'
      });
    }
    
    if (!profileId) {
      console.log('❌ No profile ID provided in request');
      return res.status(400).json({ 
        error: 'Profile ID required',
        message: 'Profile ID must be provided'
      });
    }
    
    // Check if the profile belongs to this account
    const hasAccess = await profileBelongsToAccount(accountEmail, profileId);
    
    if (!hasAccess) {
      console.log(`🚫 Authorization denied: ${accountEmail} tried to access profile ${profileId}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You can only access profiles in your own account'
      });
    }
    
    console.log(`✅ Profile access authorized: ${accountEmail} accessing ${profileId}`);
    
    // Add profile ID to request for convenience
    req.authorizedProfileId = profileId;
    next();
    
  } catch (error) {
    console.error('❌ Authorization error:', error);
    return res.status(500).json({ 
      error: 'Authorization failed',
      message: 'Internal server error during authorization'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that work for both authenticated and guest users
 */
const optionalAccountAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        const account = await getFamilyAccountWithProfiles(user.email);
        if (account) {
          req.account = {
            email: account.email,
            accountName: account.accountName,
            isVerified: account.isVerified,
            maxProfiles: account.maxProfiles,
            profiles: account.profiles
          };
          console.log(`✅ Optional auth successful: ${req.account.email}`);
        }
      }
    }

    next();
  } catch (error) {
    console.error('❌ Optional auth error:', error);
    next(); // Continue even if auth fails
  }
};

/**
 * Rate limiting for authentication endpoints (login, signup)
 * More restrictive to prevent brute force attacks
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per 15 minutes
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🚫 Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again in 15 minutes'
    });
  }
});

/**
 * Rate limiting for general API endpoints
 * More generous for normal app usage
 */
const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🚫 API rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down and try again'
    });
  }
});

/**
 * Middleware to check if account's email is verified
 * Some features might require email verification
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.account?.isVerified) {
    console.log(`🚫 Email verification required for: ${req.account?.email}`);
    return res.status(403).json({
      error: 'Email verification required',
      message: 'Please verify your email address to access this feature'
    });
  }
  next();
};

/**
 * Logout middleware - cleans up session
 * Call this before sending logout response
 */
const cleanupSession = async (req, res, next) => {
  try {
    // Supabase manages sessions; nothing to clean up server-side
    next();
  } catch (error) {
    console.error('❌ Session cleanup error:', error);
    next();
  }
};

/**
 * Middleware to validate request body for common auth operations
 */
const validateAuthRequest = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field].trim() === '') {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
      return res.status(400).json({
        error: 'Missing required fields',
        message: `Please provide: ${missingFields.join(', ')}`,
        missingFields
      });
    }
    
    next();
  };
};

/**
 * Security headers middleware
 * Adds important security headers to responses
 */
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Require HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

module.exports = {
  authenticateAccount,
  authorizeProfileAccess,
  optionalAccountAuth,
  authRateLimit,
  apiRateLimit,
  requireEmailVerification,
  cleanupSession,
  validateAuthRequest,
  securityHeaders
};