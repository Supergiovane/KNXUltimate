import { module } from '../KnxLog'
import type { DatapointConfig } from '.'

const logger = module('DPT60002')

interface ShutterValue {
	mode: string
	position: string
}
function bitsToShutterPosition(bits: number): string {
	switch (bits) {
		case 0b00:
			return 'intermediate'
		case 0b01:
			return 'top'
		case 0b10:
			return 'bottom'
		default:
			logger.error(`unknown position value: ${bits}`)
			return null
	}
}

function shutterPositionToBits(position: string): number {
	switch (position) {
		case 'intermediate':
			return 0b00
		case 'top':
			return 0b01
		case 'bottom':
			return 0b10
		default:
			logger.error(`Unknown position: ${position}`)
			return null
	}
}

function bitsToOperationMode(bits: number): string {
	switch (bits) {
		case 0b000:
			return 'normal'
		case 0b001:
			return 'priority'
		case 0b010:
			return 'wind alarm'
		case 0b011:
			return 'rain alarm'
		case 0b100:
			return 'disabled'
		default:
			logger.error(`unknown operation mode value: ${bits}`)
			return null
	}
}

function operationModeToBits(mode: string): number {
	switch (mode) {
		case 'normal':
			return 0b000
		case 'priority':
			return 0b001
		case 'wind alarm':
			return 0b010
		case 'rain alarm':
			return 0b011
		case 'disabled':
			return 0b100
		default:
			logger.error(`Unknown operation mode: ${mode}`)
			return null
	}
}
const config: DatapointConfig = {
	id: 'DPT60002',
	formatAPDU(value: ShutterValue): Buffer {
		if (!value) {
			logger.error('cannot write null value')
			return null
		}

		let apduData
		if (
			typeof value === 'object' &&
			Object.prototype.hasOwnProperty.call(value, 'mode') &&
			Object.prototype.hasOwnProperty.call(value, 'position')
		) {
			const mode = operationModeToBits(value.mode)
			const position = shutterPositionToBits(value.position)
			apduData = (mode << 2) + position
		} else {
			logger.error(
				'Must supply a value {mode: "normal"|"priority"|"wind|alarm"|"rain|alarm"|"disabled", position: "intermediate"|"top"|"bottom"}',
			)
		}
		return Buffer.from([apduData])
	},

	fromBuffer(buf: Buffer): ShutterValue {
		if (buf.length !== 1) {
			logger.error(`Buffer should be 1 byte long, got ${buf.length}`)
			return null
		}

		return {
			mode: bitsToOperationMode((buf[0] >> 2) & 0b111),
			position: bitsToShutterPosition(buf[0] & 0b11),
		}
	},
	basetype: {
		bitlength: 2,
		valuetype: 'composite',
		desc: 'Status object for Hager TXA223/225',
		help: `// This would usually only be received.
msg.payload = {position: "top", mode: "normal"};
return msg;`,
	},
	subtypes: {
		'001': {
			name: 'Shutter state (Hager TXA223/225)',
			desc: 'Status object for Hager TXA223/225',
		},
	},
}
export default config
