'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNXSecureSessionRequest = void 0;
const KNXConstants = require("./KNXConstants");
const KNXPacket = require("./KNXPacket");
const HPAI = require("./HPAI");
const CRIFactory = __importDefault(require("./CRIFactory"));
const knx = require("../../index.js");

class KNXSecureSessionRequest extends KNXPacket.KNXPacket {
    constructor(cri, hpaiData = HPAI.HPAI.NULLHPAI) {
        //super(KNXConstants.KNX_CONSTANTS.SECURE_SESSION_REQUEST, hpaiControl.length + hpaiData.length + cri.length + 32);
        super(KNXConstants.KNX_CONSTANTS.SECURE_SESSION_REQUEST, hpaiData.length + 32);
        this.cri = cri;
        this.hpaiData = hpaiData;

        // 8 octets for the UDP/TCP HPAI and 32 octets for the client’s ECDH public value
        // LENGTH: Final = 40

        // Get the Keyring
        //this.keyring = knx.getDecodedKeyring();
        // Add the Diffie-Hellman
        let Curve25519 = require('./../Curve25519');

        const crypto = require('crypto');
        let keyPair = Curve25519.generateKeyPair(crypto.randomBytes(32));
        // Set the public and private pair ECHD and Get the Keyring
        knx.appendPropertyToDecodedKeyring("diffieHellmanClientPrivateValue", Buffer.from(keyPair.private).toString('hex'));
        this.keyring = knx.appendPropertyToDecodedKeyring("diffieHellmanClientPublicValue", Buffer.from(keyPair.public).toString('hex'));
        
        // // Send the DH curve as well
        // // 02/01/2022 SONO ARRIVATO QUI get the authentication password from the first tunnel of the interface
        // let authenticationPassword = this.keyring.Devices[0].authenticationPassword;
        // //authenticationPassword = authenticationPassword.length === 0 ? new byte[16] : authenticationPassword;
        // authenticationPassword = authenticationPassword.length === 0 ? "00000000000000000000000000000000" : authenticationPassword;
        // let _key = authenticationPassword;
        // _key = _key + new Array((32 + 1) - _key.length).join("\0");

        // let authenticationPasswordHEX = Buffer.from(_key).toString("hex");
        // let authenticationPasswordUint8Array = Uint8Array.from(Buffer.from(authenticationPasswordHEX, 'hex'));
        // let Curve25519 = require('./../Curve25519');
        // try {
        //     let secret = Curve25519.generateKeyPair(authenticationPasswordUint8Array);
        //     //let hexString = "f0c143e363147dc64913d736978042ef748ba448aa6ce2a1dab5ddecca919455";
        //     //secret.public = Uint8Array.from(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        //     this.diffieHellmanClientPublicValue = Buffer.from(secret.public).toString('hex');

        // } catch (error) {
        //     throw (error);
        // }


    }
    // static createFromBuffer(buffer, offset = 0) {
    //     if (offset >= buffer.length) {
    //         throw new Error('Buffer too short');
    //     }
    //     const hpaiControl = HPAI.HPAI.createFromBuffer(buffer, offset);
    //     offset += hpaiControl.length;
    //     const hpaiData = HPAI.HPAI.createFromBuffer(buffer, offset);
    //     offset += hpaiData.length;
    //     const cri = CRIFactory.default.createFromBuffer(buffer, offset);
    //     return new KNXSecureSessionRequest(cri, hpaiControl, hpaiData);
    // }
    toBuffer() {
        return Buffer.concat([
            this.header.toBuffer(),
            this.hpaiData.toBuffer(),
            Buffer.from(this.keyring.diffieHellmanClientPublicValue, "hex")
        ]);
    }
}
exports.KNXSecureSessionRequest = KNXSecureSessionRequest;
//# sourceMappingURL=KNXSecureSessionRequest.js.map