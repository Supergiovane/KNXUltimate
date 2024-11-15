import KNXHeader from './KNXHeader'
import KNXSearchRequest from './KNXSearchRequest'
import KNXSearchResponse from './KNXSearchResponse'
import KNXDescriptionRequest from './KNXDescriptionRequest'
import KNXDescriptionResponse from './KNXDescriptionResponse'
import KNXConnectRequest from './KNXConnectRequest'
import KNXConnectResponse from './KNXConnectResponse'
import KNXConnectionStateRequest from './KNXConnectionStateRequest'
import KNXConnectionStateResponse from './KNXConnectionStateResponse'
import KNXDisconnectRequest from './KNXDisconnectRequest'
import KNXDisconnectResponse from './KNXDisconnectResponse'
import KNXTunnellingRequest from './KNXTunnellingRequest'
import KNXTunnellingAck from './KNXTunnellingAck'
import KNXRoutingIndication from './KNXRoutingIndication'
import HPAI from './HPAI'
import { KNX_CONSTANTS } from './KNXConstants'
import { KNX_SECURE } from '../secure/SecureConstants'
import TunnelCRI from './TunnelCRI'
import CEMIMessage from './cEMI/CEMIMessage'

import {
	SessionRequest,
	SessionResponse,
	SessionAuthenticate,
	SessionStatus,
} from '../secure/messages/SessionMessages'
import SecureWrapper from '../secure/messages/SecureWrapper'

/**
 * Types for different KNX message categories
 */
export type KnxResponse =
	| KNXConnectResponse
	| KNXSearchResponse
	| KNXDescriptionResponse
	| KNXConnectionStateResponse
	| KNXDisconnectResponse
	| KNXTunnellingAck
	| KNXRoutingIndication

export type KnxRequest =
	| KNXConnectRequest
	| KNXSearchRequest
	| KNXDescriptionRequest
	| KNXConnectionStateRequest
	| KNXDisconnectRequest
	| KNXTunnellingRequest

export type KnxMessage = KnxResponse | KnxRequest

export type SecureMessage =
	| SessionRequest
	| SessionResponse
	| SessionAuthenticate
	| SessionStatus
	| SecureWrapper

/**
 * KNXProtocol class handles creation and parsing of KNX messages
 * including secure tunnelling messages according to ISO 22510:2019
 */
export default class KNXProtocol {
	/**
	 * Parse standard KNX message from buffer
	 */
	static parseMessage(buffer: Buffer) {
		const knxHeader: KNXHeader = KNXHeader.createFromBuffer(buffer)
		const knxData: Buffer = buffer.subarray(knxHeader.headerLength)
		let knxMessage: KnxMessage

		switch (knxHeader.service_type) {
			case KNX_CONSTANTS.SEARCH_REQUEST:
				knxMessage = KNXSearchRequest.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.SEARCH_RESPONSE:
				knxMessage = KNXSearchResponse.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.DESCRIPTION_REQUEST:
				knxMessage = KNXDescriptionRequest.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.DESCRIPTION_RESPONSE:
				knxMessage = KNXDescriptionResponse.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.CONNECT_REQUEST:
				knxMessage = KNXConnectRequest.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.CONNECT_RESPONSE:
				knxMessage = KNXConnectResponse.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.CONNECTIONSTATE_REQUEST:
				knxMessage = KNXConnectionStateRequest.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.CONNECTIONSTATE_RESPONSE:
				knxMessage =
					KNXConnectionStateResponse.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.DISCONNECT_REQUEST:
				knxMessage = KNXDisconnectRequest.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.DISCONNECT_RESPONSE:
				knxMessage = KNXDisconnectResponse.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.TUNNELLING_REQUEST:
				knxMessage = KNXTunnellingRequest.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.TUNNELLING_ACK:
				knxMessage = KNXTunnellingAck.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.ROUTING_INDICATION:
				knxMessage = KNXRoutingIndication.createFromBuffer(knxData)
				break
			case KNX_CONSTANTS.ROUTING_LOST_MESSAGE:
				break
			default:
				return { knxHeader, knxMessage: undefined, knxData }
		}

		return { knxHeader, knxMessage, knxData }
	}

	/**
	 * Parse secure KNX message from buffer
	 */
	static parseSecureMessage(buffer: Buffer) {
		const knxHeader = KNXHeader.createFromBuffer(buffer)
		const knxData = buffer.subarray(knxHeader.headerLength)
		let secureMessage: SecureMessage

		switch (knxHeader.service_type) {
			case KNX_SECURE.SERVICE_TYPE.SESSION_REQUEST:
				secureMessage = SessionRequest.createFromBuffer(knxData)
				break
			case KNX_SECURE.SERVICE_TYPE.SESSION_RESPONSE:
				secureMessage = SessionResponse.createFromBuffer(knxData)
				break
			case KNX_SECURE.SERVICE_TYPE.SESSION_AUTHENTICATE:
				secureMessage = SessionAuthenticate.createFromBuffer(knxData)
				break
			case KNX_SECURE.SERVICE_TYPE.SESSION_STATUS:
				secureMessage = SessionStatus.createFromBuffer(knxData)
				break
			case KNX_SECURE.SERVICE_TYPE.SECURE_WRAPPER:
				secureMessage = SecureWrapper.createFromBuffer(knxData)
				break
			default:
				throw new Error(
					`Unknown secure service type: ${knxHeader.service_type}`,
				)
		}

		return { knxHeader, secureMessage, knxData }
	}

	// Factory methods for standard KNX messages
	static newKNXSearchRequest(hpai: HPAI) {
		return new KNXSearchRequest(hpai)
	}

	static newKNXDescriptionRequest(hpai: HPAI) {
		return new KNXDescriptionRequest(hpai)
	}

	static newKNXConnectRequest(
		cri: TunnelCRI,
		hpaiControl: HPAI = HPAI.NULLHPAI,
		hpaiData: HPAI = HPAI.NULLHPAI,
	) {
		return new KNXConnectRequest(cri, hpaiControl, hpaiData)
	}

	static newKNXConnectionStateRequest(
		channelID: number,
		hpaiControl: HPAI = HPAI.NULLHPAI,
	) {
		return new KNXConnectionStateRequest(channelID, hpaiControl)
	}

	static newKNXDisconnectRequest(
		channelID: number,
		hpaiControl: HPAI = HPAI.NULLHPAI,
	) {
		return new KNXDisconnectRequest(channelID, hpaiControl)
	}

	static newKNXDisconnectResponse(channelID: number, status: number) {
		return new KNXDisconnectResponse(channelID, status)
	}

	static newKNXTunnellingACK(
		channelID: number,
		seqCounter: number,
		status: number,
	) {
		return new KNXTunnellingAck(channelID, seqCounter, status)
	}

	static newKNXTunnellingRequest(
		channelID: number,
		seqCounter: number,
		cEMIMessage: CEMIMessage,
	) {
		return new KNXTunnellingRequest(channelID, seqCounter, cEMIMessage)
	}

	static newKNXRoutingIndication(cEMIMessage: CEMIMessage) {
		return new KNXRoutingIndication(cEMIMessage)
	}

	// Factory methods for secure KNX messages
	static newSessionRequest(hpai: HPAI, publicKey: Buffer) {
		return new SessionRequest(hpai, publicKey)
	}

	static newSessionResponse(
		sessionId: number,
		publicKey: Buffer,
		deviceAuthCode: Buffer,
		clientPublicKey: Buffer,
		serialNumber: number,
	) {
		return SessionResponse.create(
			sessionId,
			publicKey,
			clientPublicKey,
			deviceAuthCode,
			serialNumber,
		)
	}

	static newSessionAuthenticate(
		userId: number,
		clientPublicKey: Buffer,
		serverPublicKey: Buffer,
		passwordHash: Buffer,
		serialNumber: number,
	) {
		return SessionAuthenticate.create(
			userId,
			clientPublicKey,
			serverPublicKey,
			passwordHash,
			serialNumber,
		)
	}

	static newSecureConnectRequest(
		cri: TunnelCRI,
		sessionId: number,
		sequenceNumber: number,
		serialNumber: number,
		messageTag: number,
		sessionKey: Buffer,
	): SecureWrapper {
		const connectRequest = this.newKNXConnectRequest(cri)
		const wrapper = SecureWrapper.wrap(
			connectRequest.toBuffer(),
			sessionId,
			sequenceNumber,
			serialNumber,
			messageTag,
			sessionKey,
		)
		return wrapper
	}

	static newSecureDisconnectRequest(
		channelId: number,
		sessionId: number,
		sequenceNumber: number,
		serialNumber: number,
		messageTag: number,
		sessionKey: Buffer,
	): SecureWrapper {
		const disconnectRequest = this.newKNXDisconnectRequest(channelId)
		const wrapper = SecureWrapper.wrap(
			disconnectRequest.toBuffer(),
			sessionId,
			sequenceNumber,
			serialNumber,
			messageTag,
			sessionKey,
		)
		return wrapper
	}
}
