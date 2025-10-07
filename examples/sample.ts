/**
 * Example script performing a full KNX workflow.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNXClientOptions } from "../src/KNXClient";
import { KNXClientEvents, KNXClient, dptlib } from "../src";

// Get a list of supported datapoints
// With this function, you can see what datapoints are supported and a sample on how you need to format the payload to be sent.
// ######################################
// Helpers
const sortBy = (field) => (a, b) => {
    if (a[field] > b[field]) { return 1 } else { return -1 }
};
const onlyDptKeys = (kv) => {
    return kv[0].startsWith("DPT")
};
const extractBaseNo = (kv) => {
    return {
        subtypes: kv[1].subtypes,
        base: parseInt(kv[1].id.replace("DPT", ""))
    }
};
const convertSubtype = (baseType) => (kv) => {
    let value = `${baseType.base}.${kv[0]}`;
    //let sRet = value + " " + kv[1].name + (kv[1].unit === undefined ? "" : " (" + kv[1].unit + ")");
    let sRet = value + " " + kv[1].name;
    return {
        value: value
        , text: sRet
    }
}
const toConcattedSubtypes = (acc, baseType) => {
    let subtypes =
        Object.entries(baseType.subtypes)
            .sort(sortBy(0))
            .map(convertSubtype(baseType))

    return acc.concat(subtypes)
};
const dptGetHelp = dpt => {
    var sDPT = dpt.split(".")[0]; // Takes only the main type
    var jRet;
    if (sDPT == "0") { // Special fake datapoint, meaning "Universal Mode"
        jRet = {
            "help":
                ``, "helplink": "https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki"
        };
        return (jRet);
    }
    jRet = { "help": "No sample currently avaiable", "helplink": "https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-SamplesHome" };
    const dpts =
        Object.entries(dptlib.dpts)
            .filter(onlyDptKeys)
    for (let index = 0; index < dpts.length; index++) {
        if (dpts[index][0].toUpperCase() === "DPT" + sDPT) {
            jRet = { "help": (dpts[index][1].basetype.hasOwnProperty("help") ? dpts[index][1].basetype.help : "No sample currently avaiable, just pass the payload as is it"), "helplink": (dpts[index][1].basetype.hasOwnProperty("helplink") ? dpts[index][1].basetype.helplink : "https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-SamplesHome") };
            break;
        }
    }
    return (jRet);
}
const dpts =
    Object.entries(dptlib.dpts)
        .filter(onlyDptKeys)
        .map(extractBaseNo)
        .sort(sortBy("base"))
        .reduce(toConcattedSubtypes, [])
dpts.forEach(element => {
    console.log(element.text + " USAGE: " + dptGetHelp(element.value).help);
    console.log(" ");
});
// ######################################

// Let's connect and turn on your appliance.
// Set the properties
let knxUltimateClientProperties: KNXClientOptions = {
    ipAddr: "224.0.23.12",
    ipPort: "3671",
    physAddr: "1.1.100",
    suppress_ack_ldatareq: false,
    loglevel: "error", // 'disable', 'error', 'warn', 'info', 'debug'
    hostProtocol: "Multicast", // "Multicast" in case you use a KNX/IP Router, "TunnelUDP" in case of KNX/IP Interface, "TunnelTCP" in case of secure KNX/IP Interface (not yet implemented)
    isSecureKNXEnabled: false, // Leave "false" until KNX-Secure has been released
    localIPAddress: "", // Leave blank, will be automatically filled by KNXUltimate
    KNXQueueSendIntervalMilliseconds:25 // Optrional. Queue interval between each KNX telegram. Default is 1 telegram each 25ms
};

let knxUltimateClient: KNXClient;

// If you're reinstantiating a new knxUltimateClient object, you must remove all listeners.
// If this is the first time you instantiate tne knxUltimateClient object, this part of code throws an error into the try...catch.
try {
    if (knxUltimateClient !== null) knxUltimateClient.removeAllListeners();
} catch (error) {
    // New connection, do nothing.
}

// Let's go
knxUltimateClient = new KNXClient(knxUltimateClientProperties);

// Setting handlers
// ######################################
// Note: datagram.cEMIMessage is ensured to be plain (decrypted)
// if the telegram was Data Secure and keys are available.
knxUltimateClient.on(KNXClientEvents.indication, (datagram, echoed) => {

    // This function is called whenever a KNX telegram arrives from BUS

    // Get the event
    let event = "";
    let dpt = "";
    let jsValue: any;

    if (datagram.cEMIMessage.npdu.isGroupRead) event = "GroupValue_Read";
    if (datagram.cEMIMessage.npdu.isGroupResponse) event = "GroupValue_Response";
    if (datagram.cEMIMessage.npdu.isGroupWrite) event = "GroupValue_Write";
    // Get the source Address
    let src = datagram.cEMIMessage.srcAddress.toString();
    // Get the destination GA
    let dst = datagram.cEMIMessage.dstAddress.toString()
    // Get the RAW Value
    let rawvalue = datagram.cEMIMessage.npdu.dataValue;

    // Decode the telegram. 
    if (dst === "0/1/1") {
        // We know that 0/1/1 is a boolean DPT 1.001
        const config = dptlib.resolve("1.001");
        jsValue = dptlib.fromBuffer(rawvalue, config)
    } else if (dst === "0/1/2") {
        // We know that 0/1/2 is a boolean DPT 232.600 Color RGB
        const config = dptlib.resolve("232.600");
        jsValue = dptlib.fromBuffer(rawvalue, config)
    } else {
        // All others... assume they are boolean
        const config = dptlib.resolve("1.001");
        jsValue = dptlib.fromBuffer(rawvalue, config)
        if (jsValue === null) {
            // Is null, try if it's a numerical value
            const config = dptlib.resolve("5.001");
            jsValue = dptlib.fromBuffer(rawvalue, config)
        }
    }
    console.log("src: " + src + " dest: " + dst, " event: " + event, " value: " + jsValue);

});
knxUltimateClient.on(KNXClientEvents.error, err => {
    // Error event
    console.log("Error", err)
});
knxUltimateClient.on(KNXClientEvents.disconnected, info => {
    // The client is disconnected. Here you can handle the reconnection
    console.log("Disconnected", info)
});
knxUltimateClient.on(KNXClientEvents.close, () => {
    // The client physical net socket has been closed
    console.log("Closed")
});
knxUltimateClient.on(KNXClientEvents.ackReceived, (knxMessage, info) => {
    // In -->tunneling mode<-- (in ROUTING mode there is no ACK event), signals wether the last KNX telegram has been acknowledge or not
    // knxMessage: contains the telegram sent.
    // info is true it the last telegram has been acknowledge, otherwise false.
    console.log("Last telegram acknowledge", knxMessage, info)
});
knxUltimateClient.on(KNXClientEvents.connected, info => {
    // The client is connected
    console.log("Connected. On Duty", info)

    // Check wether knxUltimateClient is clear to send the next telegram.
    // This should be called bevore any .write, .response, and .read request.
    // If not clear to send, retry later because the knxUltimateClient is busy in sending another telegram.
    console.log("Clear to send: " + knxUltimateClient.clearToSend)

    // // Send a WRITE telegram to the KNX BUS
    // // You need: group address, payload (true/false/or any message), datapoint as string
    let payload: any = false;
    if (knxUltimateClient.clearToSend) knxUltimateClient.write("0/1/1", payload, "1.001");

    // Send a color RED to an RGB datapoint
    payload = { red: 125, green: 0, blue: 0 };
    if (knxUltimateClient.clearToSend) knxUltimateClient.write("0/1/2", payload, "232.600");

    // // Send a READ request to the KNX BUS
    if (knxUltimateClient.clearToSend) knxUltimateClient.read("0/0/1");

    // Send a RESPONSE telegram to the KNX BUS
    // You need: group address, payload (true/false/or any message), datapoint as string
    payload = false;
    if (knxUltimateClient.clearToSend) knxUltimateClient.respond("0/0/1", payload, "1.001");

});
knxUltimateClient.on(KNXClientEvents.connecting, info => {
    // The client is setting up the connection
    console.log("Connecting...", info)
});
// ######################################

knxUltimateClient.Connect();

// Disconnect after 20 secs.
setTimeout(() => {
    if (knxUltimateClient.isConnected()) knxUltimateClient.Disconnect();
}, 20000);
