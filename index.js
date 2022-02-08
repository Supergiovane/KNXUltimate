const {KNXClient,KNXClientEvents} = require("./../knxultimate/src/KNXClient.js");
const KNXSecureKeyring = require('./../knxultimate/src/KNXsecureKeyring.js');    
exports.KNXSecureKeyring = KNXSecureKeyring;    

//exports.KNXClientEvents = KNXClient.KNXClientEvents;
try {
    exports.KNXClient = KNXClient;   
    exports.KNXClient.KNXClientEvents = KNXClientEvents;
} catch (error) {
    console.log("KNXSecureKeyring",error)    
}


//exports.KNXClientEvents = KNXClientEvents;
 