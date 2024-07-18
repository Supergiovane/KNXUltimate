![Logo](img/logo-big.png)

[![CI](https://github.com/Supergiovane/KNXUltimate/actions/workflows/ci.yml/badge.svg)](https://github.com/Supergiovane/KNXUltimate/actions/workflows/ci.yml)
[![NPM version][npm-version-image]][npm-url]
[![NPM downloads per month][npm-downloads-month-image]][npm-url]
[![NPM downloads total][npm-downloads-total-image]][npm-url]
[![MIT License][license-image]][license-url]
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Youtube][youtube-image]][youtube-url]
[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square)](https://www.paypal.me/techtoday)

Control your KNX intallation via Node.js!  
This is the official engine of Node-Red's node [node-red-contrib-knx-ultimate](https://flows.nodered.org/node/node-red-contrib-knx-ultimate)  
Many of you asked for a node.js release of that engine, so i decided to create this package.  
If you enjoy my work developing this package, do today a kind thing for someone too. This will be the reward for my work.  
<br/>


![Logo](img/readmemain.png)
  

## CHANGELOG

* [Changelog](https://github.com/Supergiovane/knxultimate/blob/master/CHANGELOG.md)


|Technology|Supported|
|--|--|
| KNX Tunnelling | ![](https://placehold.co/200x20/green/white?text=YES) |
| KNX Routing | ![](https://placehold.co/200x20/green/white?text=YES) |
| KNX Secure Tunnelling | ![](https://placehold.co/200x20/orange/white?text=UNDER+DEVELOPMENT) |
| KNX Secure Routing | ![](https://placehold.co/200x20/red/white?text=NO) |



## CONNECTION SETUP
These are the properties to be passed to the connection as a *JSON object {}* (see the knxUltimateClientProperties variable in the exsamples)

|Property|Description|
|--|--|
| ipAddr (string) | The IP of your KNX router/interface (for Routers, use "224.0.23.12") |
| hostProtocol (string) | "Multicast" if you're connecting to a KNX Router. "TunnelUDP" for KNX Interfaces, or "TunnelTCP" for secure KNX Interfaces (**KNX Secure is not yet implemented**)|
| ipPort (string) | The port, default is "3671" |
| physAddr (string) | The physical address to be identified in the KNX bus |
| suppress_ack_ldatareq (bool) | Avoid sending/receive the ACK telegram. Leave false. If you encounter issues with old interface, set it to true |
| loglevel (string) | The log level. "info", "error", "debug" or "trace" |
| localEchoInTunneling (bool) | Leave true forever. This is used only in Node-Red KNX-Ultimate node |
| isSecureKNXEnabled (bool) | True: Enables the secure connection. **Leave false until KNX-Secure has been released**. |
| jKNXSecureKeyring (string) | ETS Keyring JSON file content. **Leave blank until KNX-Secure has been released**. |
| localIPAddress (string) | The local IP address to be used to connect to the KNX/IP Bus. Leave blank, will be automatically filled by KNXUltimate |
| interface (string) | Specifies the local eth interface to be used to connect to the KNX Bus.|


## SUPPORTED DATAPOINTS

For each Datapoint, there is a sample on how to format the payload (telegram) to be passed.<br/>
For example, pass a *true* for datapoint "1.001", or *{ red: 125, green: 0, blue: 0 }* for datapoint "232.600".<br/>
It support a massive number of Datapoints. Please run the <code>examples/showDatapoints.ts</code> file to view all datapoints in the output console.<br/>
Be aware, that the descriptions you'll see, are taken from Node-Red KNX-Ultimate node, so there is more code than you need here. Please take only the *msg.payload* part in consideration.<br/>
You should see something like this in the console window (the **msg.payload** is what you need to pass as payload):

<img src='https://raw.githubusercontent.com/Supergiovane/knxultimate/master/img/dpt.png' width='60%'>

## METHODS/PROPERTIES OF KNXULTIMATE

|Method|Description|
|--|--|
| .Connect() | Connects to the KNX Gateway |
| .Disconnect() | Gracefully disconnects from the KNX Gateway |
| .write (GA, payload, datapoint) | Sends a WRITE telegram to the BUS. **GA** is the group address (for example "0/0/1"), **payload** is the value you want to send (for example true), **datapoint** is a string representing the datapoint (for example "5.001") |
| .writeRaw (GA, payload, datapoint) | Sends a WRITE telegram to the BUS. **GA** is the group address (for example "0/0/1"), **payload** is the buffer you want to send, **datapoint** is a string representing the datapoint (for example "5.001") |
| .respond (GA, payload, datapoint) | Sends a RESPONSE telegram to the BUS. **GA** is the group address (for example "0/0/1"), **payload** is the value you want to send (for example true), **datapoint** is a string representing the datapoint (for example "5.001") |
| .read (GA) | Sends a READ telegram to the BUS. **GA** is the group address (for example "0/0/1").|

|Property|Description|
|--|--|
| .isConnected() | Returns **true** if you the client is connected to the KNX Gateway Router/Interface, **false** if not connected. |
| .clearToSend | **true** if you can send a telegram, **false** if the client is still waiting for the last telegram's ACK or whenever the client cannot temporary send the telegram. In tunneling mode, you could also refer to the event **KNXClientEvents.ackReceived**, that is fired everytime a telegram has been succesfully acknowledge or not acknowledge. See the sample.js file. |
| .channelID | The actual Channel ID. Only defined after a successfull connection |

## EVENTS

List of events raised by KNXultimate, in proper order. For the signatures, please see the **examples** folder.
|Event|Description|
|--|--|
| connecting | KNXUltimate is connecting to the KNX/IP Gateway. Please wait for the *connected* event to start sending KNX telegrams.|
| connected | KNXUltimate has successfully connected with the KNX/IP Gateway. |
| indication | KNXUltimate has received a KNX telegram, that's avaiable in te the **datagram** variable. Please see the examples. |
| ackReceived | Ack telegram from KNX/IP Gateway has been received. This confirms that the telegram sent by KNXUltimate has reached the KNX/IP Gateway successfully. |
| disconnected | The KNX connection has been disconnected. |
| close | The main KNXUltimate socket has been closed. |
| error | KNXUltimate has raised an error. The error description is provided as well. |


## DECONDING THE TELEGRAMS FROM BUS

Decoding is very simple.
Just require the dptlib and use it to decode the RAW telegram

```javascript
import { dptlib } from "knxultimate";
let dpt = dptlib.resolve("1.001");
let jsValue = dptlib.fromBuffer(RAW VALUE (SEE SAMPLES), dpt); // THIS IS THE DECODED VALUE
```

## EXAMPLES

You can find all examples in the [examples](./examples/) folder:

* [sample](./examples/sample.ts) - A full featured example that shows how to connect to the KNX bus and send/receive telegrams. **WARNING** this sends data to your KNX BUS!
* [showDatapoints](./examples/showDatapoints.ts) - List all supported Datapoints in the output console, as well as the help code on how the payload's value is constructed, for each datapoint type. This writes nothing to the KNX BUS, you can run it safely.
* [simpleSample](./examples/simpleSample.ts) - A simple example that shows how to connect to the KNX bus and send a telegram. **WARNING** this sends data to your KNX BUS!
* [discovery](./examples/discovery.ts) - A simple example that shows how to discover KNX devices on the network.
* [test-toggle](./examples/test-toggle.ts) - An interactive example that shows how to toggle a switch on/off. **WARNING** this sends data to your KNX BUS!
* [sampleSecure](./examples/sampleSecure.ts) - A full featured example that shows how to connect to the KNX bus and send/receive telegrams in secure mode. **WARNING** this sends data to your KNX BUS!

  
<br/>

## HOW TO COLLABORATE

If you want to help us in this project, you're wellcome!  
Please refer to the development page.

* [Development's page](https://github.com/Supergiovane/knxultimate/blob/master/DEVELOPMENT.md)

<br/>

## SUGGESTION
>
> Why not to try Node-Red <https://nodered.org> and the awesome KNX-Ultimate node <https://flows.nodered.org/node/node-red-contrib-knx-ultimate> ?

<br/>

<img src='https://raw.githubusercontent.com/Supergiovane/knxultimate/master/img/nodered.png' width='90%'>

<br/>
<br/>

![Logo](https://raw.githubusercontent.com/Supergiovane/node-red-contrib-knx-ultimate/master/img/wiki/flags/madeinitaly.png)

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg
[license-url]: https://github.com/Supergiovane/knxultimate/master/LICENSE
[npm-url]: https://npmjs.org/package/knxultimate
[npm-version-image]: https://img.shields.io/npm/v/knxultimate.svg
[npm-downloads-month-image]: https://img.shields.io/npm/dm/knxultimate.svg
[npm-downloads-total-image]: https://img.shields.io/npm/dt/knxultimate.svg
[youtube-image]: https://img.shields.io/badge/Visit%20me-Youtube-red
[youtube-url]: https://www.youtube.com/channel/UCA9RsLps1IthT7fDSeUbRZw/playlists
