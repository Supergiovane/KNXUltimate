const {KNXClient,KNXClientEvents} = require("./../KNXUltimate/src/KNXClient.js");
const KNXSecureKeyring = require('./../KNXUltimate/src/KNXsecureKeyring.js');    
exports.KNXSecureKeyring = KNXSecureKeyring;    

//exports.KNXClientEvents = KNXClient.KNXClientEvents;
try {
    exports.KNXClient = KNXClient;   
    exports.KNXClient.KNXClientEvents = KNXClientEvents;
} catch (error) {
    console.log("KNXSecureKeyring",error)    
}


//exports.KNXClientEvents = KNXClientEvents;
 