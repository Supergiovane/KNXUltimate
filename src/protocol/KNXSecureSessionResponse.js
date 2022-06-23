'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNXSecureSessionResponse = void 0;
const KNXConstants = require("./KNXConstants");
const KNXPacket = require("./KNXPacket");
const HPAI = require("./HPAI");
const CRIFactory = __importDefault(require("./CRIFactory"));
const knx = require("../../index.js");

class KNXSecureSessionResponse extends KNXPacket.KNXPacket {
    constructor(secureSessionID, diffieHellmanServerPublicValue, messageAuthenticationCode) {

        //super(KNXConstants.KNX_CONSTANTS.SECURE_SESSION_REQUEST, hpaiControl.length + hpaiData.length + cri.length + 32);
        super(KNXConstants.KNX_CONSTANTS.SECURE_SESSION_RESPONSE, 56);
        this.secureSessionID = secureSessionID;
        this.diffieHellmanServerPublicValue = diffieHellmanServerPublicValue;
        this.messageAuthenticationCode = messageAuthenticationCode;

       

        // 8 octets for the UDP/TCP HPAI and 32 octets for the client’s ECDH public value
        // LENGTH: Final = 56 bytes


        // Get the Keyring
        //this.keyring = knx.getDecodedKeyring();

        // Add the Diffie-Hellman
        // let Curve25519 = require('./../Curve25519');
        // const crypto = require('crypto');
        // let keyPair = Curve25519.generateKeyPair(crypto.randomBytes(32));
        // // Get the Keyring
        // this.keyring = knx.getDecodedKeyring();

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
    static createFromBuffer(buffer, offset = 0) {


        // +-7-+-6-+-5-+-4-+-3-+-2-+-1-+-0-+-7-+-6-+-5-+-4-+-3-+-2-+-1-+-0-+---------------------+
        // |                     Secure Session Identifier                 |                     |
        // |                     (2 Octet)                                 |                     |
        // +-7-+-6-+-5-+-4-+-3-+-2-+-1-+-0-+-7-+-6-+-5-+-4-+-3-+-2-+-1-+-0-+  Unencrypted Data   |
        // |             Diffie-Hellman Server Public Value Y              |                     |
        // |             (32 Octet)                                        |                     |
        // +-7-+-6-+-5-+-4-+-3-+-2-+-1-+-0-+-7-+-6-+-5-+-4-+-3-+-2-+-1-+-0-+---------------------+
        // |                   Message Authentication Code                  |  Encrypted Data     |
        // |                   (16 Octet)                                  |  (AES128 CCM)       |
        // +-7-+-6-+-5-+-4-+-3-+-2-+-1-+-0-+-7-+-6-+-5-+-4-+-3-+-2-+-1-+-0-+---------------------+

        // From Wireshark
        // KNX/IP Session Response #0001
        // KNX/IP Header: Session Response
        //     Header Length: 6 bytes
        //     Protocol Version: 1.0
        //     Service Identifier: Session Response (0x0952)
        //     Total Length: 56 bytes
        // Session: 0x0001
        // DH Server Public Value: $ E9 93 E4 0C BA A3 D1 67 8D 88 F0 E9 7D 61 36 1E 35 44 F7 4E 60 0D 01 F9 1C 42 0D 16 30 B9 76 5F
        // Message Authentication Code: $ EA 34 CA 97 D5 7D D5 DE E7 A2 DE 58 86 6B 5A 4B

        if (offset >= buffer.length) {
            throw new Error('Buffer too short');
        }
        // Secure Session Identifier  
        const secureSessionID = Buffer.from(buffer.slice(0, 2)).toString("hex");//Buffer.from(buffer, 0, 2).readUint16LE();
        // Diffie-Hellman Server Public Value Y    
        const diffieHellmanServerPublicValue = Buffer.from(buffer.slice(2, 34)).toString("hex");
        // Message Authentication Code
        const messageAuthenticationCode = Buffer.from(buffer.slice(34, 50)).toString("hex");
        return new KNXSecureSessionResponse(secureSessionID, diffieHellmanServerPublicValue, messageAuthenticationCode);
    }

}
exports.KNXSecureSessionResponse = KNXSecureSessionResponse;
//# sourceMappingURL=KNXSecureSessionResponse.js.map