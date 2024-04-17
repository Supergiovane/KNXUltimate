import KNXHeader from "./KNXHeader";
import KNXSearchRequest from "./KNXSearchRequest";
import KNXSearchResponse from "./KNXSearchResponse";
import KNXDescriptionRequest from "./KNXDescriptionRequest";
import KNXDescriptionResponse from "./KNXDescriptionResponse";
import KNXConnectRequest from "./KNXConnectRequest";
import KNXConnectResponse from "./KNXConnectResponse";
import KNXConnectionStateRequest from "./KNXConnectionStateRequest";
import KNXConnectionStateResponse from "./KNXConnectionStateResponse";
import KNXDisconnectRequest from "./KNXDisconnectRequest";
import KNXDisconnectResponse from "./KNXDisconnectResponse";
import KNXTunnelingRequest from "./KNXTunnelingRequest";
import KNXTunnelingAck from "./KNXTunnelingAck";
import KNXRoutingIndication from "./KNXRoutingIndication";
import KNXSecureSessionRequest from "./KNXSecureSessionRequest";
import HPAI from "./HPAI";
import { KNX_CONSTANTS } from "./KNXConstants";

export default class KNXProtocol {
  static parseMessage(buffer: Buffer) {
    const knxHeader: KNXHeader = KNXHeader.createFromBuffer(buffer);
    const knxData: Buffer = buffer.slice(knxHeader.headerLength);
    let knxMessage;
    switch (knxHeader.service_type) {
      case KNX_CONSTANTS.SEARCH_REQUEST:
        knxMessage = KNXSearchRequest.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.SEARCH_RESPONSE:
        knxMessage = KNXSearchResponse.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.DESCRIPTION_REQUEST:
        knxMessage = KNXDescriptionRequest.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.DESCRIPTION_RESPONSE:
        knxMessage = KNXDescriptionResponse.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.CONNECT_REQUEST:
        knxMessage = KNXConnectRequest.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.CONNECT_RESPONSE:
        knxMessage = KNXConnectResponse.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.CONNECTIONSTATE_REQUEST:
        knxMessage = KNXConnectionStateRequest.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.CONNECTIONSTATE_RESPONSE:
        knxMessage = KNXConnectionStateResponse.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.DISCONNECT_REQUEST:
        knxMessage = KNXDisconnectRequest.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.DISCONNECT_RESPONSE:
        knxMessage = KNXDisconnectResponse.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.TUNNELING_REQUEST:
        knxMessage = KNXTunnelingRequest.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.TUNNELING_ACK:
        knxMessage = KNXTunnelingAck.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.ROUTING_INDICATION:
        knxMessage = KNXRoutingIndication.createFromBuffer(knxData);
        break;
      case KNX_CONSTANTS.ROUTING_LOST_MESSAGE:
        break;
    }
    return { knxHeader, knxMessage, knxData };
  }

  static newKNXSearchRequest(hpai: HPAI) {
    return new KNXSearchRequest(hpai);
  }

  static newKNXDescriptionRequest(hpai: HPAI) {
    return new KNXDescriptionRequest(hpai);
  }

  static newKNXConnectRequest(
    cri: any,
    hpaiControl: HPAI = HPAI.NULLHPAI,
    hpaiData: HPAI = HPAI.NULLHPAI
  ) {
    return new KNXConnectRequest(cri, hpaiControl, hpaiData);
  }

  static newKNXConnectionStateRequest(
    channelID: any,
    hpaiControl: HPAI = HPAI.NULLHPAI
  ) {
    return new KNXConnectionStateRequest(channelID, hpaiControl);
  }

  static newKNXDisconnectRequest(
    channelID: any,
    hpaiControl: HPAI = HPAI.NULLHPAI
  ) {
    return new KNXDisconnectRequest(channelID, hpaiControl);
  }

  static newKNXDisconnectResponse(channelID: any, status: any) {
    return new KNXDisconnectResponse(channelID, status);
  }

  static newKNXTunnelingACK(channelID: any, seqCounter: any, status: any) {
    return new KNXTunnelingAck(channelID, seqCounter, status);
  }

  static newKNXTunnelingRequest(
    channelID: any,
    seqCounter: any,
    cEMIMessage: any
  ) {
    return new KNXTunnelingRequest(channelID, seqCounter, cEMIMessage);
  }

  static newKNXRoutingIndication(cEMIMessage: any) {
    return new KNXRoutingIndication(cEMIMessage);
  }

  static newKNXSecureSessionRequest(
    cri: any,
    hpaiData: HPAI = HPAI.NULLHPAI,
    jKNXSecureKeyring: any
  ) {
    return new KNXSecureSessionRequest(cri, hpaiData, jKNXSecureKeyring);
  }
}
