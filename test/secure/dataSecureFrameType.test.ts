/**
 * Validates Standard/Extended cEMI frame selection for outgoing Data Secure
 * telegrams.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import KNXClient from '../../src/KNXClient'
import { dpts } from '../../src/dptlib'
import KNXAddress from '../../src/protocol/KNXAddress'
import KNXDataBuffer, {
	type IDataPoint,
} from '../../src/protocol/KNXDataBuffer'
import CEMIFactory from '../../src/protocol/cEMI/CEMIFactory'
import { FrameType } from '../../src/protocol/cEMI/ControlField'

const GROUP_KEY = Buffer.from('00112233445566778899aabbccddeeff', 'hex')
const SOURCE_ADDRESS = KNXAddress.createFromString(
	'1.1.1',
	KNXAddress.TYPE_INDIVIDUAL,
)
const GROUP_ADDRESS = KNXAddress.createFromString(
	'1/2/3',
	KNXAddress.TYPE_GROUP,
)

interface SecureClientTestHarness {
	_secureGroupKeys: Map<number, Buffer>
	_secureAssignedIa: number
	_secureSendSeq48: bigint
	getKNXDataBuffer: (value: unknown, dptId: string) => KNXDataBuffer
	maybeApplyDataSecure: (
		cemi: ReturnType<typeof CEMIFactory.newLDataRequestMessage>,
	) => void
	secureBuildLDataReq: (
		secureApdu: Buffer,
		srcIa: number,
		ga: number,
		flags: number,
	) => Buffer
}

const DPT_SAMPLES: Record<string, unknown> = {
	DPT1: true,
	DPT2: { priority: false, data: true },
	DPT3: { decr_incr: 1, data: 5 },
	DPT4: 'A',
	DPT5: 50,
	DPT6: -24,
	DPT7: 22,
	DPT8: 1200,
	DPT9: 25,
	DPT10: '14:30:45',
	DPT11: '2026-07-31',
	DPT12: 12,
	DPT13: 22,
	DPT14: 42,
	DPT15: 1,
	DPT16: 'Hello!',
	DPT17: 1,
	DPT18: { save_recall: 0, scenenumber: 1 },
	DPT19: '2026-07-31T12:30:00',
	DPT20: 1,
	DPT21: {
		outOfService: false,
		fault: false,
		overridden: false,
		inAlarm: true,
		alarmUnAck: false,
	},
	DPT22: {},
	DPT23: 1,
	DPT24: 'Hello KNX',
	DPT25: { busy: 1, nak: 2 },
	DPT26: { info: false, scenenumber: 0 },
	DPT27: { mask: 0xffff, state: 0x0005 },
	DPT28: 'Hello UTF-8!',
	DPT29: 42n,
	DPT213: {
		Comfort: 21.4,
		Standby: 20,
		Economy: 18.2,
		BuildingProtection: -1,
	},
	DPT222: { Comfort: 21.4, Standby: 20, Economy: 18.2 },
	DPT232: { red: 255, green: 200, blue: 30 },
	DPT235: {
		activeElectricalEnergy: 1540,
		tariff: 20,
		validityTariff: true,
		validityEnergy: true,
	},
	DPT237: {
		readResponse: false,
		addressIndicator: false,
		daliAddress: 8,
		lampFailure: false,
		ballastFailure: false,
		convertorError: false,
	},
	DPT238: 128,
	DPT242: {
		x: 500,
		y: 500,
		brightness: 80,
		isColorValid: true,
		isBrightnessValid: true,
	},
	DPT249: {
		transitionTime: 100,
		colourTemperature: 1000,
		absoluteBrightness: 80,
		isTimePeriodValid: true,
		isAbsoluteColourTemperatureValid: true,
		isAbsoluteBrightnessValid: true,
	},
	DPT251: {
		red: 90,
		green: 200,
		blue: 30,
		white: 120,
		mR: 1,
		mG: 1,
		mB: 1,
		mW: 1,
	},
	DPT275: {
		comfort: 22,
		standby: 21.5,
		economy: 21,
		buildingProtection: 15,
	},
	DPT999: '12340000000000000000',
	DPT60001: {
		command: 'operation code',
		data: ['localoperation', 'long up'],
		sectors: [42],
	},
	DPT60002: { position: 'top', mode: 'normal' },
}

function createSecureClient(): SecureClientTestHarness {
	const client = new KNXClient(
		{
			hostProtocol: 'TunnelTCP',
			isSecureKNXEnabled: true,
			physAddr: '1.1.1',
			localIPAddress: '127.0.0.1',
			loglevel: 'error',
		},
		() => {},
	) as unknown as SecureClientTestHarness
	client._secureGroupKeys = new Map([[GROUP_ADDRESS.get(), GROUP_KEY]])
	client._secureAssignedIa = SOURCE_ADDRESS.get()
	client._secureSendSeq48 = 1n
	return client
}

function applyDataSecure(client: SecureClientTestHarness, data: KNXDataBuffer) {
	const cemi = CEMIFactory.newLDataRequestMessage(
		'write',
		SOURCE_ADDRESS,
		GROUP_ADDRESS,
		data,
	)
	cemi.control.ack = 0
	client.maybeApplyDataSecure(cemi)
	return cemi
}

describe('Data Secure cEMI frame type', () => {
	it('uses Standard through length 15 and Extended starting at length 16', () => {
		const client = createSecureClient()
		const dataPoint: IDataPoint = {
			id: '',
			value: null,
			type: { type: false },
			bind: null,
			read: () => null,
			write: null,
		}

		for (const [payloadLength, expectedSecureLength, expectedFrameType] of [
			[1, 15, FrameType.type1],
			[2, 16, FrameType.type0],
		] as const) {
			const cemi = applyDataSecure(
				client,
				new KNXDataBuffer(Buffer.alloc(payloadLength), dataPoint),
			)
			assert.strictEqual(cemi.npdu.toBuffer()[0], expectedSecureLength)
			assert.strictEqual(cemi.control.frameType, expectedFrameType)
		}
	})

	it('selects the correct frame type for every registered DPT family', () => {
		assert.deepStrictEqual(
			Object.keys(DPT_SAMPLES).sort(),
			Object.keys(dpts).sort(),
			'every registered DPT family must have a Data Secure frame test sample',
		)

		const client = createSecureClient()
		for (const [dptId, value] of Object.entries(DPT_SAMPLES)) {
			const data = client.getKNXDataBuffer(
				value,
				dptId.slice('DPT'.length),
			)
			assert.ok(
				Buffer.isBuffer(data.value),
				`${dptId} must encode to a Buffer`,
			)

			const cemi = applyDataSecure(client, data)
			const secureLength = cemi.npdu.toBuffer()[0]
			const expectedFrameType =
				secureLength > 0x0f ? FrameType.type0 : FrameType.type1
			assert.strictEqual(
				cemi.control.frameType,
				expectedFrameType,
				`${dptId} secure length ${secureLength} has the wrong frame type`,
			)
		}
	})

	it('also clears the Standard-frame flag in the raw cEMI builder', () => {
		const client = createSecureClient()
		const standardFlags = 0xbce0

		const shortFrame = client.secureBuildLDataReq(
			Buffer.alloc(16),
			SOURCE_ADDRESS.get(),
			GROUP_ADDRESS.get(),
			standardFlags,
		)
		const longFrame = client.secureBuildLDataReq(
			Buffer.alloc(17),
			SOURCE_ADDRESS.get(),
			GROUP_ADDRESS.get(),
			standardFlags,
		)

		assert.strictEqual(shortFrame[2], 0xbc)
		assert.strictEqual(shortFrame[8], 15)
		assert.strictEqual(longFrame[2], 0x3c)
		assert.strictEqual(longFrame[8], 16)
	})
})
