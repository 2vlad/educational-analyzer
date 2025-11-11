import {
  encrypt,
  decrypt,
  encryptForStorage,
  decryptFromStorage,
  validatePassword,
  generateSecretKey,
} from './secretBox'

describe('SecretBox Encryption', () => {
  const testPassword = 'test-secret-key-at-least-32-chars-long'
  const testPlaintext = 'This is a secret session cookie value'

  describe('encrypt', () => {
    it('should encrypt plaintext successfully', () => {
      const encrypted = encrypt(testPlaintext, testPassword)

      expect(encrypted).toHaveProperty('ciphertext')
      expect(encrypted).toHaveProperty('iv')
      expect(encrypted).toHaveProperty('tag')
      expect(encrypted).toHaveProperty('salt')

      // Ensure all fields are base64 strings
      expect(encrypted.ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(encrypted.iv).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(encrypted.tag).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(encrypted.salt).toMatch(/^[A-Za-z0-9+/]+=*$/)
    })

    it('should produce different ciphertexts for same input', () => {
      const encrypted1 = encrypt(testPlaintext, testPassword)
      const encrypted2 = encrypt(testPlaintext, testPassword)

      // Different IVs and salts should produce different ciphertexts
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
      expect(encrypted1.salt).not.toBe(encrypted2.salt)
    })

    it('should throw error for missing plaintext', () => {
      expect(() => encrypt('', testPassword)).toThrow('Plaintext and password are required')
    })

    it('should throw error for missing password', () => {
      expect(() => encrypt(testPlaintext, '')).toThrow('Plaintext and password are required')
    })
  })

  describe('decrypt', () => {
    it('should decrypt encrypted data successfully', () => {
      const encrypted = encrypt(testPlaintext, testPassword)
      const decrypted = decrypt(encrypted, testPassword)

      expect(decrypted).toBe(testPlaintext)
    })

    it('should fail with wrong password', () => {
      const encrypted = encrypt(testPlaintext, testPassword)
      const wrongPassword = 'wrong-password-that-is-32-chars'

      expect(() => decrypt(encrypted, wrongPassword)).toThrow('Decryption failed')
    })

    it('should fail with corrupted ciphertext', () => {
      const encrypted = encrypt(testPlaintext, testPassword)
      encrypted.ciphertext = 'corrupted-data'

      expect(() => decrypt(encrypted, testPassword)).toThrow('Decryption failed')
    })

    it('should fail with missing fields', () => {
      const invalidData = {
        ciphertext: 'test',
        iv: 'test',
        tag: '', // missing tag
        salt: 'test',
      }

      expect(() => decrypt(invalidData, testPassword)).toThrow('Invalid encrypted data format')
    })

    it('should throw error for null encrypted data', () => {
      expect(() => decrypt(null as any, testPassword)).toThrow(
        'Encrypted data and password are required',
      )
    })
  })

  describe('encryptForStorage and decryptFromStorage', () => {
    it('should handle round-trip encryption for database storage', () => {
      const encrypted = encryptForStorage(testPlaintext, testPassword)

      // Should be a valid JSON string
      expect(() => JSON.parse(encrypted)).not.toThrow()

      const decrypted = decryptFromStorage(encrypted, testPassword)
      expect(decrypted).toBe(testPlaintext)
    })

    it('should handle special characters in plaintext', () => {
      const specialText = 'Cookie with special chars: !@#$%^&*()_+{}:"<>?[];\',./'
      const encrypted = encryptForStorage(specialText, testPassword)
      const decrypted = decryptFromStorage(encrypted, testPassword)

      expect(decrypted).toBe(specialText)
    })

    it('should handle Unicode characters', () => {
      const unicodeText = 'Session with emoji 🔒 and русский текст'
      const encrypted = encryptForStorage(unicodeText, testPassword)
      const decrypted = decryptFromStorage(encrypted, testPassword)

      expect(decrypted).toBe(unicodeText)
    })

    it('should fail decryption with invalid JSON', () => {
      expect(() => decryptFromStorage('not-json', testPassword)).toThrow(
        'Invalid encrypted data format',
      )
    })
  })

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      expect(validatePassword('a'.repeat(32))).toBe(true)
      expect(validatePassword('a'.repeat(64))).toBe(true)
    })

    it('should reject short passwords', () => {
      expect(validatePassword('short')).toBe(false)
      expect(validatePassword('a'.repeat(31))).toBe(false)
    })

    it('should reject empty passwords', () => {
      expect(validatePassword('')).toBe(false)
      expect(validatePassword(null as any)).toBe(false)
      expect(validatePassword(undefined as any)).toBe(false)
    })
  })

  describe('generateSecretKey', () => {
    it('should generate valid base64 key', () => {
      const key = generateSecretKey()

      // Should be base64
      expect(key).toMatch(/^[A-Za-z0-9+/]+=*$/)

      // Should decode to 32 bytes
      const decoded = Buffer.from(key, 'base64')
      expect(decoded.length).toBe(32)
    })

    it('should generate unique keys', () => {
      const key1 = generateSecretKey()
      const key2 = generateSecretKey()

      expect(key1).not.toBe(key2)
    })
  })

  describe('security scenarios', () => {
    it('should not expose sensitive information in errors', () => {
      const encrypted = encrypt(testPlaintext, testPassword)
      encrypted.tag = 'invalid-tag'

      try {
        decrypt(encrypted, testPassword)
      } catch (error: any) {
        // Error should not contain details about what went wrong
        expect(error.message).toBe('Decryption failed')
        expect(error.message).not.toContain('tag')
        expect(error.message).not.toContain('authentication')
      }
    })

    it('should handle large payloads', () => {
      const largeText = 'x'.repeat(10000) // 10KB of data
      const encrypted = encryptForStorage(largeText, testPassword)
      const decrypted = decryptFromStorage(encrypted, testPassword)

      expect(decrypted).toBe(largeText)
    })
  })
})
