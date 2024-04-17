//const KNXSecureKeyring = require('./../knxultimate/src/KNXsecureKeyring.js');    
//exports.KNXSecureKeyring = KNXSecureKeyring;  

import KNXSecureKeyring from './KNXsecureKeyring.js'

import { KNXClient, KNXClientEvents, getDecodedKeyring, appendPropertyToDecodedKeyring } from "./KNXClient.js";

export {
    KNXClient,
    KNXClientEvents,
    getDecodedKeyring,
    appendPropertyToDecodedKeyring,
    // KNXSecureKeyring
}