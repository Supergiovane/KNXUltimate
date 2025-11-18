/**
 * Mocks a KNX Secure gateway for tests.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { createServer, Server, Socket, AddressInfo } from 'net'
import * as crypto from 'crypto'
import { TypedEventEmitter } from '../../src/TypedEmitter'
import {
	KNXIP,
	SECURE_WRAPPER_OVERHEAD,
	KNXIP_HDR_SECURE_WRAPPER,
	SECURE_WRAPPER_TAG,
	SECURE_WRAPPER_CTR_SUFFIX,
	SECURE_WRAPPER_MAC_SUFFIX,
	SECURE_SEQ_LEN,
	SERIAL_LEN,
	PUBLIC_KEY_LEN,
	MAC_LEN_FULL,
	SCF_ENCRYPTION_S_A_DATA,
	APCI_SEC,
	TPCI_DATA,
	DATA_SECURE_CTR_SUFFIX,
	CEMI as SEC_CEMI,
} from '../../src/secure/secure_knx_constants'
import {
	calculateMessageAuthenticationCodeCBC,
	encryptDataCtr,
	decryptCtr,
} from '../../src/secure/security_primitives'
import KNXProtocol from '../../src/protocol/KNXProtocol'
import KNXTunnelingRequest from '../../src/protocol/KNXTunnelingRequest'
import KNXTunnelingAck from '../../src/protocol/KNXTunnelingAck'
import KNXConnectResponse from '../../src/protocol/KNXConnectResponse'
import KNXConnectionStateResponse from '../../src/protocol/KNXConnectionStateResponse'
import KNXDisconnectResponse from '../../src/protocol/KNXDisconnectResponse'
import HPAI, { KnxProtocol as HPAIProtocol } from '../../src/protocol/HPAI'
import CRD, { ConnectionType } from '../../src/protocol/CRD'
import KNXAddress, { KNXAddressType } from '../../src/protocol/KNXAddress'
import ControlField from '../../src/protocol/cEMI/ControlField'
import NPDU from '../../src/protocol/cEMI/NPDU'
import KNXDataBuffer from '../../src/protocol/KNXDataBuffer'
import LDataReq from '../../src/protocol/cEMI/LDataReq'
import LDataInd from '../../src/protocol/cEMI/LDataInd'
import CEMIConstants from '../../src/protocol/cEMI/CEMIConstants'
import { GroupAddress, IndividualAddress } from '../../src/secure/keyring'

type GatewayEvents = {
	error: (error: Error) => void
	connected: () => void
	groupWrite: (payload: {
		groupAddress: string
		sourceAddress: string
		value: boolean
		plainApdu: Buffer
	}) => void
}

type SecureGatewayOptions = {
	host?: string
	port?: number
	sessionId?: number
	channelId?: number
	serial?: Buffer
	interfaceIndividualAddress?: string
	tunnelAssignedIndividualAddress?: string
	groupKeys?: Record<string, Buffer>
	initialSendSeq48?: bigint
}

const X25519_SPKI_PREFIX_DER = Buffer.from('302a300506032b656e032100', 'hex')

export class MockSecureGateway extends TypedEventEmitter<GatewayEvents> {
	private server: Server | null = null

	private socket: Socket | null = null

	private rxBuffer: Buffer = Buffer.alloc(0)

	private wrapperSeq = 0

	private tunnelSeq = 0

	private sessionKey: Buffer | null = null

	private readonly sessionId: number

	private readonly channelId: number

	private readonly serial: Buffer

	private readonly interfaceIa: number

	private readonly assignedIa: number

	private readonly groupKeys: Map<number, Buffer>

	private readonly sendSeq48Start: bigint

	private sendSeq48: bigint

	private host: string

	private port: number

	private handshakeState: 'idle' | 'session' | 'auth' | 'connected' = 'idle'

	private clientPublicKey: Buffer | null = null

	private readonly serverPrivateKey: crypto.KeyObject

	private readonly serverPublicKeyRaw: Buffer

	constructor(options: SecureGatewayOptions = {}) {
		super()
		this.host = options.host ?? '127.0.0.1'
		this.port = options.port ?? 0
		this.sessionId = options.sessionId ?? 0x5100
		this.channelId = options.channelId ?? 0x51
		this.serial =
			options.serial && options.serial.length === SERIAL_LEN
				? Buffer.from(options.serial)
				: Buffer.from('a1b2c3d4e5f6', 'hex')
		const interfaceIaStr = options.interfaceIndividualAddress ?? '1.1.1'
		const tunnelIaStr =
			options.tunnelAssignedIndividualAddress ?? '10.15.251'
		this.interfaceIa = new IndividualAddress(interfaceIaStr).raw
		this.assignedIa = new IndividualAddress(tunnelIaStr).raw
		this.groupKeys = new Map()
		if (options.groupKeys) {
			for (const [ga, key] of Object.entries(options.groupKeys)) {
				const addr = new GroupAddress(ga).raw
				this.groupKeys.set(addr, Buffer.from(key))
			}
		}
		this.sendSeq48Start = options.initialSendSeq48 ?? BigInt(Date.now())
		this.sendSeq48 = this.sendSeq48Start
		const keyPair = crypto.generateKeyPairSync('x25519')
		this.serverPrivateKey = keyPair.privateKey
		const exported = keyPair.publicKey.export({
			type: 'spki',
			format: 'der',
		}) as Buffer
		this.serverPublicKeyRaw = exported.subarray(
			exported.length - PUBLIC_KEY_LEN,
		)
	}

	async start(): Promise<void> {
		if (this.server) return
		await new Promise<void>((resolve, reject) => {
			this.server = createServer((socket) =>
				this.handleConnection(socket),
			)
			this.server.once('error', reject)
			this.server.listen(this.port, this.host, () => {
				const addr = this.server?.address()
				if (addr && typeof addr === 'object') {
					this.host = addr.address || this.host
					this.port = addr.port
				}
				this.server?.off('error', reject)
				resolve()
			})
		})
	}

	async stop(): Promise<void> {
		if (this.socket) {
			this.socket.removeAllListeners()
			this.socket.destroy()
			this.socket = null
		}
		if (!this.server) return
		await new Promise<void>((resolve) => {
			this.server?.close(() => resolve())
		})
		this.server = null
	}

	get address(): AddressInfo | null {
		const addr = this.server?.address()
		return typeof addr === 'object' ? (addr as AddressInfo) : null
	}

	async sendGroupValueWriteSecure(
		groupAddress: string,
		value: boolean,
	): Promise<void> {
		if (
			!this.socket ||
			!this.sessionKey ||
			this.handshakeState !== 'connected'
		) {
			throw new Error('Secure session not established')
		}
		const dst = new GroupAddress(groupAddress).raw
		const key = this.groupKeys.get(dst)
		if (!key) {
			throw new Error(`No Data Secure key for ${groupAddress}`)
		}
		const control = new ControlField()
		control.addressType = KNXAddressType.TYPE_GROUP
		control.ack = 0
		control.repeat = 1
		const srcAddress = new KNXAddress(
			this.interfaceIa,
			KNXAddressType.TYPE_INDIVIDUAL,
		)
		const dstAddress = new KNXAddress(dst, KNXAddressType.TYPE_GROUP)
		const apci = 0x80 | (value ? 0x01 : 0x00)
		const npdu = new NPDU(0x00, apci, null)
		this.applyDataSecure(npdu, control, this.interfaceIa, dst, key)
		const cemi = new LDataInd(null, control, srcAddress, dstAddress, npdu)
		const request = KNXProtocol.newKNXTunnelingRequest(
			this.channelId,
			this.nextTunnelSeq(),
			cemi,
		)
		this.socket.write(this.wrapFrame(request.toBuffer()))
	}

	private handleConnection(socket: Socket) {
		if (this.socket) {
			socket.destroy()
			return
		}
		this.socket = socket
		this.handshakeState = 'session'
		this.rxBuffer = Buffer.alloc(0)
		this.wrapperSeq = 0
		this.tunnelSeq = 0
		this.sessionKey = null
		this.clientPublicKey = null
		this.sendSeq48 = this.sendSeq48Start
		socket.on('data', (data) => this.onData(data))
		socket.on('error', (err) => this.emit('error', err))
		socket.on('close', () => {
			this.socket = null
			this.handshakeState = 'idle'
		})
	}

	private onData(data: Buffer) {
		this.rxBuffer = Buffer.concat([this.rxBuffer, data])
		while (this.rxBuffer.length >= 6) {
			const length = this.rxBuffer.readUInt16BE(4)
			if (this.rxBuffer.length < length) break
			const frame = this.rxBuffer.subarray(0, length)
			this.rxBuffer = this.rxBuffer.subarray(length)
			this.handleFrame(frame)
		}
	}

	private handleFrame(frame: Buffer) {
		const service = frame.readUInt16BE(2)
		if (service === KNXIP.SECURE_SESSION_REQUEST) {
			this.handleSessionRequest(frame)
			return
		}
		if (service === KNXIP.SECURE_WRAPPER) {
			this.handleSecureWrapper(frame)
		}
		// ignore unexpected frames
	}

	private handleSessionRequest(frame: Buffer) {
		if (this.handshakeState !== 'session') return
		if (frame.length < 6 + 8 + PUBLIC_KEY_LEN) {
			this.emit('error', new Error('SESSION_REQUEST too short'))
			return
		}
		const hpaiLen = frame.readUInt8(6) || 0
		const keyOffset = 6 + hpaiLen
		const clientKey = frame.subarray(keyOffset, keyOffset + PUBLIC_KEY_LEN)
		if (clientKey.length !== PUBLIC_KEY_LEN) {
			this.emit(
				'error',
				new Error(
					`Invalid client public key length ${clientKey.length}`,
				),
			)
			return
		}
		this.clientPublicKey = Buffer.from(clientKey)
		const clientPublicKeyObj = crypto.createPublicKey({
			key: Buffer.concat([X25519_SPKI_PREFIX_DER, clientKey]),
			format: 'der',
			type: 'spki',
		})
		const secret = crypto.diffieHellman({
			privateKey: this.serverPrivateKey,
			publicKey: clientPublicKeyObj,
		})
		const sessionHash = crypto.createHash('sha256').update(secret).digest()
		this.sessionKey = sessionHash.subarray(0, 16)
		const responseLen = KNXIP_HEADER_AND_BODY_LEN(2 + PUBLIC_KEY_LEN)
		const response = Buffer.concat([
			Buffer.from('06100952', 'hex'),
			Buffer.from([responseLen >> 8, responseLen & 0xff]),
			Buffer.from([this.sessionId >> 8, this.sessionId & 0xff]),
			this.serverPublicKeyRaw,
		])
		this.socket?.write(response)
	}

	private handleSecureWrapper(frame: Buffer) {
		if (!this.sessionKey) return
		const inner = this.unwrapFrame(frame)
		const type = inner.readUInt16BE(2)
		if (
			type === KNXIP.SECURE_SESSION_AUTHENTICATE &&
			this.handshakeState === 'session'
		) {
			this.handshakeState = 'auth'
			const status = Buffer.concat([
				Buffer.from('06100954', 'hex'),
				Buffer.from([0x00, 0x07]),
				Buffer.from([0x00]),
			])
			this.socket?.write(this.wrapFrame(status))
			return
		}
		if (
			type === KNXIP.TUNNELING_CONNECT_REQUEST &&
			this.handshakeState === 'auth'
		) {
			this.handshakeState = 'connected'
			const connect = this.buildConnectResponse()
			this.socket?.write(this.wrapFrame(connect))
			this.emit('connected')
			return
		}
		if (
			type === KNXIP.TUNNELING_REQUEST &&
			this.handshakeState === 'connected'
		) {
			this.handleTunnelingRequest(inner)
			return
		}
		if (
			type === KNXIP.TUNNELING_ACK &&
			this.handshakeState === 'connected'
		) {
			return
		}
		if (
			type === KNXIP.CONNECTIONSTATE_REQUEST &&
			this.handshakeState === 'connected'
		) {
			const stateResponse = this.buildConnectionStateResponse(inner)
			this.socket?.write(this.wrapFrame(stateResponse))
			return
		}
		if (type === KNXIP.DISCONNECT_REQUEST) {
			const disconnect = this.buildDisconnectResponse(inner)
			this.socket?.write(this.wrapFrame(disconnect))
		}
	}

	private handleTunnelingRequest(inner: Buffer) {
		const { knxMessage } = KNXProtocol.parseMessage(inner)
		const request = knxMessage as KNXTunnelingRequest
		const ack = KNXProtocol.newKNXTunnelingACK(
			this.channelId,
			request.seqCounter,
			0,
		)
		this.socket?.write(this.wrapFrame(ack.toBuffer()))
		const cemi = request.cEMIMessage
		if (cemi.msgCode !== CEMIConstants.L_DATA_REQ) {
			return
		}
		const npdu = cemi.npdu
		const isSecure =
			npdu.tpci === APCI_SEC.HIGH && npdu.apci === APCI_SEC.LOW
		if (!isSecure) return
		const result = this.decryptDataSecure(cemi)
		if (!result) return
		this.emit('groupWrite', {
			groupAddress: result.groupAddress,
			sourceAddress: result.sourceAddress,
			value: result.value,
			plainApdu: result.plainApdu,
		})
	}

	private decryptDataSecure(cemi: LDataReq | LDataInd) {
		const npdu = cemi.npdu
		const dataBuf = npdu.dataBuffer?.value ?? Buffer.alloc(0)
		if (dataBuf.length < 1 + SECURE_SEQ_LEN + 4) {
			return null
		}
		const dst = cemi.dstAddress.get()
		const key = this.groupKeys.get(dst)
		if (!key) {
			return null
		}
		const src = cemi.srcAddress.get()
		const ctrlBuf = cemi.control.toBuffer()
		const flags2 = ctrlBuf[1] & SEC_CEMI.CTRL2_RELEVANT_MASK
		const scf = dataBuf[0]
		const seq = dataBuf.subarray(1, 1 + SECURE_SEQ_LEN)
		const encrypted = dataBuf.subarray(1 + SECURE_SEQ_LEN)
		const encMac = encrypted.subarray(encrypted.length - 4)
		const encPayload = encrypted.subarray(0, encrypted.length - 4)
		const addrFields = Buffer.from([
			(src >> 8) & 0xff,
			src & 0xff,
			(dst >> 8) & 0xff,
			dst & 0xff,
		])
		const counter0 = Buffer.concat([
			seq,
			addrFields,
			DATA_SECURE_CTR_SUFFIX,
		])
		const [plainPayload, macTr] = decryptCtr(
			key,
			counter0,
			encMac,
			encPayload,
		)
		const block0 = Buffer.concat([
			seq,
			addrFields,
			Buffer.from([
				0x00,
				flags2,
				(TPCI_DATA << 2) + APCI_SEC.HIGH,
				APCI_SEC.LOW,
				0x00,
				plainPayload.length,
			]),
		])
		const macCbc = calculateMessageAuthenticationCodeCBC(
			key,
			Buffer.from([scf]),
			plainPayload,
			block0,
		).subarray(0, 4)
		if (!macCbc.equals(macTr)) {
			return null
		}
		if (plainPayload.length < 2) {
			return null
		}
		const tpci = plainPayload[0]
		const apci = plainPayload[1]
		const action = ((tpci & 0x03) << 2) | ((apci & 0xc0) >> 6)
		const valueBit = apci & 0x3f
		const groupAddress = cemi.dstAddress.toString()
		const sourceAddress = cemi.srcAddress.toString()
		return {
			groupAddress,
			sourceAddress,
			value:
				action === NPDU.GROUP_WRITE ? (valueBit & 0x01) === 1 : false,
			plainApdu: plainPayload,
		}
	}

	private applyDataSecure(
		npdu: NPDU,
		control: ControlField,
		srcIa: number,
		dstGa: number,
		key: Buffer,
	) {
		const ctrlBuf = control.toBuffer()
		const flags16 = (ctrlBuf[0] << 8) | ctrlBuf[1]
		const plainApdu = Buffer.concat([
			Buffer.from([npdu.tpci & 0xff, npdu.apci & 0xff]),
			npdu.dataBuffer?.value ?? Buffer.alloc(0),
		])
		const seqBuf = Buffer.alloc(SECURE_SEQ_LEN)
		seqBuf.writeUIntBE(
			Number(this.sendSeq48 & 0xffffffffffffn),
			0,
			SECURE_SEQ_LEN,
		)
		this.sendSeq48 = (this.sendSeq48 + 1n) & 0xffffffffffffn
		const addrFields = Buffer.from([
			(srcIa >> 8) & 0xff,
			srcIa & 0xff,
			(dstGa >> 8) & 0xff,
			dstGa & 0xff,
		])
		const block0 = Buffer.concat([
			seqBuf,
			addrFields,
			Buffer.from([
				0x00,
				flags16 & 0xff,
				(TPCI_DATA << 2) + APCI_SEC.HIGH,
				APCI_SEC.LOW,
				0x00,
				plainApdu.length,
			]),
		])
		const macFull = calculateMessageAuthenticationCodeCBC(
			key,
			Buffer.from([SCF_ENCRYPTION_S_A_DATA]),
			plainApdu,
			block0,
		)
		const macShort = macFull.subarray(0, 4)
		const ctr0 = Buffer.concat([seqBuf, addrFields, DATA_SECURE_CTR_SUFFIX])
		const [encPayload, encMac] = encryptDataCtr(
			key,
			ctr0,
			macShort,
			plainApdu,
		)
		const secureApdu = Buffer.concat([
			APCI_SEC.HEADER,
			Buffer.from([SCF_ENCRYPTION_S_A_DATA]),
			seqBuf,
			encPayload,
			encMac,
		])
		npdu.tpci = APCI_SEC.HIGH
		npdu.apci = APCI_SEC.LOW
		npdu.data = new KNXDataBuffer(secureApdu.subarray(2))
	}

	private buildConnectResponse(): Buffer {
		const hpai = new HPAI(this.host, this.port, HPAIProtocol.IPV4_TCP)
		const crd = new CRD(
			ConnectionType.TUNNEL_CONNECTION,
			new KNXAddress(this.assignedIa, KNXAddressType.TYPE_INDIVIDUAL),
		)
		const response = new KNXConnectResponse(this.channelId, 0, hpai, crd)
		return Buffer.concat([response.header.toBuffer(), response.toBuffer()])
	}

	private buildConnectionStateResponse(request: Buffer): Buffer {
		const channel = request.readUInt8(6)
		const response = new KNXConnectionStateResponse(channel, 0)
		return response.toBuffer()
	}

	private buildDisconnectResponse(request: Buffer): Buffer {
		const channel = request.readUInt8(6)
		const response = new KNXDisconnectResponse(channel, 0)
		return response.toBuffer()
	}

	private wrapFrame(inner: Buffer): Buffer {
		if (!this.sessionKey) {
			throw new Error('Session key missing')
		}
		const seq = Buffer.alloc(SECURE_SEQ_LEN)
		seq.writeUIntBE(this.wrapperSeq++, 0, SECURE_SEQ_LEN)
		const len = SECURE_WRAPPER_OVERHEAD + inner.length
		const hdr = Buffer.concat([
			KNXIP_HDR_SECURE_WRAPPER,
			Buffer.from([len >> 8, len & 0xff]),
		])
		const additional = Buffer.concat([
			hdr,
			Buffer.from([this.sessionId >> 8, this.sessionId & 0xff]),
		])
		const block0 = Buffer.concat([
			seq,
			this.serial,
			SECURE_WRAPPER_TAG,
			Buffer.from([inner.length >> 8, inner.length & 0xff]),
		])
		const blocks = Buffer.concat([
			block0,
			Buffer.from([0x00, additional.length]),
			additional,
			inner,
		])
		const padded = pad16(blocks)
		const cipher = crypto.createCipheriv(
			'aes-128-cbc',
			this.sessionKey,
			Buffer.alloc(16, 0),
		)
		cipher.setAutoPadding(false)
		const encrypted = Buffer.concat([cipher.update(padded), cipher.final()])
		const macCbc = encrypted.subarray(encrypted.length - MAC_LEN_FULL)
		const ctrKey = crypto.createCipheriv(
			'aes-128-ctr',
			this.sessionKey,
			Buffer.concat([seq, this.serial, SECURE_WRAPPER_CTR_SUFFIX]),
		)
		const encMac = ctrKey.update(macCbc)
		const encData = ctrKey.update(inner)
		return Buffer.concat([
			hdr,
			Buffer.from([this.sessionId >> 8, this.sessionId & 0xff]),
			seq,
			this.serial,
			SECURE_WRAPPER_TAG,
			encData,
			encMac,
		])
	}

	private unwrapFrame(wrapper: Buffer): Buffer {
		if (!this.sessionKey) {
			throw new Error('Session key missing')
		}
		const seq = wrapper.subarray(8, 14)
		const serial = wrapper.subarray(14, 20)
		const tag = wrapper.subarray(20, 22)
		const data = wrapper.subarray(22, wrapper.length - 16)
		const mac = wrapper.subarray(wrapper.length - 16)
		const ctr = crypto.createDecipheriv(
			'aes-128-ctr',
			this.sessionKey,
			Buffer.concat([seq, serial, tag, SECURE_WRAPPER_MAC_SUFFIX]),
		)
		ctr.update(mac)
		return ctr.update(data)
	}

	private nextTunnelSeq(): number {
		const value = this.tunnelSeq & 0xff
		this.tunnelSeq = (this.tunnelSeq + 1) & 0xff
		return value
	}
}

function pad16(buffer: Buffer): Buffer {
	const remainder = buffer.length % 16
	if (remainder === 0) return buffer
	const padding = Buffer.alloc(16 - remainder, 0)
	return Buffer.concat([buffer, padding])
}

function KNXIP_HEADER_AND_BODY_LEN(body: number): number {
	return body + 6
}

export default MockSecureGateway
