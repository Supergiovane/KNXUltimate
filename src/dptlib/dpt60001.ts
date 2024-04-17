/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

import Log from '../KnxLog'
import type { DatapointConfig } from '.'

function toRadix(value: number, radix: number) {
	if (!Number.isSafeInteger(value)) {
		Log.get().error('value must be a safe integer')
	}

	const digits = Math.ceil(64 / Math.log2(radix))
	const twosComplement =
		value < 0 ? BigInt(radix) ** BigInt(digits) + BigInt(value) : value

	return twosComplement.toString(radix).padStart(digits, '0')
}

function griesserSectorCode(Byte0: number, Byte1: number) {
	const SectorCode = Byte0 + (Byte1 & 3) * 256
	return SectorCode
}

function griesserCommandCode(Byte1: number) {
	const command = (Byte1 / 4) >> 0
	return command
}

function griesserParameter(
	command: number,
	Byte2: number,
	Byte3: number,
	Byte4: number,
	Byte5: number,
) {
	let commandOperation: string
	switch (command) {
		case 1: // drive command
			switch (Byte2 & 31) {
				case 0:
					return 'no driving movement'
				case 1:
					return 'upper end position'
				case 2:
					return 'lower end position'
				case 3:
					if (Byte3 >= 1 && Byte3 <= 4) {
						return `fixed position P${Byte3} approach`
					}
					return `Unknown value for Pn ${Byte3}`

				default:
					return `Unknown drive command${Byte2}`
			}
		case 4: // set/delete lock
			if (Byte2 === 0) {
				return 'no lock'
			}
			switch (Byte2 & 3) {
				case 1:
					return 'driving command'
				case 2:
					return 'button lock'
				case 3:
					return 'driving command- and button lock'
			}
			if (Byte3 === 0) {
				return 'delete lock'
			}
			return 'set lock'

		case 5: // operation code
			if (Byte2 <= 6) {
				commandOperation = 'groupoperation'
			} else if (Byte2 >= 128 && Byte2 <= 134) {
				commandOperation = 'localoperation'
			} else {
				commandOperation = `unknown command Byte3 for ${Byte2}`
			}
			if ((Byte2 & 127) === 0) {
				return [commandOperation, 'long up']
			}
			if ((Byte2 & 127) === 1) {
				return [commandOperation, 'long down']
			}
			if ((Byte2 & 127) === 2) {
				return [commandOperation, 'short up']
			}
			if ((Byte2 & 127) === 3) {
				return [commandOperation, 'short down']
			}
			if ((Byte2 & 127) === 4) {
				return [commandOperation, 'stop']
			}
			if ((Byte2 & 127) === 5) {
				return [commandOperation, 'long-short up']
			}
			if ((Byte2 & 127) === 6) {
				return [commandOperation, 'long-short down']
			}
			return [commandOperation, `unknown command Byte3 for ${Byte2}`]

		case 22: // driving range limits for automatic button commands
			return [
				`min. angle: ${Byte2}`,
				`max. angle: ${Byte3}`,
				`min. height: ${Byte4}`,
				`max. height: ${Byte5}`,
			]
		default:
			return `unknown value for command: ${command}`
	}
}

function griesserSectors(SectorCode: number) {
	let SectorMin: number
	let SectorMax: number
	let dA: number
	let a: number
	let SectorCodeMin: number
	let SectorCodeMax: number
	dA = 1
	a = SectorCode
	if (a > 0) {
		while ((a & 1) === 0) {
			a = (a / 2) >> 0
			dA *= 2
		}
		dA -= 1
		SectorMin = SectorCode - dA
		SectorMax = SectorCode + dA
	} else {
		SectorMin = 0
		SectorMax = 0
	}
	if (SectorMin === 0) {
		SectorCodeMin = 0
	} else {
		SectorCodeMin = (((SectorMin - 1) / 2) >> 0) + 1
	}
	if (SectorMax === 0) {
		SectorCodeMax = 0
	} else {
		SectorCodeMax = (((SectorMax - 1) / 2) >> 0) + 1
	}
	if (SectorCodeMax === SectorCodeMin) {
		return [SectorCodeMin]
	}
	const Sectors = []
	for (let i = SectorCodeMin; i <= SectorCodeMax; i++) {
		Sectors.push(i)
	}
	return Sectors
}

function griesserSectorToSectorCode(sectors: number[]) {
	if (sectors.length === 1) {
		return sectors[0] + sectors[0] - 1
	}
	return Math.min(...sectors) + Math.max(...sectors) - 1
}

function griesserCommandToCommandCode(command: string) {
	switch (command) {
		case 'operation code':
			return 5
		default:
			Log.get().error(`not implemented yet: ${command}`)
	}
}

function griesserCommandToCommandCodeP1(command: string) {
	switch (command) {
		case 'long up':
			return 128
		case 'long down':
			return 129
		case 'short up':
			return 130
		case 'short down':
			return 131
		case 'stop':
			return 132
		case 'long-short up':
			return 133
		case 'long-short down':
			return 134
		default:
			Log.get().error(`unknown command: ${command}`)
	}
}

function griesserCommand(command: number) {
	switch (command) {
		case 1:
			return 'drive command'
		case 2:
			return 'value correction'
		case 3:
			return 'automatic state'
		case 4:
			return 'set/delete lock'
		case 5:
			return 'operation code'
		case 6:
			return 'set scene'
		case 7:
			return 'special command'
		case 8:
			return 'date'
		case 9:
			return 'sync time'
		case 10:
			return 'sensor reading notification'
		case 11:
			return 'bus monitoring'
		case 16:
			return 'driving range limits for safety drive commands'
		case 17:
			return 'driving range limits for safety drive commands'
		case 19:
			return 'driving range limits for safety drive commands'
		case 20:
			return 'driving range limits for safety drive commands'
		case 22:
			return 'driving range limits for automatic drive commands'
		case 23:
			return 'driving range limits for automatic drive commands'
		case 24:
			return 'driving range limits for automatic drive commands'
		default:
			return `unknown value for function: ${command}`
	}
}

function griesserPrio(prio: number, command: number) {
	const prioCommand = ((command & 224) / 32) >> 0
	if (((prio & 252) / 4) >> 0 === 0) {
		switch (prioCommand) {
			case 0:
				return 'border command'
			case 1:
				return 'automatic command'
			case 3:
				return 'priority command'
			case 4:
				return 'warning command'
			case 5:
				return 'security command'
			case 6:
				return 'danger command'
			default:
				return `unknown priority${prioCommand}`
		}
	} else {
		return '-'
	}
}

// Send to BUS
const config: DatapointConfig = {
	id: 'DPT60001',
	formatAPDU(value) {
		if (!value) {
			Log.get().error('DPT60001: cannot write null value')
		} else {
			if (
				typeof value === 'object' &&
				Object.prototype.hasOwnProperty.call(value, 'command') &&
				Object.prototype.hasOwnProperty.call(value, 'data') &&
				Object.prototype.hasOwnProperty.call(value, 'sectors') &&
				value.data[0] === 'localoperation'
			) {
				const sectorCode = griesserSectorToSectorCode(value.sectors)
				const commandCode = griesserCommandToCommandCode(value.command)
				const p1 = griesserCommandToCommandCodeP1(value.data[1])
				const bufferTotal = Buffer.alloc(6)
				bufferTotal[0] = parseInt(toRadix(sectorCode, 2).slice(-8), 2)
				bufferTotal[1] = parseInt(
					toRadix(commandCode, 2).slice(-6) +
						toRadix(sectorCode, 2).slice(-10, -8),
					2,
				)
				bufferTotal[2] = parseInt(toRadix(p1, 2).slice(-8), 2)
				return bufferTotal
			}
			Log.get().error(
				'DPT60001: Must supply an value {command:"operation code", data:["localoperation", "long up"], sectors:[159]}',
			)
		}
	},

	// RX from BUS
	fromBuffer(buf) {
		if (buf.length !== 6) {
			Log.get().warn(
				'DPTGriesser.fromBuffer: buf should be 6 bytes long (got %d bytes)',
				buf.length,
			)
			return null
		}
		const hexToDecimal = (hex) => parseInt(hex, 16)
		const bufTotale = buf.toString('hex')
		const Byte0 = hexToDecimal(bufTotale.slice(0, 2))
		const Byte1 = hexToDecimal(bufTotale.slice(2, 4))
		const Byte2 = hexToDecimal(bufTotale.slice(4, 6))
		const Byte3 = hexToDecimal(bufTotale.slice(6, 8))
		const Byte4 = hexToDecimal(bufTotale.slice(8, 10))
		const Byte5 = hexToDecimal(bufTotale.slice(10, 12))
		const sectorCode = griesserSectorCode(Byte0, Byte1)
		const commandCode = griesserCommandCode(Byte1)

		return {
			Byte0,
			Byte1,
			Byte2,
			Byte3,
			Byte4,
			Byte5,
			sectorCode,
			commandCode,
			sectors: griesserSectors(sectorCode),
			prio: griesserPrio(Byte1, Byte2),
			command: griesserCommand(commandCode),
			data: griesserParameter(commandCode, Byte2, Byte3, Byte4, Byte5),
		}
	},

	// DPT Griesser Object basetype info
	basetype: {
		bitlength: 4 * 8 + 2 * 6 + 1 * 10,
		valuetype: 'composite',
		desc: 'Commands for solar shading actors',
	},
	subtypes: {
		'001': {
			desc: 'DPT_Griesser_Object',
			name: 'Griesser Object',
		},
	},
}

export default config
