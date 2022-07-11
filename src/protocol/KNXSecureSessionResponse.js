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
    constructor(_secureSessionID, _diffieHellmanServerPublicValue, _messageAuthenticationCode) {


        // For KNX IP Secure, a secure connection (Tunnelling or Device Management) is established in the following way:
        // • Both the client as well as the server creates an individual
        // public / private key pair. This is referred to as an asymmetrical
        // encryption.
        // • The client sends its public key to the server as plain text.
        // • The server responds with its public key in plain text, append-
        // ed with the result of the following calculation: it calculates the XOR value of its server public key with the client’s public key, encrypts this with the device code to authentify itself to the client and encrypts this a second time with the calculated session key.
        // The device authentication code is either assigned by the
        // ETS during configuration or the tool key. This device authen- tication code needs to be provided to the operator of the visualisation wishing to establish a secure connection with the
        // relevant server.
        // • The client performs the same XOR operation, but authorises
        // itself by encrypting this firstly with one of the passwords of the server and again a second time with the session key.
        // It shall be noted that the encryption algorithm used (Diffie Hellmann) ensures that the session key of the client and the server are identical. The passwords of the server need to be provided to the operator of the visualisation wishing to estab- lish a secure connection with the relevant server.
        // As regards the above described measures to protect runtime communication, it shall be noted that:
        // • KNX Data Secure devices can be used without any problem
        // next to “classic” KNX devices. This implies that KNX data and IP Secure can be implemented as additional security measure.
        // • If an installer chooses to use a KNX IP Secure device in an IP backbone, all IP couplers and any KNX IP devices in this back- bone need to be of the type KNX IP Secure.
        // • If an installer has – at the wish of a customer - used for a function a KNX secure device to secure the runtime com- munication, each communication partner of this device needs to also support KNX Secure for the linked function. In other words, a communication object of a KNX Secure Device can- not be linked once to a secured group address and once to a plain group address.
        // Devices, which support KNX Data and IP secure, can be distin- guished from “classic” KNX devices, as on the product label a “X” sign is shown.
        // KNX IP Secure and KNX Data Secure are supported from ETS 5.5 onwards. The ETS allows to configure new KNX Secure de- vices and also allows to replace defective KNX Secure devices.

        //super(KNXConstants.KNX_CONSTANTS.SECURE_SESSION_REQUEST, hpaiControl.length + hpaiData.length + cri.length + 32);
        super(KNXConstants.KNX_CONSTANTS.SECURE_SESSION_RESPONSE, 56);
        //this.secureSessionID = _secureSessionID;
        //this.messageAuthenticationCode = _messageAuthenticationCode;
        // Add the secure session ID to the keyring object
        this.keyring = knx.appendPropertyToDecodedKeyring("secureSessionID", _secureSessionID);// .getDecodedKeyring();

        // // Getting the user password. The user id 0 is reserved and the user id 1 is used for management tasks,
        // // thus you will need to specify a user id that is 2 or higher according to the tunneling channel you would like to use.
        // let user2AuthenticationPassword = this.keyring.interfaces.find(a => a.userID === "2").authenticationPassword;
        // let user2DeviceHost = this.keyring.interfaces.find(a => a.userID === "2").host;
        // // Get the device auth password
        // let deviceAuthenticationPassword = this.keyring.Devices.find(a => a.individualAddress === user2DeviceHost).authenticationPassword;

        // Calculating the session key:
        // The session key is calculated as follows (for both the KNXnet/IP secure client and KNXnet/IP secure server):
        // 1) sharedSecret_in_little_endian = Curve25519(myPrivateKey, peersPublicKey)
        // 2) hash_in_big_endian = SHA256(sharedSecret_in_little_endian)
        // 3) sessionKey = get_first_16_bytes(hash_in_big_endian)
        let Curve25519 = require('./../Curve25519');
        let sharedSecret_in_little_endian = Curve25519.sharedKey(Buffer.from(this.keyring.diffieHellmanClientPrivateValue, "hex"), Buffer.from(_diffieHellmanServerPublicValue, "hex"));
        const CryptoJS = require('crypto-js');
        let hash_in_big_endian = CryptoJS.SHA256(sharedSecret_in_little_endian.toString());
        let sessionKey = Buffer.from(hash_in_big_endian.toString()).slice(0, 16);
        knx.appendPropertyToDecodedKeyring("sessionKey", sessionKey);
        knx.appendPropertyToDecodedKeyring("diffieHellmanServerPublicValue", _diffieHellmanServerPublicValue);
        
        


        console.log("BABANAN")
        // KEYRING:
        // {
        //     ETSProjectName: "KNX Secure",
        //     ETSCreatedBy: "ETS 5.7.6 (Build 1398)",
        //     ETSCreated: "2021-11-17T07:43:08",
        //     HASHkeyringPasswordBase64: "08qj3lhCDI1zINbqanGlaQ==",
        //     HASHCreatedBase64: "bX2hbMK6AR9l/U9ATjbwlA==",
        //     backbone: {
        //       multicastAddress: "224.0.23.12",
        //       latency: "2000",
        //       key: "28bd8f6fb56881eb8b4b3e3aec960f13",
        //     },
        //     interfaces: [
        //       {
        //         individualAddress: "3.1.2",
        //         type: "Tunneling",
        //         host: "3.1.1",
        //         userID: "2",
        //         managementPassword: ".!Pea332",
        //         authenticationPassword: "autenticazione",
        //       },
        //       {
        //         individualAddress: "3.1.3",
        //         type: "Tunneling",
        //         host: "3.1.1",
        //         userID: "3",
        //         managementPassword: "6Y*xu2QN",
        //         authenticationPassword: "autenticazione",
        //       },
        //       {
        //         individualAddress: "3.1.4",
        //         type: "Tunneling",
        //         host: "3.1.1",
        //         userID: "4",
        //         managementPassword: "7e#qfoGG",
        //         authenticationPassword: "autenticazione",
        //       },
        //       {
        //         individualAddress: "3.1.5",
        //         type: "Tunneling",
        //         host: "3.1.1",
        //         userID: "5",
        //         managementPassword: "WC@rJrl*",
        //         authenticationPassword: "autenticazione",
        //       },
        //       {
        //         individualAddress: "3.1.6",
        //         type: "Tunneling",
        //         host: "3.1.1",
        //         userID: "6",
        //         managementPassword: ".\"M1Cmjr",
        //         authenticationPassword: "autenticazione",
        //       },
        //       {
        //         individualAddress: "3.1.7",
        //         type: "Tunneling",
        //         host: "3.1.1",
        //         userID: "7",
        //         managementPassword: "+-Ikuj y",
        //         authenticationPassword: "autenticazione",
        //       },
        //       {
        //         individualAddress: "3.1.8",
        //         type: "Tunneling",
        //         host: "3.1.1",
        //         userID: "8",
        //         managementPassword: "4NV@Xp=(",
        //         authenticationPassword: "autenticazione",
        //       },
        //       {
        //         individualAddress: "3.1.9",
        //         type: "Tunneling",
        //         host: "3.1.1",
        //         userID: "9",
        //         managementPassword: "\"3CDfNH3",
        //         authenticationPassword: "autenticazione",
        //       },
        //     ],
        //     groupAddresses: [
        //       {
        //         address: "8/0/0",
        //         key: "313681939762ff36fdcd774efec56d1b",
        //       },
        //       {
        //         address: "8/0/1",
        //         key: "e990d57b3630bc4940a40d0c7caa3698",
        //       },
        //       {
        //         address: "8/0/2",
        //         key: "cc0e1a6204d5c4623626b1ccc1069b63",
        //       },
        //     ],
        //     Devices: [
        //       {
        //         individualAddress: "3.1.1",
        //         sequenceNumber: "121960556295",
        //         toolKey: "51b52bef0f8d5b83f7975fb3c1d67f96",
        //         managementPassword: "commissione",
        //         authenticationPassword: "autenticazione",
        //       },
        //       {
        //         individualAddress: "3.1.10",
        //         sequenceNumber: "121960675276",
        //         toolKey: "db580560e32dc040d062e4f91bbf1182",
        //         managementPassword: null,
        //         authenticationPassword: null,
        //       },
        //       {
        //         individualAddress: "3.1.11",
        //         sequenceNumber: "121960725775",
        //         toolKey: "f03ca86237705ed9d7014627fb16f88a",
        //         managementPassword: null,
        //         authenticationPassword: null,
        //       },
        //     ],
        //     diffieHellmanClientPrivateValue: "d8667c58b2c6e0a4e6b1642dec8bb7da3a8698299925b8310b082f06c2301479",
        //     diffieHellmanClientPublicValue: "4689a7337c655e5c4fdfd70a2c2dfebd5e7773f0c7c23932b59c7f490d7fcb51",
        //     secureSessionID: "0012",
        //   }




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
        const secureSessionID = Buffer.from(buffer.slice(0, 2)).readUInt16BE(); // It's in big endian
        // Diffie-Hellman Server Public Value Y    
        const diffieHellmanServerPublicValue = Buffer.from(buffer.slice(2, 34)).toString("hex");
        // Message Authentication Code
        const messageAuthenticationCode = Buffer.from(buffer.slice(34, 50)).toString("hex");
        return new KNXSecureSessionResponse(secureSessionID, diffieHellmanServerPublicValue, messageAuthenticationCode);
    }

}
exports.KNXSecureSessionResponse = KNXSecureSessionResponse;
//# sourceMappingURL=KNXSecureSessionResponse.js.map