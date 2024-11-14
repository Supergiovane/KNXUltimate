import { KNX_CONSTANTS } from './KNXConstants'
import CRI from './CRI'

const TUNNEL_CRI_LENGTH: number = 4

/**
 * Connection types for KNX tunneling
 */
export enum TunnelTypes {
	TUNNEL_LINKLAYER = KNX_CONSTANTS.TUNNEL_LINKLAYER,
	TUNNEL_RAW = KNX_CONSTANTS.TUNNEL_RAW,
	TUNNEL_BUSMONITOR = KNX_CONSTANTS.TUNNEL_BUSMONITOR,
}

/**
 * Connection flags for KNX tunneling according to ISO 22510:2019
 */
export enum TunnelFlags {
	NONE = 0x00, // No flags set
	SECURE = 0x01, // Bit 0: Secure tunnel connection
	// Bits 1-7 are reserved and must be 0
}

/**
 * Interface for tunnel connection parameters
 */
export interface TunnelConnectionInfo {
	layer: TunnelTypes
	flags: TunnelFlags
}

/**
 * Connection Request Information (CRI) for KNX tunneling
 * Implements secure tunneling support
 */
export default class TunnelCRI extends CRI {
	private readonly knxLayer: TunnelTypes

	private readonly flags: TunnelFlags

	/**
	 * Create a new TunnelCRI
	 * @param knxLayer - The KNX tunnel layer type
	 * @param flags - Connection flags, defaults to none
	 * @throws Error if invalid layer or flags are provided
	 */
	constructor(knxLayer: TunnelTypes, flags: TunnelFlags = TunnelFlags.NONE) {
		super(KNX_CONSTANTS.TUNNEL_CONNECTION)

		// Validate tunnel layer
		if (!Object.values(TunnelTypes).includes(knxLayer)) {
			throw new Error('Invalid tunnel layer')
		}

		// Validate flags (only bits 0-3 can be used, 4-7 must be 0)
		if ((flags & 0xf0) !== 0) {
			throw new Error('Invalid tunnel flags: bits 4-7 must be 0')
		}

		this.knxLayer = knxLayer
		this.flags = flags
	}

	/**
	 * Get CRI block length
	 */
	get length(): number {
		return TUNNEL_CRI_LENGTH
	}

	/**
	 * Check if secure tunnel connection is requested
	 */
	get isSecure(): boolean {
		return (this.flags & TunnelFlags.SECURE) !== 0
	}

	/**
	 * Get tunnel layer type
	 */
	get layer(): TunnelTypes {
		return this.knxLayer
	}

	/**
	 * Get connection flags
	 */
	get connectionFlags(): TunnelFlags {
		return this.flags
	}

	/**
	 * Create TunnelCRI from buffer
	 * @param buffer - Buffer containing CRI data
	 * @param offset - Optional offset in buffer
	 */
	static createFromBuffer(buffer: Buffer, offset: number = 0): TunnelCRI {
		// Validate minimum buffer length
		if (buffer.length - offset < TUNNEL_CRI_LENGTH) {
			throw new Error('Buffer too small for TunnelCRI')
		}

		const knxLayer = buffer.readUInt8(offset++) as TunnelTypes
		const flags = buffer.readUInt8(offset) as TunnelFlags

		return new TunnelCRI(knxLayer, flags)
	}

	toBuffer(): Buffer {
		const buffer: Buffer = Buffer.alloc(this.length)
		let offset: number = 0

		buffer.writeUInt8(this.length, offset++)
		buffer.writeUInt8(KNX_CONSTANTS.TUNNEL_CONNECTION, offset++)
		buffer.writeUInt8(this.knxLayer, offset++)
		buffer.writeUInt8(this.flags, offset)

		return buffer
	}

	/**
	 * Create secure tunnel connection
	 * @param layer - KNX tunnel layer type
	 */
	static createSecure(layer: TunnelTypes): TunnelCRI {
		return new TunnelCRI(layer, TunnelFlags.SECURE)
	}

	/**
	 * Create non-secure tunnel connection
	 * @param layer - KNX tunnel layer type
	 */
	static createNonSecure(layer: TunnelTypes): TunnelCRI {
		return new TunnelCRI(layer, TunnelFlags.NONE)
	}
}
