/**
 * Tests cryptographic primitives for KNX Secure.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it } from 'node:test'
import assert from 'assert'
import {
	calculateMessageAuthenticationCodeCBC,
	decryptCtr,
	encryptDataCtr,
	deriveDeviceAuthenticationPassword,
	deriveUserPassword,
	generateEcdhKeyPair,
} from '../../src/secure/security_primitives'
import {
	bytePad,
	sha256Hash,
	extractPassword,
	decryptAes128Cbc,
} from '../../src/secure/util'
import {
	createCipheriv,
	createPublicKey,
	diffieHellman,
	randomBytes,
} from 'crypto'

describe('secure util', () => {
	describe('bytePad', () => {
		it('pads to the next block size when needed', () => {
			const result = bytePad(Buffer.from([1, 2, 3]), 4)
			assert.strictEqual(result.length, 4)
			assert.deepStrictEqual(result, Buffer.from([1, 2, 3, 0]))
		})

		it('returns the original buffer when already aligned', () => {
			const buf = Buffer.from([1, 2, 3, 4])
			const result = bytePad(buf, 4)
			assert.strictEqual(result, buf)
		})
	})

	describe('sha256Hash', () => {
		it('produces a stable digest', () => {
			const digest = sha256Hash(Buffer.from('secure-data'))
			assert.strictEqual(
				digest.toString('hex'),
				'b9dfebc1daec65bc28fd76575f7f4154d3aa2c547be33afa4a43b79d46042115',
			)
		})
	})

	describe('extractPassword', () => {
		it('removes PKCS#7 padding and stops at the first null byte', () => {
			const payload = Buffer.from('secretPass\u0000ignored', 'utf-8')
			const blockSize = 16
			const mod = payload.length % blockSize
			const padLen = mod === 0 ? blockSize : blockSize - mod
			const padded = Buffer.concat([
				payload,
				Buffer.alloc(padLen, padLen),
			])
			assert.strictEqual(extractPassword(padded), 'secretPass')
		})

		it('returns empty string for empty buffers', () => {
			assert.strictEqual(extractPassword(Buffer.alloc(0)), '')
		})
	})

	describe('decryptAes128Cbc', () => {
		it('decrypts data encrypted with AES-128-CBC', () => {
			const key = Buffer.concat([
				Buffer.from('00112233445566778899aabbccddeeff', 'hex'),
				randomBytes(8),
			])
			const iv = Buffer.concat([
				Buffer.from('0102030405060708090a0b0c0d0e0f10', 'hex'),
				randomBytes(8),
			])
			const cipher = createCipheriv(
				'aes-128-cbc',
				key.slice(0, 16),
				iv.slice(0, 16),
			)
			const plaintext = Buffer.from('AES util test payload', 'utf-8')
			const encrypted = Buffer.concat([
				cipher.update(plaintext),
				cipher.final(),
			])
			const decrypted = decryptAes128Cbc(encrypted, key, iv)
			assert.strictEqual(
				decrypted.toString('utf-8'),
				'AES util test payload',
			)
		})
	})
})

describe('security primitives', () => {
	describe('calculateMessageAuthenticationCodeCBC', () => {
		it('matches the expected MAC output', () => {
			const key = Buffer.from('00112233445566778899aabbccddeeff', 'hex')
			const additional = Buffer.from('aabbccddeeff', 'hex')
			const payload = Buffer.from('0102030405060708', 'hex')
			const mac = calculateMessageAuthenticationCodeCBC(
				key,
				additional,
				payload,
			)
			assert.strictEqual(
				mac.toString('hex'),
				'b976d4018e1ff050c0eab59b292df818',
			)
		})
	})

	describe('encryptDataCtr and decryptCtr', () => {
		it('encrypts and decrypts payloads symmetrically and preserves MAC', () => {
			const key = Buffer.from('00112233445566778899aabbccddeeff', 'hex')
			const counter0 = Buffer.from(
				'000102030405060708090a0b0c0d0e0f',
				'hex',
			)
			const macCbc = Buffer.from(
				'f0e1d2c3b4a5968778695a4b3c2d1e0f',
				'hex',
			)
			const payload = Buffer.from('010203040506', 'hex')
			const [encryptedPayload, encryptedMac] = encryptDataCtr(
				key,
				counter0,
				macCbc,
				payload,
			)
			assert.strictEqual(encryptedPayload.toString('hex'), '01058e149894')
			assert.strictEqual(
				encryptedMac.toString('hex'),
				'd77e6589c1d785d9f7f2d4bdedc3fe0c',
			)

			const [decPayload, macTr] = decryptCtr(
				key,
				counter0,
				encryptedMac,
				encryptedPayload,
			)
			assert.deepStrictEqual(decPayload, payload)
			assert.strictEqual(macTr.toString('hex'), macCbc.toString('hex'))
		})
	})

	describe('password derivation', () => {
		it('derives the expected device authentication key', () => {
			const derived = deriveDeviceAuthenticationPassword('testDevice')
			assert.strictEqual(
				derived.toString('hex'),
				'7ee704e7f2293774d34dcc29a616b49f',
			)
		})

		it('derives the expected user password key', () => {
			const derived = deriveUserPassword('testUser')
			assert.strictEqual(
				derived.toString('hex'),
				'25fa29619a35d35c515dbacee4f080e9',
			)
		})
	})

	describe('generateEcdhKeyPair', () => {
		it('produces compatible key pairs for X25519', () => {
			const [privA, pubA] = generateEcdhKeyPair()
			const [privB, pubB] = generateEcdhKeyPair()
			const sharedA = diffieHellman({
				privateKey: privA,
				publicKey: createPublicKey({
					key: pubB,
					format: 'der',
					type: 'spki',
				}),
			})
			const sharedB = diffieHellman({
				privateKey: privB,
				publicKey: createPublicKey({
					key: pubA,
					format: 'der',
					type: 'spki',
				}),
			})
			assert.strictEqual(sharedA.length, 32)
			assert.strictEqual(sharedA.toString('hex'), sharedB.toString('hex'))
		})
	})
})
