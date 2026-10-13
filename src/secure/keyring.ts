/**
 * Loads and manages KNX Secure keyring files.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as xml2js from 'xml2js'
import * as zlib from 'zlib'

// Address classes
export class IndividualAddress {
	raw: number

	constructor(address: string | number) {
		if (typeof address === 'string') {
			const parts = address.split('.')
			if (parts.length !== 3) {
				throw new Error(`Invalid individual address format: ${address}`)
			}
			const area = parseInt(parts[0])
			const line = parseInt(parts[1])
			const device = parseInt(parts[2])
			this.raw = (area << 12) | (line << 8) | device
		} else {
			this.raw = address
		}
	}

	toString(): string {
		const area = (this.raw >> 12) & 0xf
		const line = (this.raw >> 8) & 0xf
		const device = this.raw & 0xff
		return `${area}.${line}.${device}`
	}
}

export class GroupAddress {
	raw: number

	constructor(address: string | number) {
		if (typeof address === 'string') {
			// Check if it's a raw number string
			if (!address.includes('/')) {
				this.raw = parseInt(address)
				return
			}

			const parts = address.split('/')
			if (parts.length === 3) {
				// 3-level format: main/middle/sub
				const main = parseInt(parts[0])
				const middle = parseInt(parts[1])
				const sub = parseInt(parts[2])
				this.raw = (main << 11) | (middle << 8) | sub
			} else if (parts.length === 2) {
				// 2-level format: main/sub
				const main = parseInt(parts[0])
				const sub = parseInt(parts[1])
				this.raw = (main << 11) | sub
			} else {
				throw new Error(`Invalid group address format: ${address}`)
			}
		} else {
			this.raw = address
		}
	}

	toString(): string {
		const main = (this.raw >> 11) & 0x1f
		const middle = (this.raw >> 8) & 0x7
		const sub = this.raw & 0xff
		return `${main}/${middle}/${sub}`
	}
}

// Interface for keyring data structures
export interface Interface {
	type: string
	individualAddress: IndividualAddress
	host?: IndividualAddress
	userId?: number
	password?: string
	authentication?: string
	decryptedPassword?: string
	decryptedAuthentication?: string
	groupAddresses: Map<string, IndividualAddress[]>
}

export interface Backbone {
	key?: string
	decryptedKey?: Buffer
	latency?: number
	multicastAddress?: string
}

export interface GroupAddressKey {
	address: GroupAddress
	key: string
	decryptedKey?: Buffer
}

export interface Device {
	individualAddress: IndividualAddress
	toolKey?: string
	decryptedToolKey?: Buffer
	managementPassword?: string
	decryptedManagementPassword?: string
	authentication?: string
	decryptedAuthentication?: string
	sequenceNumber?: number
	serialNumber?: string
}

export interface KeyringLoadOptions {
	/**
	 * Verify the ETS keyring signature (default: true, as XKNX). With true a
	 * keyring without a Signature attribute is rejected; set false only for
	 * keyrings that were not exported by ETS.
	 */
	validateSignature?: boolean
}

export class Keyring {
	private interfaces: Map<string, Interface> = new Map()

	private backbones: Backbone[] = []

	private groupAddresses: Map<string, GroupAddressKey> = new Map()

	private devices: Map<string, Device> = new Map()

	private passwordHash?: Buffer

	private createdBy?: string

	private created?: string

	private iv?: Buffer

	/**
	 * Load keyring content using either a file path to a .knxkeys file
	 * or a string containing the keyring (raw XML or base64 of the .knxkeys binary).
	 */
	async load(
		source: string,
		password: string,
		options: KeyringLoadOptions = {},
	): Promise<void> {
		let xmlContent: string

		if (fs.existsSync(source)) {
			// Load from file path (.knxkeys)
			if (process.env.KNX_DEBUG === '1')
				console.log('🔐 Loading keyring file:', source)
			const zipContent = fs.readFileSync(source)
			xmlContent = await this.unzipKnxKeys(zipContent)
		} else {
			// Load from provided string: try XML first, then base64-encoded .knxkeys
			const trimmed = (source || '').trim()
			if (trimmed.startsWith('<')) {
				// Raw XML string
				xmlContent = trimmed
			} else {
				// Try base64-encoded .knxkeys content
				try {
					const buf = Buffer.from(trimmed, 'base64')
					// If base64 was invalid, the buffer will be small or garbage; unzip will throw
					xmlContent = await this.unzipKnxKeys(buf)
				} catch (e) {
					// Fallback: treat the string as XML even if not starting with '<'
					xmlContent = trimmed
				}
			}
		}

		await this.loadFromXml(xmlContent, password, options)
	}

	/**
	 * Explicit helper to load from string (raw XML or base64 .knxkeys).
	 */
	async loadFromString(
		content: string,
		password: string,
		options: KeyringLoadOptions = {},
	): Promise<void> {
		return this.load(content, password, options)
	}

	/**
	 * Explicit helper to load from a Buffer (typically the raw `.knxkeys` file bytes).
	 */
	async loadFromBuffer(
		content: Buffer,
		password: string,
		options: KeyringLoadOptions = {},
	): Promise<void> {
		const xmlContent = await this.unzipKnxKeys(content)
		await this.loadFromXml(xmlContent, password, options)
	}

	getCreatedBy(): string | undefined {
		return this.createdBy
	}

	getCreated(): string | undefined {
		return this.created
	}

	/**
	 * Hash keyring password using PBKDF2 with the correct salt
	 * This is CRITICAL - must use salt "1.keyring.ets.knx.org"
	 */
	private hashKeyringPassword(password: string): Buffer {
		return hashKeyringPassword(password)
	}

	private async loadFromXml(
		xmlContent: string,
		password: string,
		options: KeyringLoadOptions = {},
	): Promise<void> {
		const parser = new xml2js.Parser()
		const result = await parser.parseStringPromise(xmlContent)

		// Hash the password using PBKDF2 (MUST use salt "1.keyring.ets.knx.org")
		this.passwordHash = this.hashKeyringPassword(password)

		// ETS signs the keyring with the password: a mismatch means a wrong
		// password (or a modified file) and would only yield garbage keys.
		if (options.validateSignature !== false) {
			const { signature, computed } = await computeKeyringSignature(
				xmlContent,
				this.passwordHash,
			)
			if (!signature) {
				throw new Error(
					'Keyring signature verification failed: the keyring has no Signature (set validateSignature to false only for keyrings not exported by ETS).',
				)
			}
			if (
				signature.length !== computed.length ||
				!crypto.timingSafeEqual(signature, computed)
			) {
				throw new Error(
					'Keyring signature verification failed: wrong keyring password or modified keyring file.',
				)
			}
		}

		await this.parseKeyring(result)
	}

	/**
	 * Decrypt data using AES-128-CBC
	 */
	private decryptAes128Cbc(
		encryptedData: Buffer,
		key: Buffer,
		iv: Buffer,
	): Buffer {
		const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
		decipher.setAutoPadding(false) // Important: no auto padding
		return Buffer.concat([decipher.update(encryptedData), decipher.final()])
	}

	/**
	 * Extract password from decrypted data (match xknx)
	 * Format: 8 bytes header + password + padding. ETS always encrypts 32 bytes,
	 * so short passwords carry more than 16 padding bytes. Every padding byte
	 * holds the padding length: anything else means a wrong keyring password.
	 */
	private extractPassword(data: Buffer): string {
		if (!data || data.length === 0) return ''
		const pad = data[data.length - 1]
		if (
			pad < 1 ||
			pad > data.length - 8 ||
			!data.subarray(data.length - pad).every((b) => b === pad)
		) {
			throw new Error(
				'Keyring decryption failed: invalid padding (wrong keyring password?).',
			)
		}
		return data.subarray(8, data.length - pad).toString('utf-8')
	}

	/**
	 * Unzip the .knxkeys file to get the XML content
	 */
	private async unzipKnxKeys(zipContent: Buffer): Promise<string> {
		return new Promise((resolve, reject) => {
			zlib.unzip(zipContent.slice(30), (err, buffer) => {
				if (err) {
					// Try to find the XML content manually
					const xmlStart = zipContent.indexOf('<?xml')
					if (xmlStart !== -1) {
						const xmlEnd = zipContent.indexOf('</Keyring>') + 10
						resolve(
							zipContent
								.slice(xmlStart, xmlEnd)
								.toString('utf-8'),
						)
					} else {
						reject(err)
					}
				} else {
					resolve(buffer.toString('utf-8'))
				}
			})
		})
	}

	/**
	 * Parse the keyring XML structure
	 */
	private async parseKeyring(data: any): Promise<void> {
		const keyring = data.Keyring

		if (!keyring) {
			throw new Error('Invalid keyring format')
		}

		// Store metadata
		this.createdBy = keyring.$?.CreatedBy
		this.created = keyring.$?.Created
		if (this.created) {
			const createdHash = crypto
				.createHash('sha256')
				.update(Buffer.from(this.created, 'utf-8'))
				.digest()
			this.iv = createdHash.slice(0, 16)
		}

		if (process.env.KNX_DEBUG === '1')
			console.log(
				`Keyring created by: ${this.createdBy} on ${this.created}`,
			)

		// Parse interfaces
		if (keyring.Interface) {
			const interfaces = Array.isArray(keyring.Interface)
				? keyring.Interface
				: [keyring.Interface]
			for (const iface of interfaces) {
				this.parseInterface(iface)
			}
		}

		// Parse backbone
		if (keyring.Backbone) {
			const backbones = Array.isArray(keyring.Backbone)
				? keyring.Backbone
				: [keyring.Backbone]
			for (const backbone of backbones) {
				this.parseBackbone(backbone)
			}
		}

		// Parse group addresses
		if (keyring.GroupAddresses?.[0]?.Group) {
			const groups = Array.isArray(keyring.GroupAddresses[0].Group)
				? keyring.GroupAddresses[0].Group
				: [keyring.GroupAddresses[0].Group]
			for (const group of groups) {
				this.parseGroupAddress(group)
			}
		}

		// Parse devices
		if (keyring.Devices?.[0]?.Device) {
			const devices = Array.isArray(keyring.Devices[0].Device)
				? keyring.Devices[0].Device
				: [keyring.Devices[0].Device]
			for (const device of devices) {
				this.parseDevice(device)
			}
		}
	}

	/**
	 * Parse and decrypt an interface
	 */
	private parseInterface(data: any): void {
		const attrs = data.$
		if (!attrs) return

		const iface: Interface = {
			type: attrs.Type,
			individualAddress: new IndividualAddress(attrs.IndividualAddress),
			host: attrs.Host ? new IndividualAddress(attrs.Host) : undefined,
			userId: attrs.UserID ? parseInt(attrs.UserID) : undefined,
			password: attrs.Password,
			authentication: attrs.Authentication,
			groupAddresses: new Map(),
		}

		// Decrypt passwords if present
		if (iface.password && this.passwordHash) {
			const encrypted = Buffer.from(iface.password, 'base64')
			const iv = this.iv ?? Buffer.alloc(16, 0)
			const decrypted = this.decryptAes128Cbc(
				encrypted,
				this.passwordHash,
				iv,
			)
			if (process.env.KNX_DEBUG === '1')
				console.log(
					`Interface ${iface.individualAddress} password raw: ${decrypted.length} bytes`,
				)
			iface.decryptedPassword = this.extractPassword(decrypted)
			if (process.env.KNX_DEBUG === '1')
				console.log(
					`Interface ${iface.individualAddress} password: ${iface.decryptedPassword.length} chars`,
				)
		}

		if (iface.authentication && this.passwordHash) {
			const encrypted = Buffer.from(iface.authentication, 'base64')
			const iv = this.iv ?? Buffer.alloc(16, 0)
			const decrypted = this.decryptAes128Cbc(
				encrypted,
				this.passwordHash,
				iv,
			)
			if (process.env.KNX_DEBUG === '1')
				console.log(
					`Interface ${iface.individualAddress} auth raw: ${decrypted.length} bytes`,
				)
			iface.decryptedAuthentication = this.extractPassword(decrypted)
			if (process.env.KNX_DEBUG === '1')
				console.log(
					`Interface ${iface.individualAddress} auth: ${iface.decryptedAuthentication.length} chars`,
				)
		}

		// Parse assigned group addresses
		if (data.Group) {
			const groups = Array.isArray(data.Group) ? data.Group : [data.Group]
			for (const group of groups) {
				const groupAddr = new GroupAddress(group.$.Address)
				const senders = group.$.Senders
					? group.$.Senders.split(' ').map(
							(s: string) => new IndividualAddress(s),
						)
					: []
				iface.groupAddresses.set(groupAddr.toString(), senders)
			}
		}

		this.interfaces.set(iface.individualAddress.toString(), iface)
	}

	/**
	 * Parse and decrypt backbone
	 */
	private parseBackbone(data: any): void {
		const attrs = data.$
		if (!attrs) return

		const backbone: Backbone = {
			key: attrs.Key,
			latency: attrs.Latency ? parseInt(attrs.Latency) : undefined,
			multicastAddress: attrs.MulticastAddress,
		}

		// Decrypt key if present
		if (backbone.key && this.passwordHash) {
			const encrypted = Buffer.from(backbone.key, 'base64')
			const iv = this.iv ?? Buffer.alloc(16, 0)
			backbone.decryptedKey = this.decryptAes128Cbc(
				encrypted,
				this.passwordHash,
				iv,
			)
			if (process.env.KNX_DEBUG === '1')
				console.log(
					`Backbone key: ${backbone.decryptedKey?.length ?? 0} bytes`,
				)
		}

		this.backbones.push(backbone)
	}

	/**
	 * Parse and decrypt group address
	 */
	private parseGroupAddress(data: any): void {
		const attrs = data.$
		if (!attrs || !attrs.Address || !attrs.Key) return

		const group: GroupAddressKey = {
			address: new GroupAddress(attrs.Address),
			key: attrs.Key,
		}

		// Decrypt key
		if (this.passwordHash) {
			const encrypted = Buffer.from(group.key, 'base64')
			const iv = this.iv ?? Buffer.alloc(16, 0)
			group.decryptedKey = this.decryptAes128Cbc(
				encrypted,
				this.passwordHash,
				iv,
			)
			if (process.env.KNX_DEBUG === '1')
				console.log(
					`Group ${group.address} key: ${group.decryptedKey?.length ?? 0} bytes`,
				)
		}

		this.groupAddresses.set(group.address.toString(), group)
	}

	/**
	 * Parse and decrypt device
	 */
	private parseDevice(data: any): void {
		const attrs = data.$
		if (!attrs) return

		const device: Device = {
			individualAddress: new IndividualAddress(attrs.IndividualAddress),
			toolKey: attrs.ToolKey,
			managementPassword: attrs.ManagementPassword,
			authentication: attrs.Authentication,
			sequenceNumber: attrs.SequenceNumber
				? parseInt(attrs.SequenceNumber)
				: undefined,
			serialNumber: attrs.SerialNumber,
		}

		// Decrypt keys and passwords
		if (device.toolKey && this.passwordHash) {
			const encrypted = Buffer.from(device.toolKey, 'base64')
			const iv = this.iv ?? Buffer.alloc(16, 0)
			device.decryptedToolKey = this.decryptAes128Cbc(
				encrypted,
				this.passwordHash,
				iv,
			)
			if (process.env.KNX_DEBUG === '1')
				console.log(
					`Device ${device.individualAddress} tool key: ${device.decryptedToolKey?.length ?? 0} bytes`,
				)
		}

		if (device.managementPassword && this.passwordHash) {
			const encrypted = Buffer.from(device.managementPassword, 'base64')
			const iv = this.iv ?? Buffer.alloc(16, 0)
			const decrypted = this.decryptAes128Cbc(
				encrypted,
				this.passwordHash,
				iv,
			)
			if (process.env.KNX_DEBUG === '1')
				console.log(
					`Device ${device.individualAddress} mgmt raw: ${decrypted.length} bytes`,
				)
			device.decryptedManagementPassword = this.extractPassword(decrypted)
		}

		if (device.authentication && this.passwordHash) {
			const encrypted = Buffer.from(device.authentication, 'base64')
			const iv = this.iv ?? Buffer.alloc(16, 0)
			const decrypted = this.decryptAes128Cbc(
				encrypted,
				this.passwordHash,
				iv,
			)
			if (process.env.KNX_DEBUG === '1')
				console.log(
					`Device ${device.individualAddress} auth raw: ${decrypted.length} bytes`,
				)
			device.decryptedAuthentication = this.extractPassword(decrypted)
		}

		this.devices.set(device.individualAddress.toString(), device)
	}

	// Getters for accessing keyring data
	getInterfaces(): Map<string, Interface> {
		return this.interfaces
	}

	getInterface(address: string): Interface | undefined {
		return this.interfaces.get(address)
	}

	getBackbones(): Backbone[] {
		return this.backbones
	}

	getGroupAddresses(): Map<string, GroupAddressKey> {
		return this.groupAddresses
	}

	getGroupAddress(address: string): GroupAddressKey | undefined {
		return this.groupAddresses.get(address)
	}

	getDevices(): Map<string, Device> {
		return this.devices
	}

	getDevice(address: string): Device | undefined {
		return this.devices.get(address)
	}
}

/**
 * Compute the ETS keyring signature (same algorithm as XKNX): SHA-256 over a
 * serialization of the element tree (start marker, local element name,
 * attributes sorted by name except xmlns/Signature, end marker) followed by
 * the base64 keyring password hash, truncated to 16 bytes. Also returns the
 * Signature found in the keyring (undefined when absent or empty).
 */
export async function computeKeyringSignature(
	xmlContent: string,
	passwordHash: Buffer,
): Promise<{ signature?: Buffer; computed: Buffer }> {
	const parser = new xml2js.Parser({
		explicitChildren: true,
		preserveChildrenOrder: true,
	})
	const doc = await parser.parseStringPromise(xmlContent)
	const root = doc?.Keyring
	const signatureB64: string = root?.$?.Signature ?? ''

	const chunks: Buffer[] = []
	const appendString = (value: string) => {
		const encoded = Buffer.from(value, 'utf-8')
		chunks.push(Buffer.from([encoded.length & 0xff]), encoded)
	}
	const walk = (name: string, node: any) => {
		chunks.push(Buffer.from([1]))
		appendString(name.includes(':') ? name.split(':').pop()! : name)
		const attrs = node?.$ || {}
		for (const attr of Object.keys(attrs).sort()) {
			if (attr === 'xmlns' || attr === 'Signature') continue
			appendString(attr)
			appendString(String(attrs[attr]))
		}
		for (const child of node?.$$ || []) walk(child['#name'], child)
		chunks.push(Buffer.from([2]))
	}
	walk('Keyring', root)
	appendString(passwordHash.toString('base64'))

	const computed = crypto
		.createHash('sha256')
		.update(Buffer.concat(chunks))
		.digest()
		.subarray(0, 16)
	const signature = signatureB64.trim()
		? Buffer.from(signatureB64, 'base64')
		: undefined
	return { signature, computed }
}

/** PBKDF2 hash of a keyring password (salt "1.keyring.ets.knx.org"). */
export function hashKeyringPassword(password: string): Buffer {
	return crypto.pbkdf2Sync(
		Buffer.from(password, 'utf-8'),
		Buffer.from('1.keyring.ets.knx.org', 'utf-8'),
		65536,
		16,
		'sha256',
	)
}
