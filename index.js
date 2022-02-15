const {KNXClient,KNXClientEvents,getDecodedKeyring} = require("./src/KNXClient.js");
//const KNXSecureKeyring = require('./../knxultimate/src/KNXsecureKeyring.js');    
//exports.KNXSecureKeyring = KNXSecureKeyring;    

//exports.KNXClientEvents = KNXClient.KNXClientEvents;
try {
    exports.KNXClient = KNXClient;   
    exports.KNXClient.KNXClientEvents = KNXClientEvents;
    exports.getDecodedKeyring = getDecodedKeyring;
} catch (error) {
    console.log("index",error)    
}


//exports.KNXClientEvents = KNXClientEvents;
 