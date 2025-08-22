/**
 * Unit tests for secretBox encryption utilities
 */

import {
  encrypt,
  decrypt,
  encryptForStorage,
  decryptFromStorage,
  validatePassword,
  generateSecretKey,
} from '../secretBox'

describe('SecretBox Encryption', () => {
  const testPassword = 'test-password-that-is-long-enough-32chars'
  const testData = 'This is sensitive data that needs encryption'

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data successfully', () => {
      const encrypted = encrypt(testData, testPassword)
      
      expect(encrypted).toHaveProperty('ciphertext')
      expect(encrypted).toHaveProperty('iv')
      expect(encrypted).toHaveProperty('tag')
      expect(encrypted.ciphertext).not.toBe(testData)
      
      const decrypted = decrypt(encrypted, testPassword)
      expect(decrypted).toBe(testData)
    })

    it('should produce different ciphertext for same data', () => {
      const encrypted1 = encrypt(testData, testPassword)
      const encrypted2 = encrypt(testData, testPassword)
      
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
    })

    it('should fail to decrypt with wrong password', () => {
      const encrypted = encrypt(testData, testPassword)
      const wrongPassword = 'wrong-password-that-is-long-enough-32ch'
      
      expect(() => decrypt(encrypted, wrongPassword)).toThrow()
    })

    it('should handle empty strings', () => {
      const encrypted = encrypt('', testPassword)
      const decrypted = decrypt(encrypted, testPassword)
      expect(decrypted).toBe('')
    })

    it('should handle long strings', () => {
      const longData = 'x'.repeat(10000)
      const encrypted = encrypt(longData, testPassword)
      const decrypted = decrypt(encrypted, testPassword)
      expect(decrypted).toBe(longData)
    })

    it('should handle special characters and unicode', () => {
      const specialData = '🔐 Special chars: !@#$%^&*() 中文 العربية'
      const encrypted = encrypt(specialData, testPassword)
      const decrypted = decrypt(encrypted, testPassword)
      expect(decrypted).toBe(specialData)
    })
  })

  describe('encryptForStorage/decryptFromStorage', () => {
    it('should encrypt and decrypt for storage as JSON string', () => {
      const encrypted = encryptForStorage(testData, testPassword)
      
      expect(typeof encrypted).toBe('string')
      expect(() => JSON.parse(encrypted)).not.toThrow()
      
      const decrypted = decryptFromStorage(encrypted, testPassword)
      expect(decrypted).toBe(testData)
    })

    it('should handle round-trip with complex data', () => {
      const complexData = JSON.stringify({
        cookie: 'session=abc123; expires=2024-12-31',
        metadata: { userId: 123, timestamp: Date.now() }
      })
      
      const encrypted = encryptForStorage(complexData, testPassword)
      const decrypted = decryptFromStorage(encrypted, testPassword)
      expect(decrypted).toBe(complexData)
    })

    it('should fail gracefully with corrupted data', () => {
      expect(() => decryptFromStorage('not-json', testPassword)).toThrow()
      expect(() => decryptFromStorage('{"invalid": "data"}', testPassword)).toThrow()
    })

    it('should fail with missing fields in encrypted data', () => {
      const invalidData = JSON.stringify({ ciphertext: 'test' })
      expect(() => decryptFromStorage(invalidData, testPassword)).toThrow()
    })
  })

  describe('validatePassword', () => {
    it('should validate passwords of correct length', () => {
      expect(validatePassword('a'.repeat(32))).toBe(true)
      expect(validatePassword('a'.repeat(64))).toBe(true)
    })

    it('should reject short passwords', () => {
      expect(validatePassword('')).toBe(false)
      expect(validatePassword('short')).toBe(false)
      expect(validatePassword('a'.repeat(31))).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(validatePassword(null as any)).toBe(false)
      expect(validatePassword(undefined as any)).toBe(false)
    })
  })

  describe('generateSecretKey', () => {
    it('should generate valid base64 keys', () => {
      const key = generateSecretKey()
      
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThanOrEqual(32)
      expect(() => Buffer.from(key, 'base64')).not.toThrow()
    })

    it('should generate unique keys', () => {
      const keys = new Set()
      for (let i = 0; i < 10; i++) {
        keys.add(generateSecretKey())
      }
      expect(keys.size).toBe(10)
    })

    it('should generate keys that pass validation', () => {
      const key = generateSecretKey()
      expect(validatePassword(key)).toBe(true)
    })
  })

  describe('Error handling', () => {
    it('should throw descriptive errors for decryption failures', () => {
      const encrypted = encrypt(testData, testPassword)
      
      // Tamper with tag
      const tamperedData = { ...encrypted, tag: 'invalid-tag' }
      expect(() => decrypt(tamperedData, testPassword)).toThrow(/decrypt/)
    })

    it('should handle invalid base64 in storage format', () => {
      const invalidData = JSON.stringify({
        ciphertext: '!!!invalid-base64!!!',
        iv: 'valid-base64',
        tag: 'valid-base64'
      })
      expect(() => decryptFromStorage(invalidData, testPassword)).toThrow()
    })
  })

  describe('Security properties', () => {
    it('should not leak password in error messages', () => {
      const encrypted = encrypt(testData, testPassword)
      try {
        decrypt(encrypted, 'wrong-password-that-is-long-enough')
      } catch (error: any) {
        expect(error.message).not.toContain(testPassword)
        expect(error.message).not.toContain('wrong-password')
      }
    })

    it('should not store plaintext in encrypted object', () => {
      const encrypted = encrypt(testData, testPassword)
      const encryptedStr = JSON.stringify(encrypted)
      expect(encryptedStr).not.toContain(testData)
    })
  })
})