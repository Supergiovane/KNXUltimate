![Logo](img/logo-big.png)

[![CI](https://github.com/Supergiovane/KNXUltimate/actions/workflows/ci.yml/badge.svg)](https://github.com/Supergiovane/KNXUltimate/actions/workflows/ci.yml)
[![NPM version][npm-version-image]][npm-url]
[![NPM downloads per month][npm-downloads-month-image]][npm-url]
[![NPM downloads total][npm-downloads-total-image]][npm-url]
[![MIT License][license-image]][license-url]
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Youtube][youtube-image]][youtube-url]

Control your KNX intallation via Node.js!  

This is the official engine of Node-Red's node [node-red-contrib-knx-ultimate](https://flows.nodered.org/node/node-red-contrib-knx-ultimate)  

Many of you asked for a node.js release of that engine, so i decided to create this package.  

If you enjoy my work developing this package, do today a kind thing for someone too. This will be the reward for my work.  

<br/>

![Logo](img/readmemain.png)

## CHANGELOG

- [Changelog](https://github.com/Supergiovane/knxultimate/blob/master/CHANGELOG.md)

| Technology            | Supported                                                            |
| --------------------- | -------------------------------------------------------------------- |
| KNX Tunnelling        | ![](https://placehold.co/200x20/green/white?text=YES)                |
| KNX Routing           | ![](https://placehold.co/200x20/green/white?text=YES)                |
| KNX Secure Tunnelling | ![](https://placehold.co/200x20/green/white?text=YES) |
| KNX Secure Routing    | ![](https://placehold.co/200x20/orange/white?text=EVALUATING)                   |

## CONNECTION SETUP

These are the properties to be passed to the connection as a *JSON object {}* (see the knxUltimateClientProperties variable in the exsamples)

| Property                         | Description                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ipAddr (string)                  | The IP of your KNX router/interface (for Routers, use "224.0.23.12")                                 |
| hostProtocol (string)            | "Multicast" se ti connetti a un Router KNX. "TunnelUDP" per interfacce KNX. "TunnelTCP" per KNX/IP Secure (tunnel TCP con Secure Wrapper). |
| ipPort (string)                  | The port, default is "3671"                                                                          |
| physAddr (string)                | The physical address to be identified in the KNX bus                                                 |
| suppress_ack_ldatareq (bool)     | Avoid sending/receive the ACK telegram. Leave false. If you encounter issues with old interface, set it to true |
| loglevel (string)                | The log level 'disable', 'error', 'warn', 'info', 'debug'                                            |
| isSecureKNXEnabled (bool)        | Abilita KNX Secure. Valido solo con `hostProtocol: 'TunnelTCP'` (handshake di sessione + Secure Wrapper e Data Secure per GA presenti nel keyring). |
| secureTunnelConfig (object)      | Configurazione KNX Secure: `{ gatewayIp, gatewayPort, tunnelInterfaceIndividualAddress, knxkeys_file_path, knxkeys_password, debug }`. Usata per handshake e Data Secure. |
| localIPAddress (string)          | **Optional**. The local IP address to be used to connect to the KNX/IP Bus. Leave blank, will be automatically filled by KNXUltimate |
| interface (string)               | **Optional**. Specifies the local eth interface to be used to connect to the KNX Bus.                |
| KNXQueueSendIntervalMilliseconds | **Optional**. The KNX standard has a maximum transmit rate to the BUS, of about 1 telegram each 25ms (to stay safe). In case you've a lot of traffic on the BUS, you can increase this value, expressed in milliseconds. Be careful, because if you set it too high, the KNX engine could send a telegram with flag 'repeat', because the ACK from the device is coming too late. |
| theGatewayIsKNXVirtual (bool)               | **Optional**. Tells KNX Ultimate, that the gateway is a KNX Virtual ETS software. When set to *true*, it adds the **localIPAddress** to the tunnel_endpoint, in the datagram's tun section. Default is *false*. CAUTION: if set to *true*, connections to KNX/IP interfaces may not work properly. Use only for connecting to KNX Virtual            |

> Nota su KNX Secure: `KNXClient` integra ora KNX/IP Secure. Con `hostProtocol: 'TunnelTCP'` e `isSecureKNXEnabled: true` viene stabilita la sessione sicura (Secure Wrapper) e i GA inclusi nel keyring ETS vengono cifrati con Data Secure. I GA non presenti nel keyring restano plain.
## SUPPORTED DATAPOINTS

For each Datapoint, there is a sample on how to format the payload (telegram) to be passed.<br/>

For example, pass a *true* for datapoint "1.001", or *{ red: 125, green: 0, blue: 0 }* for datapoint "232.600".<br/>

It support a massive number of Datapoints. Please run the <code>examples/showDatapoints.ts</code> file to view all datapoints in the output console.<br/>

Be aware, that the descriptions you'll see, are taken from Node-Red KNX-Ultimate node, so there is more code than you need here. Please take only the *msg.payload* part in consideration.<br/>

You should see something like this in the console window (the **msg.payload** is what you need to pass as payload):

<img src='https://raw.githubusercontent.com/Supergiovane/knxultimate/master/img/dpt.png' width='60%'>

## METHODS/PROPERTIES OF KNXULTIMATE

| Method                             | Description                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| .Connect()                         | Connects to the KNX Gateway                                                                          |
| .Disconnect()                      | Gracefully disconnects from the KNX Gateway                                                          |
| .write (GA, payload, datapoint)    | Sends a WRITE telegram to the BUS. **GA** is the group address (for example "0/0/1"), **payload** is the value you want to send (for example true), **datapoint** is a string representing the datapoint (for example "5.001") |
| .writeRaw (GA, payload, datapoint) | Sends a WRITE telegram to the BUS. **GA** is the group address (for example "0/0/1"), **payload** is the buffer you want to send, **datapoint** is a string representing the datapoint (for example "5.001") |
| .respond (GA, payload, datapoint)  | Sends a RESPONSE telegram to the BUS. **GA** is the group address (for example "0/0/1"), **payload** is the value you want to send (for example true), **datapoint** is a string representing the datapoint (for example "5.001") |
| .read (GA)                         | Sends a READ telegram to the BUS. **GA** is the group address (for example "0/0/1").                 |
| . discover()                        | Sends a discover request on the KNX default multicast port and returns the results as an array. This is an async method. See the example in the **examples** folder |
| .getGatewayDescription()           | Sends a gateway description request. It works after an established connection. The async results will be sent to the *descriptionResponse* event. There is an example in the **examples** folder named **gatewaydescription.ts** . |

| Property       | Description                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| .isConnected() | Returns **true** if you the client is connected to the KNX Gateway Router/Interface, **false** if not connected. |
| .clearToSend   | **true** if you can send a telegram, **false** if the client is still waiting for the last telegram's ACK or whenever the client cannot temporary send the telegram. In tunneling mode, you could also refer to the event **KNXClientEvents.ackReceived**, that is fired everytime a telegram has been succesfully acknowledge or not acknowledge. See the sample.js file. |
| .channelID     | The actual Channel ID. Only defined after a successfull connection                                   |

## EVENTS

List of events raised by KNXultimate, in proper order. For the signatures, please see the **examples** folder.

| Event        | Description                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| connecting   | KNXUltimate is connecting to the KNX/IP Gateway. Please wait for the *connected* event to start sending KNX telegrams. |
| connected    | KNXUltimate has successfully connected with the KNX/IP Gateway.                                      |
| indication   | KNXUltimate has received a KNX telegram, that's avaiable in te the **datagram** variable. Please see the examples. |
| ackReceived  | Ack telegram from KNX/IP Gateway has been received. This confirms that the telegram sent by KNXUltimate has reached the KNX/IP Gateway successfully. |
| disconnected | The KNX connection has been disconnected.                                                            |
| close        | The main KNXUltimate socket has been closed.                                                         |
| error        | KNXUltimate has raised an error. The error description is provided as well.                         |
| descriptionResponse | Gather the *getGatewayDescription* responses. There is an example in the **examples** folder named **gatewaydescription.ts** . |

## LOG STREAM


KNXUltimate logging is managed by [Winston](https://github.com/winstonjs/winston) logger. In case you want to intercept library logs you can use our `logStram` exported from default entrypoint. Example:
```typescript
import { logStream } from 'knxultimate'  

logStream.on('data', (log) => {  
    // handle log  
    if(log.level === 'ERROR)  
        console.log(`${log.timestamp} ${log.message}`)  
}) 
```

| Field                          | Description                                                   |
| ------------------------------ | ------------------------------------------------------------- |
| timestamp                      | ISO formatted date (YYYY-MM-DD HH:mm:ss.SSS)                  |
| level                          | Log level in uppercase (ERROR, WARN, INFO, DEBUG)             |
| label                          | Module name in uppercase (specified when creating logger)      |
| message                        | Log message content                                           |
| stack                          | Error stack trace (only present for errors)                   |

### Log Levels

| Level                          | Description                                                   |
| ------------------------------ | ------------------------------------------------------------- |
| disable                        | No logging                                                    |
| error                          | Only logs errors                                             |
| warn                          | Logs errors and warnings                                      |
| info                          | Logs normal operations                                        |
| debug                         | Logs detailed information                                     |
| trace                         | Most verbose logging level                                    |

For a complete example of logging usage, see [logging.ts](./examples/logging.ts) in the examples folder.

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

- [sample](./examples/sample.ts) - A full featured example that shows how to connect to the KNX bus and send/receive telegrams. **WARNING** this sends data to your KNX BUS!
- [showDatapoints](./examples/showDatapoints.ts) - List all supported Datapoints in the output console, as well as the help code on how the payload's value is constructed, for each datapoint type. This writes nothing to the KNX BUS, you can run it safely.
- [simpleSample](./examples/simpleSample.ts) - A simple example that shows how to connect to the KNX bus and send a telegram. **WARNING** this sends data to your KNX BUS!
- [discovery](./examples/discovery.ts) - A simple example that shows how to discover KNX devices on the network.
- [test-toggle](./examples/test-toggle.ts) - An interactive example that shows how to toggle a switch on/off. **WARNING** this sends data to your KNX BUS!
- [logging](./examples/logging.ts) - Shows how to use the logging system and capture log messages.
- [gatewaydescription](./examples/gatewaydescription.ts) - Discover all gateways on your network and shows the details (name, mac address, etc...).

### KNX IP Secure (Data Secure)

`KNXClient` supporta KNX/IP Secure e Data Secure.

- Requisiti: gateway KNX Secure, keyring ETS (`.knxkeys`) e IA dell’interfaccia (come configurata in ETS).
- Data Secure: tutti i GA presenti nel keyring vengono cifrati end‑to‑end; i GA non presenti restano non cifrati.
– Modalità supportata: `TunnelTCP` + `isSecureKNXEnabled: true` → sessione sicura (Secure Wrapper) + Data Secure per GA del keyring.

Esempio veloce:

```ts
import KNXClient, { SecureConfig } from './src/KNXClient'

const secureCfg: SecureConfig = {
  gatewayIp: '192.168.1.4',
  gatewayPort: 3671,
  tunnelInterfaceIndividualAddress: '1.1.254',
  // knxkeys_file_path: '/path/to/project.knxkeys',
  // knxkeys_password: 'projectPassword',
  debug: true,
}

const client = new KNXClient({
  hostProtocol: 'TunnelTCP',
  isSecureKNXEnabled: true,
  secureTunnelConfig: secureCfg,
  physAddr: '1.1.200',
})

client.on('connected', () => console.log('Connected (secure)'))
client.on('error', (e) => console.error('Error:', e))

client.Connect()

// Scrive ON su 1/1/1; se 1/1/1 è nel keyring → Data Secure
client.write('1/1/1', true, '1.001')
```

<br/>

## HOW TO COLLABORATE

If you want to help us in this project, you're wellcome!  

Please refer to the development page.

- [Development's page](https://github.com/Supergiovane/knxultimate/blob/master/DEVELOPMENT.md)

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
