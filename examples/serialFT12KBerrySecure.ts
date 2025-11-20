/**
 * Example: KBerry / Serial FT1.2 with KNX Data Secure.
 *
 * Uses a Weinzierl KBerry (BAOS) in Link Layer (cEMI) mode over FT1.2 and
 * applies KNX Data Secure on TP for group addresses that have keys in the ETS keyring.
 *
 * Prerequisites:
 *  - KBerry wired to the KNX TP bus
 *  - KBerry configured as BAOS/LinkLayer (managed automatically by KNXUltimate when isKBERRY=true)
 *  - ETS keyring (.knxkeys) with Data Secure group addresses (for example 1/1/1, 1/1/2)
 */

import KNXClient, {
	KNXClientEvents,
	SecureConfig,
} from '../src/KNXClient'
import CEMIConstants from '../src/protocol/cEMI/CEMIConstants'

async function waitForStatus(
	client: KNXClient,
	ga: string,
	timeoutMs = 5000,
): Promise<number> {
	// Resolve once a status telegram reaches the provided GA
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => {
			client.off(KNXClientEvents.indication, onInd)
			reject(new Error('Timeout waiting for status'))
		}, timeoutMs)

		// packet.cEMIMessage is already plain (decrypted) if Data Secure is active
		const onInd = (packet: any) => {
			try {
				const cemi = packet?.cEMIMessage
				if (!cemi || cemi.msgCode !== CEMIConstants.L_DATA_IND) return
				if (cemi.dstAddress?.toString?.() !== ga) return
				const isResp = cemi.npdu?.isGroupResponse
				const isWrite = cemi.npdu?.isGroupWrite
				if (isResp || isWrite) {
					const dv: Buffer =
						cemi.npdu?.dataValue ?? Buffer.alloc(1, 0)
					const bit = (dv.readUInt8(0) ?? 0) & 0x01
					clearTimeout(t)
					client.off(KNXClientEvents.indication, onInd)
					resolve(bit)
				}
			} catch {}
		}
		client.on(KNXClientEvents.indication, onInd)
	})
}

async function main() {
	// KNX Data Secure configuration for Serial FT1.2 (KBerry)
	const secureCfg: SecureConfig = {
		knxkeys_file_path:
			'/Users/massimosaccani/Documents/GitHub/KNXUltimate/documents/Secure Test.knxkeys',
		knxkeys_password: 'passwordprogetto',
	}

	const serialPath = '/dev/cu.usbserial-0001'

	const client = new KNXClient({
		hostProtocol: 'SerialFT12',
		serialInterface: {
			path: serialPath,
			baudRate: 19200,
			dataBits: 8,
			stopBits: 1,
			parity: 'even',
			isKBERRY: true,
			lock: false,
		},
		physAddr: '15.15.255',
		loglevel: 'info',
		isSecureKNXEnabled: true,
		secureTunnelConfig: secureCfg,
	})

	client.on(KNXClientEvents.connecting, () => {
		// eslint-disable-next-line no-console
		console.log(`Connecting KBerry (secure) on ${serialPath}…`)
	})

	client.on(KNXClientEvents.connected, () => {
		// eslint-disable-next-line no-console
		console.log(`✓ Serial FT1.2 (KBerry, Data Secure) ready on ${serialPath}`)
	})

	client.on(KNXClientEvents.error, (err) => {
		// eslint-disable-next-line no-console
		console.error('Serial FT1.2 error:', err.message)
	})

	client.on(KNXClientEvents.indication, (packet) => {
		const cemi = packet?.cEMIMessage
		if (!cemi || cemi.msgCode !== CEMIConstants.L_DATA_IND) return
		const src = cemi.srcAddress?.toString?.() ?? 'unknown'
		const dst = cemi.dstAddress?.toString?.() ?? 'unknown'
		const isResp = cemi.npdu?.isGroupResponse
		const isWrite = cemi.npdu?.isGroupWrite
		const raw: Buffer | undefined = cemi.npdu?.dataValue
		// eslint-disable-next-line no-console
		console.log(
			`IND ${src} -> ${dst} type=${
				isResp ? 'RESP' : isWrite ? 'WRITE' : 'OTHER'
			} data=${raw?.toString('hex') ?? ''}`,
		)
	})

	try {
		client.Connect()
		// Wait until the serial driver is ready
		await new Promise<void>((resolve) =>
			client.once(KNXClientEvents.connected, () => resolve()),
		)

		const cmdGA = '1/1/1'
		const statusGA = '1/1/2'

		// eslint-disable-next-line no-console
		console.log(
			`\nTEST (KBerry + Data Secure): ON/OFF ${cmdGA} with status ${statusGA}`,
		)

		// ON
		client.write(cmdGA, true, '1.001')
		await new Promise((r) => setTimeout(r, 200))
		client.read(statusGA)
		const onVal = await waitForStatus(client, statusGA, 5000)
		// eslint-disable-next-line no-console
		console.log(`Status after ON: ${onVal ? 'ON' : 'OFF'}`)

		// OFF
		client.write(cmdGA, false, '1.001')
		await new Promise((r) => setTimeout(r, 200))
		client.read(statusGA)
		const offVal = await waitForStatus(client, statusGA, 5000)
		// eslint-disable-next-line no-console
		console.log(`Status after OFF: ${offVal ? 'ON' : 'OFF'}`)

		// eslint-disable-next-line no-console
		console.log('\nCommands sent and status verified on serial Data Secure.')
		await new Promise((r) => setTimeout(r, 2000))
	} finally {
		await client.Disconnect()
	}
}

main().catch((err) => {
	// eslint-disable-next-line no-console
	console.error(err)
	process.exit(1)
})

