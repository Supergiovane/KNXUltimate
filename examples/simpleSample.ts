import { KNXClientEvents, KNXClient } from "../src";
import { resolve, fromBuffer } from "../src/dptlib";
import { KNXClientOptions } from "../src/KNXClient";

// Set the properties
let knxUltimateClientProperties: KNXClientOptions = {
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
};

// Instantiate the client
const knxUltimateClient = new KNXClient(knxUltimateClientProperties);

// Setting handlers
knxUltimateClient.on(KNXClientEvents.indication, function (_datagram, _echoed) {

    // This function is called whenever a KNX telegram arrives from BUS

    // Get the event
    let _evt = "";
    let dpt = "";
    let jsValue;
    if (_datagram.cEMIMessage.npdu.isGroupRead) _evt = "GroupValue_Read";
    if (_datagram.cEMIMessage.npdu.isGroupResponse) _evt = "GroupValue_Response";
    if (_datagram.cEMIMessage.npdu.isGroupWrite) _evt = "GroupValue_Write";
    // Get the source Address
    let _src = _datagram.cEMIMessage.srcAddress.toString();
    // Get the destination GA
    let _dst = _datagram.cEMIMessage.dstAddress.toString()
    // Get the RAW Value
    let _Rawvalue = _datagram.cEMIMessage.npdu.dataValue;

    // Decode the telegram. 
    if (_dst === "0/1/1") {
        // We know, for example, that 0/1/1 is a boolean DPT 1.001
        const config = resolve("1.001");
        jsValue = fromBuffer(_Rawvalue, config)
    } else if (_dst === "0/1/2") {
        // We know , for example, that 0/1/2 is a DPT 232.600 Color RGB
        const config = resolve("232.600");
        jsValue = fromBuffer(_Rawvalue, config)
    } else {
        // All others... assume they are boolean
        const config = resolve("1.001");
        jsValue = fromBuffer(_Rawvalue, config)
        if (jsValue === null) {
            // Opppsss, it's null. It means that the datapoint isn't 1.001
            // Raise whatever error you want.
        }
    }
    console.log("src: " + _src + " dest: " + _dst, " event: " + _evt, " value: " + jsValue);


});
knxUltimateClient.on(KNXClientEvents.connected, info => {
    // The client is connected
    console.log("Connected. On Duty", info);
    // WARNING, THIS WILL WRITE ON YOUR KNX BUS!
    knxUltimateClient.write("0/1/1", false, "1.001");
});

// Connect
try {
    knxUltimateClient.removeAllListeners();
} catch (error) {
}
knxUltimateClient.Connect();

