
const knx = require("./index.js");
const KNXAddress = require("./src/protocol/KNXAddress").KNXAddress;
const dptlib = require('./src/dptlib');
const KNXDataBuffer = require("./src/protocol/KNXDataBuffer").KNXDataBuffer;

// Create tunnel socket with source knx address 1.1.100


// 25/08/2021 Moved out of node.initKNXConnection 
let knxUltimateClientProperties = {
    ipAddr: "224.0.23.12",
    ipPort: "3671",
    physAddr: "1.1.100",
    suppress_ack_ldatareq: false,
    loglevel: "error", // or "debug" is the default
    localEchoInTunneling: true, // Leave true, forever.
    hostProtocol: "Multicast", // "Multicast" in case you use a KNX/IP Router, "TunnelUDP" in case of KNX/IP Interface, "TunnelTCP" in case of secure KNX/IP Interface (not yet implemented)
    isSecureKNXEnabled: false, // Leave "false" until KNX-Secure has been released
    jKNXSecureKeyring: "", // ETS Keyring JSON file (leave blank until KNX-Secure has been released)
    localIPAddress: "", // Leave blank, will be automatically filled by KNXUltimate
    KNXEthInterface: "Auto", // Bind to the first avaiable local interfavce. "Manual" if you wish to specify the interface (for example eth1); in this case, set the property interface to the interface name (interface:"eth1")
};


// Let's go
const knxUltimateClient = new knx.KNXClient(knxUltimateClientProperties);

// Setting handlers
// ######################################
knxUltimateClient.on(knx.KNXClient.KNXClientEvents.indication, handleBusEvents);
knxUltimateClient.on(knx.KNXClient.KNXClientEvents.error, err => {
    // Error event
    console.log("Error", err)
});
knxUltimateClient.on(knx.KNXClient.KNXClientEvents.disconnected, info => {
    // The client is cisconnected
    console.log("Disconnected", info)
});
knxUltimateClient.on(knx.KNXClient.KNXClientEvents.close, info => {
    // The client connection has been closed
    console.log("Closed", info)

});
knxUltimateClient.on(knx.KNXClient.KNXClientEvents.connected, info => {
    // The client is connected
    console.log("Connected. On Duty", info)

});
knxUltimateClient.on(knx.KNXClient.KNXClientEvents.connecting, info => {
    // The client is setting up the connection
    console.log("Connecting...", info)
});
// ######################################

knxUltimateClient.Connect();

// Handle BUS events
// ---------------------------------------------------------------------------------------
function handleBusEvents(_datagram, _echoed) {

    // Traffic
    let _evt = "";
    if (_datagram.cEMIMessage.npdu.isGroupRead) _evt = "GroupValue_Read";
    if (_datagram.cEMIMessage.npdu.isGroupResponse) _evt = "GroupValue_Response";
    if (_datagram.cEMIMessage.npdu.isGroupWrite) _evt = "GroupValue_Write";
    console.log("src: " + _datagram.cEMIMessage.srcAddress.toString() + " dest: " + _datagram.cEMIMessage.dstAddress.toString(), " event: " + _evt);

}

// Get a list of supported datapoints
// ######################################
//Helpers
sortBy = (field) => (a, b) => {
    if (a[field] > b[field]) { return 1 } else { return -1 }
};


onlyDptKeys = (kv) => {
    return kv[0].startsWith("DPT")
};

extractBaseNo = (kv) => {
    return {
        subtypes: kv[1].subtypes,
        base: parseInt(kv[1].id.replace("DPT", ""))
    }
};

convertSubtype = (baseType) => (kv) => {
    let value = `${baseType.base}.${kv[0]}`;
    //let sRet = value + " " + kv[1].name + (kv[1].unit === undefined ? "" : " (" + kv[1].unit + ")");
    let sRet = value + " " + kv[1].name;
    return {
        value: value
        , text: sRet
    }
}

toConcattedSubtypes = (acc, baseType) => {
    let subtypes =
        Object.entries(baseType.subtypes)
            .sort(sortBy(0))
            .map(convertSubtype(baseType))

    return acc.concat(subtypes)
};
const dpts =
    Object.entries(dptlib)
        .filter(onlyDptKeys)
        .map(extractBaseNo)
        .sort(sortBy("base"))
        .reduce(toConcattedSubtypes, [])
dpts.forEach(element => {
    console.log(element.text);
});

// ######################################



console.log("WARNING: I'm about to write to your BUS in 10 seconds! Press Control+C to abort!")
console.log("WARNING: I'm about to write to your BUS in 10 seconds! Press Control+C to abort!")
console.log("WARNING: I'm about to write to your BUS in 10 seconds! Press Control+C to abort!")
console.log("WARNING: I'm about to write to your BUS in 10 seconds! Press Control+C to abort!")
console.log("WARNING: I'm about to write to your BUS in 10 seconds! Press Control+C to abort!")

// WRITE SOMETHING 
// WARNING, THIS WILL WRITE TO YOUR BUS !!!!
setTimeout(() => {

    // // Send a WRITE telegram to the KNX BUS
    // // You need: group address, message (true/false/or any message), datapoint as string
    knxUltimateClient.write("0/1/1", true, "1.001");

    // // Send a READ request to the KNX BUS
     knxUltimateClient.read("0/0/1");

    // // Send a RESPONSE telegram to the KNX BUS
    // // You need: group address, message (true/false/or any message), datapoint as string
    knxUltimateClient.respond("0/0/1", true, "1.001");


}, 10000);