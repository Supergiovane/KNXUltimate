/**
 * Represents KNX connection request information blocks.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNX_CONSTANTS } from './KNXConstants'

export enum ConnectionTypes {
	TUNNEL_CONNECTION = KNX_CONSTANTS.TUNNEL_CONNECTION,
	DEVICE_MGMT_CONNECTION = KNX_CONSTANTS.DEVICE_MGMT_CONNECTION,
	REMLOG_CONNECTION = KNX_CONSTANTS.REMLOG_CONNECTION,
	REMCONF_CONNECTION = KNX_CONSTANTS.REMCONF_CONNECTION,
	OBJSVR_CONNECTION = KNX_CONSTANTS.OBJSVR_CONNECTION,
}

export default class CRI {
	private _connectionType: ConnectionTypes

	constructor(connectionType: ConnectionTypes) {
		this._connectionType = connectionType
	}

	get length(): number {
		return 2
	}

	set connectionType(connectionType: ConnectionTypes) {
		this._connectionType = connectionType
	}

	get connectionType(): ConnectionTypes {
		return this._connectionType
	}

	toBuffer(): Buffer {
		return Buffer.alloc(0)
	}
}
