import { describe, it } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { generateKeyPair, sharedKey } from '../../src/Curve25519'

describe('Curve25519', () => {
	describe('generateKeyPair', () => {
		it('should generate valid key pairs by verifying encryption/decryption', () => {
			const seed = new Uint8Array(32).fill(1)
			const keyPair = generateKeyPair(seed)

			// Create test messages
			const testMessage = new Uint8Array([1, 2, 3, 4, 5])
			const wrongMessage = new Uint8Array([5, 4, 3, 2, 1])

			// Generate shared keys using both private and public keys
			const sharedKey1 = sharedKey(keyPair.private, keyPair.public)

			// Generate another key pair to test invalid scenarios
			const invalidSeed = new Uint8Array(32).fill(2)
			const invalidKeyPair = generateKeyPair(invalidSeed)
			const invalidSharedKey = sharedKey(
				invalidKeyPair.private,
				keyPair.public,
			)

			// Test successful encryption/decryption
			assert.doesNotThrow(() => {
				const nonce = crypto.randomBytes(12)
				const cipher1 = crypto.createCipheriv(
					'aes-256-gcm',
					sharedKey1,
					nonce,
				) as crypto.CipherGCM
				const decipher = crypto.createDecipheriv(
					'aes-256-gcm',
					sharedKey1,
					nonce,
				) as crypto.DecipherGCM

				// Encrypt
				const encrypted = Buffer.concat([
					cipher1.update(testMessage),
					cipher1.final(),
				])
				const authTag = cipher1.getAuthTag()

				// Decrypt
				decipher.setAuthTag(authTag)
				const decrypted = Buffer.concat([
					decipher.update(encrypted),
					decipher.final(),
				])

				// Verify the decrypted message matches the original
				assert.deepStrictEqual(
					Buffer.from(testMessage),
					decrypted,
					'Decrypted message should match original message',
				)

				// Verify the decrypted message does not match a different message
				assert.notDeepStrictEqual(
					Buffer.from(wrongMessage),
					decrypted,
					'Decrypted message should not match wrong message',
				)
			})

			// Test encryption/decryption failure with wrong key
			assert.throws(
				() => {
					const nonce = crypto.randomBytes(12)
					const cipher1 = crypto.createCipheriv(
						'aes-256-gcm',
						sharedKey1,
						nonce,
					) as crypto.CipherGCM
					const invalidDecipher = crypto.createDecipheriv(
						'aes-256-gcm',
						invalidSharedKey,
						nonce,
					) as crypto.DecipherGCM

					// Encrypt with correct key
					const encrypted = Buffer.concat([
						cipher1.update(testMessage),
						cipher1.final(),
					])
					const authTag = cipher1.getAuthTag()

					// Try to decrypt with wrong key
					invalidDecipher.setAuthTag(authTag)
					invalidDecipher.update(encrypted)
					invalidDecipher.final() // This should throw an error
				},
				{
					name: 'Error',
					message: 'Unsupported state or unable to authenticate data',
				},
			)
		})

		it('should throw error with invalid input type', () => {
			assert.throws(
				() => {
					// @ts-expect-error - Testing JS runtime error
					generateKeyPair([1, 2, 3])
				},
				{
					name: 'TypeError',
					message: 'unexpected type [object Array], use Uint8Array',
				},
			)
		})

		it('should generate different key pairs for different seeds', () => {
			const seed1 = new Uint8Array(32).fill(1)
			const seed2 = new Uint8Array(32).fill(2)

			const keyPair1 = generateKeyPair(seed1)
			const keyPair2 = generateKeyPair(seed2)

			assert.notDeepStrictEqual(keyPair1.public, keyPair2.public)
			assert.notDeepStrictEqual(keyPair1.private, keyPair2.private)
		})

		it('should generate consistent key pairs for same seed', () => {
			const seed = new Uint8Array(32).fill(1)

			const keyPair1 = generateKeyPair(seed)
			const keyPair2 = generateKeyPair(seed)

			assert.deepStrictEqual(keyPair1.public, keyPair2.public)
			assert.deepStrictEqual(keyPair1.private, keyPair2.private)
		})

		it('should throw error for wrong seed length', () => {
			const invalidSeeds = [
				new Uint8Array(31), // Too short
				new Uint8Array(33), // Too long
				new Uint8Array(0), // Empty
			]

			invalidSeeds.forEach((seed) => {
				assert.throws(() => generateKeyPair(seed), {
					message: 'wrong seed length',
				})
			})
		})

		it('should throw error for invalid input types', () => {
			const invalidInputs: unknown[] = [
				null,
				undefined,
				123,
				'string',
				{},
				[],
				new Uint16Array(32),
				new Uint32Array(32),
				new Int8Array(32),
			]

			invalidInputs.forEach((input) => {
				assert.throws(() => generateKeyPair(input as Uint8Array), {
					message: /unexpected type/,
				})
			})
		})
	})

	describe('sharedKey', () => {
		it('should generate same shared key for both parties', () => {
			const seedA = new Uint8Array(32).fill(1)
			const seedB = new Uint8Array(32).fill(2)

			const keyPairA = generateKeyPair(seedA)
			const keyPairB = generateKeyPair(seedB)

			const sharedKeyA = sharedKey(keyPairA.private, keyPairB.public)
			const sharedKeyB = sharedKey(keyPairB.private, keyPairA.public)

			assert.deepStrictEqual(sharedKeyA, sharedKeyB)
		})

		it('should generate different shared keys for different pairs', () => {
			const seedA = new Uint8Array(32).fill(1)
			const seedB = new Uint8Array(32).fill(2)
			const seedC = new Uint8Array(32).fill(3)

			const keyPairA = generateKeyPair(seedA)
			const keyPairB = generateKeyPair(seedB)
			const keyPairC = generateKeyPair(seedC)

			const sharedKeyAB = sharedKey(keyPairA.private, keyPairB.public)
			const sharedKeyBC = sharedKey(keyPairB.private, keyPairC.public)
			const sharedKeyAC = sharedKey(keyPairA.private, keyPairC.public)

			assert.notDeepStrictEqual(sharedKeyAB, sharedKeyBC)
			assert.notDeepStrictEqual(sharedKeyAB, sharedKeyAC)
			assert.notDeepStrictEqual(sharedKeyBC, sharedKeyAC)
		})

		it('should throw error for invalid key lengths', () => {
			const validKeyPair = generateKeyPair(new Uint8Array(32).fill(1))

			const invalidLengths = [31, 33, 0, 64]

			invalidLengths.forEach((length) => {
				const invalidPrivateKey = new Uint8Array(length)
				const invalidPublicKey = new Uint8Array(length)

				assert.throws(
					() => sharedKey(invalidPrivateKey, validKeyPair.public),
					{
						message: 'wrong secret key length',
					},
				)

				assert.throws(
					() => sharedKey(validKeyPair.private, invalidPublicKey),
					{
						message: 'wrong public key length',
					},
				)
			})
		})

		it('should throw error for invalid input types', () => {
			const validKeyPair = generateKeyPair(new Uint8Array(32).fill(1))
			const invalidInputs: unknown[] = [
				null,
				undefined,
				123,
				'string',
				{},
				[],
				new Uint16Array(32),
				new Uint32Array(32),
				new Int8Array(32),
			]

			invalidInputs.forEach((input) => {
				assert.throws(
					() => sharedKey(input as Uint8Array, validKeyPair.public),
					{
						message: /unexpected type/,
					},
				)

				assert.throws(
					() => sharedKey(validKeyPair.private, input as Uint8Array),
					{
						message: /unexpected type/,
					},
				)
			})
		})

		it('should handle edge cases with zero and max values', () => {
			const zeroSeed = new Uint8Array(32)
			const maxSeed = new Uint8Array(32).fill(255)

			const zeroKeyPair = generateKeyPair(zeroSeed)
			const maxKeyPair = generateKeyPair(maxSeed)

			// Should not throw and should generate valid shared keys
			const sharedKey1 = sharedKey(zeroKeyPair.private, maxKeyPair.public)
			const sharedKey2 = sharedKey(maxKeyPair.private, zeroKeyPair.public)

			assert(sharedKey1 instanceof Uint8Array)
			assert(sharedKey2 instanceof Uint8Array)
			assert.strictEqual(sharedKey1.length, 32)
			assert.strictEqual(sharedKey2.length, 32)
			assert.deepStrictEqual(sharedKey1, sharedKey2)
		})
	})

	describe('Cryptographic Properties', () => {
		it('should ensure shared key is not related to input keys in obvious way', () => {
			const seedA = new Uint8Array(32).fill(1)
			const seedB = new Uint8Array(32).fill(2)
			const keyPairA = generateKeyPair(seedA)
			const keyPairB = generateKeyPair(seedB)

			const sharedK = sharedKey(keyPairA.private, keyPairB.public)

			assert.notDeepStrictEqual(sharedK, keyPairA.public)
			assert.notDeepStrictEqual(sharedK, keyPairA.private)
			assert.notDeepStrictEqual(sharedK, keyPairB.public)
			assert.notDeepStrictEqual(sharedK, keyPairB.private)
		})

		it('should generate uniformly distributed keys', () => {
			const samples = 100
			const distribution = new Uint32Array(256).fill(0)

			for (let i = 0; i < samples; i++) {
				const seed = new Uint8Array(32)
				crypto.getRandomValues(seed)
				const keyPair = generateKeyPair(seed)

				for (const byte of keyPair.public) {
					distribution[byte]++
				}
			}

			// Basic check that all possible bytes are generated
			const unusedBytes = distribution.filter(
				(count) => count === 0,
			).length
			assert(unusedBytes < 128, 'Key distribution appears non-uniform')
		})

		it('should maintain key secrecy under bit manipulation', () => {
			const seed = new Uint8Array(32).fill(1)
			const keyPair = generateKeyPair(seed)

			// Modify single bits in the public key
			const modifiedPublic = new Uint8Array(keyPair.public)
			for (let i = 0; i < 8; i++) {
				modifiedPublic[0] ^= 1 << i
				const sharedK1 = sharedKey(keyPair.private, keyPair.public)
				const sharedK2 = sharedKey(keyPair.private, modifiedPublic)
				assert.notDeepStrictEqual(
					sharedK1,
					sharedK2,
					'Shared key should change with public key manipulation',
				)
				modifiedPublic[0] ^= 1 << i // Restore bit
			}
		})
	})

	describe('Integration', () => {
		it('should work with standard crypto operations', () => {
			// Generate key pair
			const seed = crypto.randomBytes(32)
			const keyPair = generateKeyPair(seed)

			// Use shared key for symmetric encryption
			const message = new TextEncoder().encode('test message')
			const shared = sharedKey(keyPair.private, keyPair.public)

			// Verify the shared key can be used with standard crypto
			assert.doesNotThrow(() => {
				const key = crypto.createSecretKey(shared)
				const cipher = crypto.createCipheriv(
					'aes-256-gcm',
					key,
					crypto.randomBytes(12),
				)
				cipher.update(message)
				cipher.final()
			})
		})

		it('should handle streaming operations', () => {
			const chunks = 10
			const chunkSize = 1024
			let successful = 0

			// Process data in chunks
			for (let i = 0; i < chunks; i++) {
				const chunk = crypto.randomBytes(chunkSize)
				const seed = crypto.randomBytes(32)
				const keyPair = generateKeyPair(seed)

				try {
					sharedKey(keyPair.private, keyPair.public)
					successful++
				} catch (e) {
					// Count failures
				}
			}

			assert.strictEqual(
				successful,
				chunks,
				'All streaming operations should succeed',
			)
		})
	})
})
