/**
 * Encryption and Decryption functions for KNX Secure
 */

import * as crypto from 'crypto'
import { bytePad } from './util'

/**
 * Calculate the message authentication code (MAC) for a message with AES-CBC
 * @param key - 16-byte AES key
 * @param additionalData - Additional data to be included in the MAC calculation
 * @param payload - Optional payload data
 * @param block0 - Optional block 0 (defaults to 16 zero bytes)
 * @returns MAC (16 bytes)
 */
export function calculateMessageAuthenticationCodeCBC(
	key: Buffer,
	additionalData: Buffer,
	payload: Buffer = Buffer.alloc(0),
	block0: Buffer = Buffer.alloc(16),
): Buffer {
	// Concatenate block0 + additional data length (2 bytes) + additional data + payload
	const additionalDataLength = Buffer.alloc(2)
	additionalDataLength.writeUInt16BE(additionalData.length, 0)

	// Use Buffer.from for better type compatibility
	const blocks = Buffer.from(
		Buffer.concat([block0, additionalDataLength, additionalData, payload]),
	)

	// Apply padding to ensure blocks are multiple of 16 bytes
	const paddedBlocks = bytePad(blocks, 16)

	// Use AES-CBC with zero IV
	const iv = Buffer.alloc(16)
	// Use key.slice(0, 16) to ensure key is exactly 16 bytes
	const cipher = crypto.createCipheriv('aes-128-cbc', key.slice(0, 16), iv)
	cipher.setAutoPadding(false) // We've already padded manually

	const encrypted = Buffer.from(
		Buffer.concat([cipher.update(paddedBlocks), cipher.final()]),
	)

	// Return last 16 bytes (MAC)
	return Buffer.from(encrypted.slice(encrypted.length - 16))
}

/**
 * Decrypt data from SecureWrapper
 * @param key - 16-byte AES key
 * @param counter0 - Initial counter value (16 bytes)
 * @param mac - MAC value (16 bytes)
 * @param payload - Encrypted payload
 * @returns Tuple of [decrypted data, MAC-TR for verification]
 */
export function decryptCtr(
	key: Buffer,
	counter0: Buffer,
	mac: Buffer,
	payload: Buffer = Buffer.alloc(0),
): [Buffer, Buffer] {
	// For AES-CTR in Node.js, we need to ensure the counter is properly formatted
	const cipher = crypto.createDecipheriv(
		'aes-128-ctr',
		key.slice(0, 16),
		counter0.slice(0, 16),
	)

	// MAC is encrypted with counter 0
	const macTr = Buffer.from(cipher.update(mac))

	// Decrypt the payload
	const decryptedData = Buffer.from(
		Buffer.concat([cipher.update(payload), cipher.final()]),
	)

	return [decryptedData, macTr]
}

/**
 * Encrypt data with AES-CTR
 * @param key - 16-byte AES key
 * @param counter0 - Initial counter value (16 bytes)
 * @param macCbc - CBC-MAC value (16 bytes)
 * @param payload - Data to encrypt
 * @returns Tuple of [encrypted payload, encrypted MAC]
 */
export function encryptDataCtr(
	key: Buffer,
	counter0: Buffer,
	macCbc: Buffer,
	payload: Buffer = Buffer.alloc(0),
): [Buffer, Buffer] {
	// Use AES-CTR for encryption
	const cipher = crypto.createCipheriv(
		'aes-128-ctr',
		key.slice(0, 16),
		counter0.slice(0, 16),
	)

	// Encrypt MAC with counter 0
	const encryptedMac = Buffer.from(cipher.update(macCbc))

	// Encrypt the payload
	const encryptedData = Buffer.from(
		Buffer.concat([cipher.update(payload), cipher.final()]),
	)

	return [encryptedData, encryptedMac]
}

/**
 * Derive device authentication password using PBKDF2
 * @param deviceAuthenticationPassword - Password string
 * @returns 16-byte derived key
 */
export function deriveDeviceAuthenticationPassword(
	deviceAuthenticationPassword: string,
): Buffer {
	return crypto.pbkdf2Sync(
		Buffer.from(deviceAuthenticationPassword, 'latin1'),
		'device-authentication-code.1.secure.ip.knx.org',
		65536,
		16,
		'sha256',
	)
}

/**
 * Derive user password using PBKDF2
 * @param passwordString - Password string
 * @returns 16-byte derived key
 */
export function deriveUserPassword(passwordString: string): Buffer {
	return crypto.pbkdf2Sync(
		Buffer.from(passwordString, 'latin1'),
		'user-password.1.secure.ip.knx.org',
		65536,
		16,
		'sha256',
	)
}

/**
 * Generate an ECDH key pair using X25519
 * @returns Tuple of [privateKey, publicKey]
 */
export function generateEcdhKeyPair(): [crypto.KeyObject, Buffer] {
	// Generate private key
	const privateKey = crypto.generateKeyPairSync('x25519').privateKey

	// Export public key - Note: raw format is not directly supported in types, using 'as any'
	const publicKey = crypto.createPublicKey(privateKey).export({
		format: 'der',
		type: 'spki',
	})

	return [privateKey, Buffer.from(publicKey)]
}
