/**
 * Helper utilities for KNX Secure operations.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

/**
 * Utility functions for KNX Secure implementation
 */
import * as crypto from 'crypto'

/**
 * Pad a buffer to a multiple of the specified block size
 * @param buffer - Buffer to pad
 * @param blockSize - Block size (default: 16 bytes for AES)
 * @returns Padded buffer
 */
export function bytePad(buffer: Buffer, blockSize = 16): Buffer {
	if (buffer.length % blockSize === 0) {
		return buffer
	}

	const paddingLength = blockSize - (buffer.length % blockSize)
	const padding = Buffer.alloc(paddingLength, 0)
	// Use Buffer.from for better type compatibility
	return Buffer.from(Buffer.concat([buffer, padding]))
}

/**
 * Calculate SHA256 hash of data
 * @param data - Data to hash
 */
export function sha256Hash(data: Buffer): Buffer {
	return crypto.createHash('sha256').update(data).digest()
}

/**
 * Extract text password from decrypted binary data
 * @param data - Decrypted binary data
 * @returns Password as string
 */
export function extractPassword(data: Buffer): string {
	// KNX keyring passwords are stored with PKCS#7 padding
	// We need to remove the padding bytes at the end

	if (data.length === 0) {
		return ''
	}

	// Get the padding length from the last byte
	const paddingLength = data[data.length - 1]

	// Validate padding (all padding bytes should have the same value)
	if (paddingLength > 0 && paddingLength <= data.length) {
		let validPadding = true
		for (let i = data.length - paddingLength; i < data.length; i++) {
			if (data[i] !== paddingLength) {
				validPadding = false
				break
			}
		}

		if (validPadding) {
			// Remove padding
			data = data.slice(0, data.length - paddingLength)
		}
	}

	// Find null terminator in the unpadded data
	let endPos = data.indexOf(0)
	if (endPos === -1) {
		endPos = data.length
	}

	// Convert to string
	return data.slice(0, endPos).toString('utf8')
}

/**
 * Decrypt data using AES-128-CBC
 * @param data - Encrypted data
 * @param key - AES key (will be truncated to 16 bytes if longer)
 * @param iv - Initialization vector (will be truncated to 16 bytes if longer)
 * @returns Decrypted data
 */
export function decryptAes128Cbc(
	data: Buffer,
	key: Buffer,
	iv: Buffer,
): Buffer {
	// Ensure key and IV are exactly 16 bytes for AES-128
	const aesKey = key.slice(0, 16)
	const aesIv = iv.slice(0, 16)

	const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, aesIv)
	decipher.setAutoPadding(true) // Let Node.js handle PKCS#7 padding
	// Use Buffer.from for better type compatibility
	return Buffer.from(Buffer.concat([decipher.update(data), decipher.final()]))
}
