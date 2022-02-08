![Logo](img/logo-big.png)

<br/>

[![NPM version][npm-version-image]][npm-url]
[![NPM downloads per month][npm-downloads-month-image]][npm-url]
[![NPM downloads total][npm-downloads-total-image]][npm-url]
[![MIT License][license-image]][license-url]
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Youtube][youtube-image]][youtube-url]
[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square)](https://www.paypal.me/techtoday) 

<br/>

Control your KNX intallation via Node.js!

> This is the official engine of Node-Red node KNX-Ultimate (https://flows.nodered.org/node/node-red-contrib-knx-ultimate)
> I had many users asking for a node.js release of that engine, so here is it.
> The node will be KNX Secure compatible. I'm already working on that.

<br/>
<br/>

## CHANGELOG

* See <a href="https://github.com/Supergiovane/knxultimate/blob/master/CHANGELOG.md">here the changelog</a>

<br/>
<br/>

**Properties to be passed to the connection(see the knxUltimateClientProperties variable below)**

|Property|Description|
|--|--|
| ipAddr (string) | The IP of your KNX router/interface (for Routers, use "224.0.23.12") |
| ipPort (string) | The port, default is "3671" |
| physAddr (string) | The physical address to be identified in the KNX bus |
| suppress_ack_ldatareq (bool) | Avoid sending/receive the ACK telegram. Leave false. If you encounter issues with old interface, set it to true |
| loglevel (string) | The log level. "info", "error", "debug" or "trace" |
| localEchoInTunneling (bool) | Leave true forever. This is used only in Node-Red KNX-Ultimate node |
| hostProtocol (string) | "Multicast" if you're connecting to a KNX Router. "TunnelUDP" for KNX Interfaces, or "TunnelTCP" for secure KNX Interfaces (not yet implemented)|
| isSecureKNXEnabled (bool) | True: Enables the secure connection. Leave false until KNX-Secure has been released. |
| jKNXSecureKeyring (string) | ETS Keyring JSON file content (leave blank until KNX-Secure has been released) |
| localIPAddress (string) | The local IP address to be used to connect to the KNX/IP Bus. Leave blank, will be automatically filled by KNXUltimate |
| KNXEthInterface (string) | "Auto": Bind to the first avaiable local interfavce. "Manual": if you wish to specify the interface (for example eth1); in this case, set the property **interface** to the interface name (interface:"eth1") |
| interface (string) | Specifies the local eth interface to be used to connect to the KNX Bus. **Do not add** this parameter if you've set **KNXEthInterface** to "Auto"|

<br/>
<br/>

**Supported Datapoints**

Datapoints supporter are huge. Please run the **sample.js** file to view all datapoints in the console window.<br/>
For each Datapoint, there is a sample on how to format the payload (telegram) to be passed.<br/>
For example, pass a *true* for datapoint 1.001, or *{ red: 125, green: 0, blue: 0 }* for datapoijnt 232.600.<br/>

<br/>
<br/>

**Commands to be used to write to the KNX BUS**

See the examples also.

|Property|Description|
|--|--|
| .write (GA, payload, datapoint) | Sends a WRITE telegram to the BUS. **GA** is the group address (for example "0/0/1"), **payload** is the value you want to send (for example true), **datapoint** is a string representing the datapoint (for example "5.001") |
| .respond (GA, payload, datapoint) | Sends a RESPONSE telegram to the BUS. **GA** is the group address (for example "0/0/1"), **payload** is the value you want to send (for example true), **datapoint** is a string representing the datapoint (for example "5.001") |
| .read (GA) | Sends a READ telegram to the BUS. **GA** is the group address (for example "0/0/1").|



<br/>
<br/>


## Simple sample (you can find this sample in the "simpleSample.js" file):

```javascript
const knx = require("./index.js");

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


// Instantiate the client
const knxUltimateClient = new knx.KNXClient(knxUltimateClientProperties);

// Setting handlers
knxUltimateClient.on(knx.KNXClient.KNXClientEvents.indication, function (_datagram, _echoed) {

    // Traffic
    let _evt = "";
    if (_datagram.cEMIMessage.npdu.isGroupRead) _evt = "GroupValue_Read";
    if (_datagram.cEMIMessage.npdu.isGroupResponse) _evt = "GroupValue_Response";
    if (_datagram.cEMIMessage.npdu.isGroupWrite) _evt = "GroupValue_Write";
    console.log("src: " + _datagram.cEMIMessage.srcAddress.toString() + " dest: " + _datagram.cEMIMessage.dstAddress.toString(), " event: " + _evt);

});

// Connect
knxUltimateClient.Connect();

// WARNING, THIS WILL WRITE ON YOUR KNX BUS!
knxUltimateClient.write("0/1/1", false, "1.001");
```


<br/>
<br/>

## Full featured sample (you can find this sample in the "sample.js" file):

```javascript

const knx = require("./index.js");
const dptlib = require('./src/dptlib');

// Get a list of supported datapoints
// With this function, you can see what datapoints are supported and a sample on how you need to format the payload to be sent.
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
        return(jRet);
    }
    jRet = { "help": "No sample currently avaiable", "helplink": "https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-SamplesHome" };
    const dpts =
        Object.entries(dptlib)
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




// Let's connect and turn on your appliance.



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


console.log("WARNING: I'm about to write to your BUS in 10 seconds! Press Control+C to abort!")
console.log("WARNING: I'm about to write to your BUS in 10 seconds! Press Control+C to abort!")
console.log("WARNING: I'm about to write to your BUS in 10 seconds! Press Control+C to abort!")
console.log("WARNING: I'm about to write to your BUS in 10 seconds! Press Control+C to abort!")
console.log("WARNING: I'm about to write to your BUS in 10 seconds! Press Control+C to abort!")

// WRITE SOMETHING 
// WARNING, THIS WILL WRITE TO YOUR BUS !!!!
setTimeout(() => {

    // Check wether knxUltimateClient is clear to send the next telegram.
    // This should be called bevore any .write, .response, and .read request.
    // If not clear to send, retry later because the knxUltimateClient is busy in sending another telegram.
    console.log("Clear to send: " + knxUltimateClient._getClearToSend())

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