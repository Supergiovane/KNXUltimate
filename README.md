![Logo](img/logo-big.png)

<br/>

[![NPM version][npm-version-image]][npm-url]
[![NPM downloads per month][npm-downloads-month-image]][npm-url]
[![NPM downloads total][npm-downloads-total-image]][npm-url]
[![MIT License][license-image]][license-url]
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Youtube][youtube-image]][youtube-url]
[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square)](https://www.paypal.me/techtoday) 


Control your KNX intallation via Node.js!


 KNX IP protocol implementation in pure Node.js

 This is the official engine of Node-Red node KNX-Ultimate (https://flows.nodered.org/node/KNXUltimate)
 I had many users asking for a node.js release of that engine, so here is it.
 The node will be KNX Secure compatible. I'm already working on that.

## CHANGELOG

* See <a href="https://github.com/Supergiovane/knxultimate/blob/master/CHANGELOG.md">here the changelog</a>


 Here the usage sample (you can find this sample in the "sample.js" file):

```javascript

const knx = require("./index.js");
const dptlib = require('./src/dptlib');

// Set the properties
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
// Helpers
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

dptGetHelp = dpt => {
    var sDPT = dpt.split(".")[0]; // Takes only the main type
    var jRet;
    if (sDPT == "0") { // Special fake datapoint, meaning "Universal Mode"
        jRet = {
            "help":
                ``, "helplink": "https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki"
        };
        res.json(jRet);
        return;
    }
    jRet = { "help": "NO", "helplink": "https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-SamplesHome" };
    const dpts =
        Object.entries(dptlib)
            .filter(onlyDptKeys)
    for (let index = 0; index < dpts.length; index++) {
        if (dpts[index][0].toUpperCase() === "DPT" + sDPT) {
            jRet = { "help": (dpts[index][1].basetype.hasOwnProperty("help") ? dpts[index][1].basetype.help : "NO"), "helplink": (dpts[index][1].basetype.hasOwnProperty("helplink") ? dpts[index][1].basetype.helplink : "https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-SamplesHome") };
            break;
        }
    }
    return (jRet);
}

const dpts =
    Object.entries(dptlib)
        .filter(onlyDptKeys)
        .map(extractBaseNo)
        .sort(sortBy("base"))
        .reduce(toConcattedSubtypes, [])
dpts.forEach(element => {
    console.log(element.text + " USAGE: " + dptGetHelp(element.value).help);
    console.log(" ");
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
    // // You need: group address, payload (true/false/or any message), datapoint as string
    let payload = true;
    knxUltimateClient.write("0/1/1", payload, "1.001");

    // Send a color RED to an RGB datapoint
    payload = { red: 125, green: 0, blue: 0 };
    knxUltimateClient.write("0/1/2", payload, "232.600");

    // // Send a READ request to the KNX BUS
    knxUltimateClient.read("0/0/1");

    // Send a RESPONSE telegram to the KNX BUS
    // You need: group address, payload (true/false/or any message), datapoint as string
    payload = false;
    knxUltimateClient.respond("0/0/1", payload, "1.001");





}, 10000);

```

Why not to try Node-Red https://nodered.org and the awesome KNX-Ultimate node https://github.com/Supergiovane/KNXUltimate ?

<br/>
<br/>

![Logo](https://raw.githubusercontent.com/Supergiovane/node-red-contrib-knx-ultimate/master/img/wiki/flags/madeinitaly.png)

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg
[license-url]: https://github.com/Supergiovane/KNXUltimate/master/LICENSE
[npm-url]: https://npmjs.org/package/KNXUltimate
[npm-version-image]: https://img.shields.io/npm/v/KNXUltimate.svg
[npm-downloads-month-image]: https://img.shields.io/npm/dm/KNXUltimate.svg
[npm-downloads-total-image]: https://img.shields.io/npm/dt/KNXUltimate.svg
[youtube-image]: https://img.shields.io/badge/Visit%20me-Youtube-red
[youtube-url]: https://www.youtube.com/channel/UCA9RsLps1IthT7fDSeUbRZw/playlists