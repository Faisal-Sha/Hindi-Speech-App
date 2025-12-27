// backend/utils/familyAuth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Environment variables - add these to your .env file
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * We use a high number of rounds (12) for security
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
const hashPassword = async (password) => {
  try {
    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    console.log('✅ Password hashed successfully');
    return hash;
  } catch (error) {
    console.error('❌ Error hashing password:', error);
    throw new Error('Password hashing failed');
  }
};

/**
 * Compare a password with its hash
 * This is how we verify login attempts
 * @param {string} password - Plain text password from login
 * @param {string} hash - Hashed password from database
 * @returns {Promise<boolean>} - True if password matches
 */
const comparePassword = async (password, hash) => {
  try {
    console.log('🔍 Comparing password with hash...');
    const isMatch = await bcrypt.compare(password, hash);
    console.log(`${isMatch ? '✅' : '❌'} Password comparison result: ${isMatch}`);
    return isMatch;
  } catch (error) {
    console.error('❌ Error comparing password:', error);
    return false;
  }
};

/**
 * Generate a JWT token for an authenticated account
 * This token will be sent to the frontend and stored
 * @param {object} payload - Data to include in token (account info)
 * @returns {string} - JWT token
 */
const generateAccountToken = (payload) => {
  try {
    console.log('🎫 Generating JWT token for account:', payload.email);
    
    const token = jwt.sign(
      {
        email: payload.email,
        accountName: payload.accountName,
        accountId: payload.accountId
      }, 
      JWT_SECRET, 
      { 
        expiresIn: JWT_EXPIRE,
        issuer: 'family-assistant-app',
        audience: 'family-assistant-users'
      }
    );
    
    console.log('✅ JWT token generated successfully');
    return token;
  } catch (error) {
    console.error('❌ Error generating token:', error);
    throw new Error('Token generation failed');
  }
};

/**
 * Verify and decode a JWT token
 * This happens on every protected request
 * @param {string} token - JWT token to verify
 * @returns {object|null} - Decoded payload or null if invalid
 */
const verifyAccountToken = (token) => {
  try {
    console.log('🔍 Verifying JWT token...');
    
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'family-assistant-app',
      audience: 'family-assistant-users'
    });
    
    console.log('✅ Token verified successfully for:', decoded.email);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('⏰ Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('🚫 Token is invalid');
    } else {
      console.error('❌ Token verification error:', error.message);
    }
    return null;
  }
};

/**
 * Hash a token for secure database storage
 * We don't store raw tokens in the database for security
 * @param {string} token - Token to hash
 * @returns {string} - Hashed token
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate a secure random token for email verification, etc.
 * @returns {string} - Random token
 */
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Validate email format using regex
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email);
  console.log(`📧 Email validation for "${email}": ${isValid ? 'valid' : 'invalid'}`);
  return isValid;
};

/**
 * Validate password strength with specific requirements
 * @param {string} password - Password to validate
 * @returns {object} - {isValid: boolean, errors: string[]}
 */
const validatePassword = (password) => {
  console.log('🔒 Validating password strength...');
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  const result = {
    isValid: errors.length === 0,
    errors
  };
  
  console.log(`🔒 Password validation result: ${result.isValid ? 'valid' : 'invalid'}`);
  if (!result.isValid) {
    console.log('❌ Password errors:', result.errors);
  }
  
  return result;
};

/**
 * Validate account name (for family names)
 * @param {string} accountName - Account name to validate
 * @returns {object} - {isValid: boolean, errors: string[]}
 */
const validateAccountName = (accountName) => {
  console.log('👨‍👩‍👧‍👦 Validating account name...');
  const errors = [];
  
  if (!accountName || accountName.trim().length < 2) {
    errors.push('Account name must be at least 2 characters long');
  }
  
  if (accountName && accountName.length > 50) {
    errors.push('Account name must be less than 50 characters');
  }
  
  if (accountName && !/^[a-zA-Z0-9\s\-']+$/.test(accountName)) {
    errors.push('Account name can only contain letters, numbers, spaces, hyphens, and apostrophes');
  }
  
  const result = {
    isValid: errors.length === 0,
    errors
  };
  
  console.log(`👨‍👩‍👧‍👦 Account name validation result: ${result.isValid ? 'valid' : 'invalid'}`);
  return result;
};

/**
 * Generate a user-friendly profile ID from display name
 * @param {string} displayName - Profile's display name
 * @param {string} accountEmail - Account email for uniqueness
 * @returns {string} - Generated profile ID
 */
const generateProfileId = (displayName, accountEmail) => {
  // Clean the display name and make it URL-friendly
  const cleanName = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  // Add a short hash for uniqueness
  const accountHash = crypto
    .createHash('md5')
    .update(accountEmail)
    .digest('hex')
    .substring(0, 4);
  
  const profileId = `${cleanName}_${accountHash}`;
  console.log(`👤 Generated profile ID: ${profileId} for "${displayName}"`);
  return profileId;
};

module.exports = {
  hashPassword,
  comparePassword,
  generateAccountToken,
  verifyAccountToken,
  hashToken,
  generateSecureToken,
  isValidEmail,
  validatePassword,
  validateAccountName,
  generateProfileId,
  JWT_SECRET,
  JWT_EXPIRE
};