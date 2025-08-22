import crypto from 'crypto'

/**
 * Encryption utilities for storing sensitive data like session cookies
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const TAG_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32 // 256 bits
const ITERATIONS = 100000 // PBKDF2 iterations

interface EncryptedData {
  ciphertext: string
  iv: string
  tag: string
  salt: string
}

/**
 * Derives an encryption key from a password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256')
}

/**
 * Encrypts plaintext using AES-256-GCM
 * @param plaintext The text to encrypt
 * @param password The password (APP_SECRET_KEY from environment)
 * @returns Encrypted data with ciphertext, IV, tag, and salt
 */
export function encrypt(plaintext: string, password: string): EncryptedData {
  if (!plaintext || !password) {
    throw new Error('Plaintext and password are required')
  }

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  
  // Derive key from password
  const key = deriveKey(password, salt)
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  // Encrypt the plaintext
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  
  // Get the authentication tag
  const tag = cipher.getAuthTag()
  
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    salt: salt.toString('base64')
  }
}

/**
 * Decrypts ciphertext using AES-256-GCM
 * @param encrypted The encrypted data object
 * @param password The password (APP_SECRET_KEY from environment)
 * @returns The decrypted plaintext
 */
export function decrypt(encrypted: EncryptedData, password: string): string {
  if (!encrypted || !password) {
    throw new Error('Encrypted data and password are required')
  }

  const { ciphertext, iv, tag, salt } = encrypted

  if (!ciphertext || !iv || !tag || !salt) {
    throw new Error('Invalid encrypted data format')
  }

  try {
    // Convert from base64
    const saltBuffer = Buffer.from(salt, 'base64')
    const ivBuffer = Buffer.from(iv, 'base64')
    const tagBuffer = Buffer.from(tag, 'base64')
    const encryptedBuffer = Buffer.from(ciphertext, 'base64')
    
    // Derive key from password
    const key = deriveKey(password, saltBuffer)
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer)
    decipher.setAuthTag(tagBuffer)
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final()
    ])
    
    return decrypted.toString('utf8')
  } catch (error) {
    // Don't expose details about decryption failures
    throw new Error('Decryption failed')
  }
}

/**
 * Encrypts data for storage in database as a single JSON string
 * @param plaintext The text to encrypt
 * @param password The password (APP_SECRET_KEY from environment)
 * @returns JSON string containing encrypted data
 */
export function encryptForStorage(plaintext: string, password: string): string {
  const encrypted = encrypt(plaintext, password)
  return JSON.stringify(encrypted)
}

/**
 * Decrypts data from database storage
 * @param encryptedJson JSON string containing encrypted data
 * @param password The password (APP_SECRET_KEY from environment)
 * @returns The decrypted plaintext
 */
export function decryptFromStorage(encryptedJson: string, password: string): string {
  try {
    const encrypted = JSON.parse(encryptedJson) as EncryptedData
    return decrypt(encrypted, password)
  } catch (error) {
    throw new Error('Invalid encrypted data format')
  }
}

/**
 * Validates that a password meets minimum security requirements
 * @param password The password to validate
 * @returns true if password is valid
 */
export function validatePassword(password: string): boolean {
  // Ensure password is at least 32 characters (256 bits when base64 encoded)
  return password && password.length >= 32
}

/**
 * Generates a secure random key for use as APP_SECRET_KEY
 * @returns Base64 encoded random key
 */
export function generateSecretKey(): string {
  return crypto.randomBytes(32).toString('base64')
}