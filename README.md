![Logo](img/logo-big.png)

[![CI](https://github.com/Supergiovane/KNXUltimate/actions/workflows/ci.yml/badge.svg)](https://github.com/Supergiovane/KNXUltimate/actions/workflows/ci.yml)
[![NPM version][npm-version-image]][npm-url]
[![NPM downloads per month][npm-downloads-month-image]][npm-url]
[![NPM downloads total][npm-downloads-total-image]][npm-url]
[![MIT License][license-image]][license-url]
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Youtube][youtube-image]][youtube-url]

Control your KNX intallation via Node.js. It includes also KNX IP Secure and Data Secure!  

This is the official engine of Node-Red's node [node-red-contrib-knx-ultimate](https://flows.nodered.org/node/node-red-contrib-knx-ultimate)  

Many of you asked for a node.js release of that engine, so i decided to create this package.  

If you enjoy my work developing this package, do today a kind thing for someone too. This will be the reward for my work.  

<br/>

```bash
  npm i knxultimate
```


![Logo](img/readmemain.png)


<p align='center'>
<img width="110px" src="https://raw.githubusercontent.com/Supergiovane/KNXUltimate/master/img/KNX_CERTI_MARK_RGB.jpg" ></br></br></br>
<img width="100px" src="https://raw.githubusercontent.com/Supergiovane/KNXUltimate/master/img/knxsecure.png" ></br></br>
<span style="font-size:0.5em;color:grey;">Authorized KNX logo by KNX Association*</span>
</p>


## CHANGELOG

- [Changelog](https://github.com/Supergiovane/knxultimate/blob/master/CHANGELOG.md)

| Technology            | Supported                                                            |
| --------------------- | -------------------------------------------------------------------- |
| KNX Tunnelling (UDP)  | ![](https://placehold.co/200x20/green/white?text=YES)                |
| KNX Routing (Multicast) | ![](https://placehold.co/200x20/green/white?text=YES)              |
| KNX IP Secure/Data secure | ![](https://placehold.co/200x20/green/white?text=YES)         |


Please subscribe to my channel, to learn how to use it [![Youtube][youtube-image]][youtube-url]  

 [![Donate via PayPal](https://raw.githubusercontent.com/Supergiovane/node-red-contrib-knx-ultimate/master/img/CodiceQR.png)](https://www.paypal.com/donate/?hosted_button_id=S8SKPUBSPK758)

## CONNECTION SETUP

These are the properties you can pass to `KNXClient` (see examples for full usage):

| Property                         | Applies to                         | Description |
| -------------------------------- | ---------------------------------- | ----------- |
| `hostProtocol` (string)          | all                                | One of: `"TunnelUDP"` (plain tunnelling via UDP), `"Multicast"` (plain routing via multicast 224.0.23.12), `"TunnelTCP"` (KNX/IP Secure tunnelling over TCP). |
| `ipAddr` (string)                | all                                | KNX/IP peer address. Use `"224.0.23.12"` for routing (multicast), or the interface/router IP for tunnelling. |
| `ipPort` (number/string)         | all                                | KNX/IP port. Default `3671`. |
| `physAddr` (string) Optional             | all                                | Source IA on bus (e.g. `"1.1.200"`). Multicast: required. TunnelUDP: used as cEMI source. TunnelTCP (secure): ignored as bus source — the gateway assigns the tunnel IA; Data Secure uses the interface IA from ETS for authentication. |
| `loglevel` (string)              | all                                | One of: `disable`, `error`, `warn`, `info`, `debug`, `trace`. |
| `localIPAddress` (string)        | all                                | Optional. Binds the local UDP/TCP socket to a specific local interface IP. Useful with multiple NICs. |
| `interface` (string)             | all                                | Optional. Local interface name to select the NIC (alternative to `localIPAddress`). |
| `KNXQueueSendIntervalMilliseconds` (number) | all              | Optional. Inter‑telegram delay in ms. Default ~25ms. Don’t go below 20ms. |
| `suppress_ack_ldatareq` (bool)   | tunnelling (UDP/TCP)               | Optional. Avoid requesting/handling L_DATA_REQ bus ACK in tunnelling. Leave `false` unless your interface needs it. |
| `theGatewayIsKNXVirtual` (bool)  | tunnelling                         | Optional. Special handling for ETS KNX Virtual (adds `localIPAddress` to tunnel endpoint). Default `false`. |
| `isSecureKNXEnabled` (bool)      | secure tunnelling & secure routing | Enable KNX/IP Secure. With `TunnelTCP`: session handshake + Secure Wrapper. With `Multicast`: secure routing (Secure Wrapper, timer sync). |
| `secureTunnelConfig` (object)    | secure tunnelling & secure routing | KNX Secure configuration. See below. |
| `secureRoutingWaitForTimer` (bool)| secure routing (multicast)        | Optional. Wait for first timer sync (0955/0950) before sending. Default `true`. |

Secure configuration object (`secureTunnelConfig`):

| Field                                   | Description |
| --------------------------------------- | ----------- |
| `tunnelInterfaceIndividualAddress` (string) Optional| Interface IA as in ETS. TunnelTCP: if unset/empty the client auto‑selects a usable tunnel from the ETS keyring (tries in sequence until auth/connect succeed) and uses it. Multicast: not used. |
| `knxkeys_file_path` (string)            | Path to ETS keyring `.knxkeys` file. |
| `knxkeys_password` (string)             | ETS project password to decrypt the keyring. |
| `tunnelUserPassword` (string) Optional | Provide the KNX Secure tunnel password directly (no `.knxkeys`). Enables secure tunnelling only; Data Secure and secure routing stay disabled. |
| `tunnelUserId` (number) Optional        | KNX Secure tunnel user ID. Defaults to `2`. Useful when your gateway uses a custom account. |


Note on KNX Secure: `KNXClient` supports KNX/IP Secure for both tunnelling (TCP) and routing (multicast). Group Addresses found in the ETS keyring are protected with Data Secure; GA not in the keyring remain plain. With `tunnelUserPassword` alone you still get secure tunnelling, but Data Secure and secure multicast are unavailable.
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

## Plain KNX: Quick Examples

Below are short, progressively richer examples to connect in plain (non‑secure) KNX and listen or interact with the bus. Copy/paste inline; no extra files are created.

### 1) Minimal tunnelling (UDP) listener

```ts
import KNXClient from 'knxultimate'

const client = new KNXClient({
  hostProtocol: 'TunnelUDP',
  ipAddr: '192.168.1.117',  // your KNX/IP interface IP
  ipPort: 3671,
  loglevel: 'info',
})

client.on('connected', () => console.log('✓ Plain tunnelling connected'))
client.on('error', (e) => console.error('Error:', e.message))
client.on('disconnected', (reason) => console.log('Disconnected:', reason))

client.on('indication', (packet) => {
  const cemi = packet?.cEMIMessage
  if (!cemi) return
  const src = cemi.srcAddress?.toString?.()
  const dst = cemi.dstAddress?.toString?.()
  const isWrite = cemi.npdu?.isGroupWrite
  const isResp = cemi.npdu?.isGroupResponse
  const raw: Buffer | undefined = cemi.npdu?.dataValue
  console.log('indication', { src, dst, isWrite, isResp, raw: raw?.toString('hex') })
})

client.Connect()
```

### 2) Decode a boolean datapoint (1.001)

```ts
import KNXClient, { KNXClientEvents } from 'knxultimate'
import { dptlib } from 'knxultimate'

const client = new KNXClient({ hostProtocol: 'TunnelUDP', ipAddr: '192.168.1.117', ipPort: 3671 })

client.on(KNXClientEvents.indication, (packet) => {
  const cemi = packet?.cEMIMessage
  if (!cemi?.npdu) return
  const dst = cemi.dstAddress?.toString?.()
  const raw: Buffer | undefined = cemi.npdu?.dataValue
  if (!dst || !raw) return
  if (dst === '0/1/25') { // for example: a status GA known to be 1.001
    const cfg = dptlib.resolve('1.001')
    const value = dptlib.fromBuffer(raw, cfg)
    console.log(`dst=${dst} ->`, value)
  }
})

client.Connect()
```

### 3) Plain routing (Multicast) listener

```ts
import KNXClient from 'knxultimate'

const client = new KNXClient({
  hostProtocol: 'Multicast',
  ipAddr: '224.0.23.12',
  ipPort: 3671,
  physAddr: '1.1.200',   // set your device IA for routing
  loglevel: 'info',
})

client.on('connected', () => console.log('✓ Plain multicast ready'))
client.on('error', (e) => console.error('Error:', e.message))
client.on('indication', (packet) => {
  const cemi = packet?.cEMIMessage
  if (!cemi?.npdu) return
  const dst = cemi.dstAddress?.toString?.()
  const raw: Buffer | undefined = cemi.npdu?.dataValue
  console.log('routing ind', { dst, raw: raw?.toString('hex') })
})

client.Connect()
```

### 4) Write and then READ a status (plain)

```ts
import KNXClient from 'knxultimate'
import { dptlib } from 'knxultimate'

const client = new KNXClient({ hostProtocol: 'TunnelUDP', ipAddr: '192.168.1.117', ipPort: 3671 })

function waitForStatus(ga: string, timeoutMs = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { client.off('indication', onInd); reject(new Error('Timeout')) }, timeoutMs)
    const onInd = (packet: any) => {
      const cemi = packet?.cEMIMessage
      if (!cemi || cemi.dstAddress?.toString?.() !== ga) return
      const npdu = cemi.npdu
      if (!(npdu?.isGroupResponse || npdu?.isGroupWrite)) return
      const raw: Buffer = npdu?.dataValue ?? Buffer.alloc(1, 0)
      const bit = (raw.readUInt8(0) ?? 0) & 0x01
      clearTimeout(t)
      client.off('indication', onInd)
      resolve(bit)
    }
    client.on('indication', onInd)
  })
}

async function main() {
  client.Connect()
  await new Promise<void>((res) => client.once('connected', () => res()))
  // Write ON	n
  client.write('0/1/1', true, '1.001')
  // Read status
  client.read('0/1/25')
  const val = await waitForStatus('0/1/25', 3000)
  console.log('Status:', val ? 'ON' : 'OFF')
}

main().catch(console.error)
```

## KNX/IP Secure: Quick Examples

Below are progressively richer examples to connect to a KNX/IP Secure gateway and listen for telegrams with decrypted payloads. These are meant to be copy‑pasted inline (no files are added under `examples/`). All snippets assume TypeScript/Node 18+.

Important notes
- The client emits the full datagram on `indication`, and its `cEMIMessage` is already plain (decrypted) when keys are available in your ETS keyring.
- Never commit your `.knxkeys` file. Keep its path/password in environment variables or local config.
- Secure TCP tunnel auto‑select: if `secureTunnelConfig.tunnelInterfaceIndividualAddress` is omitted or empty, the client tries all interfaces found in the ETS keyring until authentication and connect succeed, then proceeds and keeps the tunnel open. The chosen IA is exposed on `client._options.secureTunnelConfig.tunnelInterfaceIndividualAddress` after connect.

### 1) Minimal secure tunnelling (TCP) listener

```ts
import KNXClient, { SecureConfig } from 'knxultimate'

// 1) Configure ETS keyring + the interface IA used in your project
const secureCfg: SecureConfig = {
  // tunnelInterfaceIndividualAddress: '1.1.254',   // Optional: omit to auto‑select a free tunnel
  knxkeys_file_path: process.env.KNX_KEYS_PATH || '/path/to/Project.knxkeys',
  knxkeys_password: process.env.KNX_KEYS_PASSWORD || 'your-ets-password',
}

// 2) Create a KNX/IP Secure TCP client
const client = new KNXClient({
  hostProtocol: 'TunnelTCP',
  ipAddr: '192.168.1.4',
  ipPort: 3671,
  isSecureKNXEnabled: true,
  secureTunnelConfig: secureCfg,
  loglevel: 'info',
})

client.on('connected', () => console.log('✓ Secure tunnel connected'))
client.on('error', (e) => console.error('Error:', e.message))
client.on('disconnected', (reason) => console.log('Disconnected:', reason))

// 3) Listen: cEMI payload is already decrypted when Data Secure is used
client.on('indication', (packet) => {
  const cemi = packet?.cEMIMessage
  if (!cemi) return
  const dst = cemi.dstAddress?.toString?.()
  const src = cemi.srcAddress?.toString?.()
  const isWrite = cemi.npdu?.isGroupWrite
  const isResp = cemi.npdu?.isGroupResponse
  const raw: Buffer | undefined = cemi.npdu?.dataValue
  console.log('indication', { src, dst, isWrite, isResp, raw: raw?.toString('hex') })
})

async function main() {
  client.Connect()
  await new Promise<void>((res) => client.once('connected', () => res()))
  console.log('Listening… Press Ctrl+C to exit')
}

main().catch(console.error)
```

### 1b) Secure tunnelling with only tunnel password

When you do not have access to the ETS keyring you can still negotiate KNX/IP Secure by providing the tunnel IA and password directly. This gives you encrypted tunnelling, while Data Secure and secure multicast stay disabled. The user ID defaults to `2`, which is the standard KNX Secure tunnel account.

```ts
import KNXClient, { SecureConfig } from 'knxultimate'

const tunnelPassword = process.env.KNX_TUNNEL_PASSWORD
if (!tunnelPassword) {
  throw new Error('Set KNX_TUNNEL_PASSWORD with your secure tunnel password')
}

const secureCfg: SecureConfig = {
  tunnelInterfaceIndividualAddress: '1.1.254',
  tunnelUserPassword: tunnelPassword,
  tunnelUserId: 2, // Replace with your tunnel user ID from ETS (number or numeric string)
}

const client = new KNXClient({
  hostProtocol: 'TunnelTCP',
  ipAddr: '192.168.1.4',
  ipPort: 3671,
  isSecureKNXEnabled: true,
  secureTunnelConfig: secureCfg,
})

client.on('connected', () => console.log('✓ Secure tunnel connected (manual password)'))
client.on('error', (e) => console.error('Error:', e.message))

client.Connect()
```

> **Note:** ETS assigns a dedicated `tunnelUserId` to each secure tunnel. Set `secureTunnelConfig.tunnelUserId` (number or numeric string) together with the password, otherwise the gateway replies with `Secure Session Status = 1` and the connection is closed.

### Secure workflow recap

- **KNX IP Tunnelling Secure** protects the TCP channel. The gateway authenticates a tunnel user by ID + password during the `Secure Session Authenticate (0x0953)` step. Provide the password either from the keyring (`secureTunnelConfig.knxkeys_*`) or manually via `secureTunnelConfig.tunnelUserPassword`; in both cases the `tunnelUserId` must match the ETS commissioning data.
- **KNX Data Secure** protects group-address telegrams. It relies on group keys stored in the ETS keyring, so a `.knxkeys` file plus its password are mandatory whenever you need encrypted group communication.
- **Supported combinations**
  - *Keyring only*: set `knxkeys_file_path`/`knxkeys_password` and omit `tunnelUserPassword`. Both the tunnel password and the group keys are loaded from the keyring.
- *Manual tunnel password only*: set both `tunnelUserPassword` and `tunnelUserId` without a keyring. The IP channel is secured, but Data Secure stays disabled because no group keys are present.
  - *Keyring + manual password*: provide the keyring for Data Secure and override the tunnelling password with `tunnelUserPassword` (useful when the ETS export does not include the tunnel password). Ensure `knxkeys_*` and `tunnelUserPassword` are both configured.
- To retrieve the tunnel user ID/password pair, open the secure tunnelling interface in ETS (or inspect the `.knxkeys` entry). Default ETS IDs are typically small integers (e.g. `2`, `3`, …) but may differ per installation.

### 2) Decode datapoints (boolean 1.001) from decrypted payloads

```ts
import KNXClient, { SecureConfig } from 'knxultimate'
import { dptlib } from 'knxultimate'

const secureCfg: SecureConfig = {
  // tunnelInterfaceIndividualAddress: '1.1.254',   // Optional (auto‑select if omitted)
  knxkeys_file_path: process.env.KNX_KEYS_PATH || '/path/to/Project.knxkeys',
  knxkeys_password: process.env.KNX_KEYS_PASSWORD || 'your-ets-password',
}

const client = new KNXClient({
  hostProtocol: 'TunnelTCP',
  ipAddr: '192.168.1.4',
  ipPort: 3671,
  isSecureKNXEnabled: true,
  secureTunnelConfig: secureCfg,
  loglevel: 'info',
})

client.on('indication', (packet) => {
  const cemi = packet?.cEMIMessage
  if (!cemi?.npdu) return
  const dst = cemi.dstAddress?.toString?.()
  const raw: Buffer | undefined = cemi.npdu?.dataValue
  if (!dst || !raw) return

  // Example: decode boolean status for GA 1/1/2 as DPT 1.001
  if (dst === '1/1/2') {
    const cfg = dptlib.resolve('1.001')
    const value = dptlib.fromBuffer(raw, cfg)
    console.log(`dst=${dst} ->`, value)
  }
})

client.Connect()
```

### 3) Secure routing (multicast) listener

For routers supporting KNX Secure routing (multicast 224.0.23.12). The ETS keyring must include the Backbone key; the client will automatically use it to decrypt SecureWrapper frames and present decrypted cEMI payloads.

```ts
import KNXClient, { SecureConfig } from 'knxultimate'

const secureCfg: SecureConfig = {
  knxkeys_file_path: process.env.KNX_KEYS_PATH || '/path/to/Project.knxkeys',
  knxkeys_password: process.env.KNX_KEYS_PASSWORD || 'your-ets-password',
}

const client = new KNXClient({
  hostProtocol: 'Multicast',
  ipAddr: '224.0.23.12',
  ipPort: 3671,
  physAddr: '1.1.250',   // your device IA used as source on bus
  isSecureKNXEnabled: true,
  secureTunnelConfig: secureCfg,
  loglevel: 'info',
})

client.on('connected', () => console.log('✓ Secure multicast ready'))
client.on('error', (e) => console.error('Error:', e.message))
client.on('indication', (packet) => {
  const cemi = packet?.cEMIMessage
  if (!cemi?.npdu) return
  const dst = cemi.dstAddress?.toString?.()
  const raw: Buffer | undefined = cemi.npdu?.dataValue
  console.log('routing ind', { dst, raw: raw?.toString('hex') })
})

client.Connect()
```

### 4) Send a READ and get a decrypted status

```ts
import KNXClient, { SecureConfig } from 'knxultimate'
import { dptlib } from 'knxultimate'

const secureCfg: SecureConfig = {
  tunnelInterfaceIndividualAddress: '1.1.254',
  knxkeys_file_path: process.env.KNX_KEYS_PATH || '/path/to/Project.knxkeys',
  knxkeys_password: process.env.KNX_KEYS_PASSWORD || 'your-ets-password',
}

const client = new KNXClient({
  hostProtocol: 'TunnelTCP',
  ipAddr: '192.168.1.4',
  ipPort: 3671,
  isSecureKNXEnabled: true,
  secureTunnelConfig: secureCfg,
})

function waitForStatus(ga: string, timeoutMs = 5000): Promise<number> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      client.off('indication', onInd)
      reject(new Error('Timeout waiting for status'))
    }, timeoutMs)
    const onInd = (packet: any) => {
      const cemi = packet?.cEMIMessage
      if (!cemi || cemi.dstAddress?.toString?.() !== ga) return
      const npdu = cemi.npdu
      const isResp = npdu?.isGroupResponse
      const isWrite = npdu?.isGroupWrite
      if (!(isResp || isWrite)) return
      const raw: Buffer = npdu?.dataValue ?? Buffer.alloc(1, 0)
      const bit = (raw.readUInt8(0) ?? 0) & 0x01
      clearTimeout(t)
      client.off('indication', onInd)
      resolve(bit)
    }
    client.on('indication', onInd)
  })
}

async function main() {
  client.Connect()
  await new Promise<void>((res) => client.once('connected', () => res()))
  // Example: query a status GA and decode as boolean 1.001
  const statusGA = '1/1/2'
  client.read(statusGA)
  const val = await waitForStatus(statusGA, 5000)
  console.log(`Status on ${statusGA}:`, val ? 'ON' : 'OFF')
}

main().catch(console.error)
```

Tips
- For tunnelling (TCP), the source IA is assigned by the gateway. For routing (multicast), set `physAddr` in options.
- If you see decrypted payloads as null, verify that the GA has a Data Secure key in your `.knxkeys` and that the ETS keyring and password are correct.
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

All examples live in the [examples](./examples/) folder. You can run them directly with TypeScript via esbuild-register (no build step needed).

- Generic command: `node -r esbuild-register -e "require('./examples/<file>.ts')"`
- For secure samples, npm scripts are available:
  - `npm run example:secure:tunnel` (secure tunnelling TCP)
  - `npm run example:secure:multicast` (secure routing multicast)

Examples overview:

- **Recommended starting point → [template](./examples/template.ts):** well-commented skeleton showing how to configure plain vs secure connections, wire up core events, and encode/decode datapoint payloads. Use this file as a base for new scripts.

- [sample](./examples/sample.ts): Full walkthrough — connect, read/write, decode values. Warning: sends telegrams to your KNX BUS.
- [simpleSample](./examples/simpleSample.ts): Minimal connect + single write. Warning: sends telegrams.
- [test-toggle](./examples/test-toggle.ts): Interactive ON/OFF toggle from CLI. Warning: sends telegrams.
- [disconnection](./examples/disconnection.ts): Demonstrates clean disconnects and error handling.
- [logging](./examples/logging.ts): Shows how to attach to the log stream and change log levels.
- [monitorBusMinimal](./examples/monitorBusMinimal.ts): Minimal listener that connects and prints incoming telegrams. Warning: connects to the bus but does not send telegrams.
- [showDatapoints](./examples/showDatapoints.ts): Lists supported datapoints and shows how payloads are built. Safe: does not send to the bus.
- [datapointBasics](./examples/datapointBasics.ts): Demonstrates encoding and decoding a few datapoint values locally. Safe.
- [discovery](./examples/discovery.ts): Discovers KNX/IP interfaces/routers (SEARCH_REQUEST). Safe.
- [discoverInterfacesSimple](./examples/discoverInterfacesSimple.ts): Uses `discoverInterfaces()` to print a concise summary of each gateway. Safe.
- [gatewaydescription](./examples/gatewaydescription.ts): Requests and prints extended gateway information. Safe.
- [samplePlainTunnelUPD](./examples/samplePlainTunnelUPD.ts): Plain KNX/IP tunnelling over UDP (`hostProtocol: 'TunnelUDP'`). ON/OFF + status read via a KNX interface.
  - Run: `node -r esbuild-register -e "require('./examples/samplePlainTunnelUPD.ts')"`
- [samplePlainMulticast](./examples/samplePlainMulticast.ts): Plain KNX routing over multicast (`hostProtocol: 'Multicast'`). Uses RoutingIndication with cEMI L_DATA_REQ. ON/OFF + status read via a KNX router (no secure).
  - Run: `node -r esbuild-register -e "require('./examples/samplePlainMulticast.ts')"`
- [sampleSecureTunnelTCP](./examples/sampleSecureTunnelTCP.ts): KNX/IP Secure tunnelling over TCP (`hostProtocol: 'TunnelTCP'` + `isSecureKNXEnabled: true`). Performs session handshake + Secure Wrapper. Applies Data Secure for GA present in the ETS keyring. ON/OFF + status read.
  - Requires: set `.knxkeys` path + password in the example file. Optionally omit `tunnelInterfaceIndividualAddress` to auto‑select a free tunnel from the keyring.
  - Run: `npm run example:secure:tunnel` or `node -r esbuild-register -e "require('./examples/sampleSecureTunnelTCP.ts')"`
- [sampleSecureTunnelTCPNoDataSecure](./examples/sampleSecureTunnelTCPNoDataSecure.ts): KNX/IP Secure tunnelling over TCP using only the manual tunnel password/ID (no keyring, Data Secure disabled). Demonstrates secure channel establishment when group keys are unavailable.
  - Configure: set `tunnelInterfaceIndividualAddress`, `tunnelUserPassword`, and `tunnelUserId` in the file.
  - Run: `node -r esbuild-register -e "require('./examples/sampleSecureTunnelTCPNoDataSecure.ts')"`
- [sampleSecureMulticast](./examples/sampleSecureMulticast.ts): KNX/IP Secure routing over multicast (`hostProtocol: 'Multicast'` + `isSecureKNXEnabled: true`). Synchronizes timer via 0x0955, wraps frames in Secure Wrapper, and applies Data Secure per GA. ON/OFF + status read.
  - Requires: set `.knxkeys` path + password in the example file.
  - Run: `npm run example:secure:multicast` or `node -r esbuild-register -e "require('./examples/sampleSecureMulticast.ts')"`
- [dumpKeyringCredentials](./examples/dumpKeyringCredentials.ts): Loads a `.knxkeys` file, decrypts all stored tunnel passwords, authentication codes, device credentials, group keys, and backbone keys, and prints them to the console. Safe.
  - Run: `node -r esbuild-register -e "require('./examples/dumpKeyringCredentials.ts')" [path/to/keyring.knxkeys] [ets-password]`

### Discovery details

- Functions: `KNXClient.discover()`, `KNXClient.discoverDetailed()`, `KNXClient.discoverInterfaces()`.
- Default port: if a KNX interface does not advertise a port in the `SEARCH_RESPONSE` HPAI (missing or zero), discovery uses `3671` as the port.
- Return formats:
- `discover()` → strings formatted as `ip:port:name:ia:Security:Transport`; highlights whether the result is plain/secure and which transport to use.
  - Example: `192.168.1.4:3671:MyGW:1.1.1:Secure KNX:TCP`, `224.0.23.12:3671:MyRouter:1.1.0:Plain KNX:Multicast`.
- `discoverDetailed()` → strings formatted as `ip:port:name:ia:service1,service2:type`; focuses on human-readable service families (`routing`, `tunnelling`, etc.) and whether the entry corresponds to tunnelling or routing.
- `discoverInterfaces()` → array of objects `{ ip, port, name, ia, services, type, transport }`, giving parsed fields and an inferred transport, with `services` exposed as an array of service names.

Example usage
```ts
import KNXClient from 'knxultimate'

// Simple list with security + transport
const list = await KNXClient.discover(5000)
for (const entry of list) {
  const [ip, port, name, ia, security, transport] = entry.split(':')
  console.log({ ip, port, name, ia, security, transport })
}

// Detailed strings
const detailed = await KNXClient.discoverDetailed(5000)
// ip:port:name:ia:service1,service2:type

// Structured objects
const objects = await KNXClient.discoverInterfaces(5000)
// [{ ip, port, name, ia, services, type, transport }, ...]
```

### Source Individual Address (IA): UDP vs TCP

- TunnelUDP: uses `physAddr` as the source IA on the bus.
- TunnelTCP (secure): after a successful connect, uses the tunnel-assigned IA as the cEMI source on the bus; the Data Secure authentication, however, uses the interface IA from the ETS keyring (not the dynamic tunnel IA).
- Tips for UDP tunnelling:
  - If your interface times out on L_DATA_REQ ACK, try `suppress_ack_ldatareq: true`.
  - With multiple NICs, set `localIPAddress` (or `interface`) to bind the correct local interface.

### KNX IP Secure (tunnelling & routing) and Data Secure

`KNXClient` supports KNX/IP Secure and Data Secure.

- Requirements: KNX Secure router/interface and ETS keyring (`.knxkeys`). For `TunnelTCP`, the interface IA is optional — if omitted, the client auto‑selects a usable tunnel from the keyring.
- Data Secure: Group Addresses present in the keyring are encrypted end‑to‑end; GA not present remain plain.
- Modes:
  - `TunnelTCP` + `isSecureKNXEnabled: true` → secure session (Secure Wrapper) + Data Secure per GA.
  - `Multicast` + `isSecureKNXEnabled: true` → secure routing (Secure Wrapper over multicast with timer synchronization via 0x0955) + Data Secure per GA.

Routing (Multicast) specifics
- Outgoing frames are injected as `L_DATA_IND` when using routing (both plain and secure). This mirrors ETS and xKNX behavior and ensures devices react correctly to injected telegrams. Do not use `L_DATA_REQ` for routing injection.
- Secure routing needs a synchronized timer. By default the client waits until the timer is authenticated before sending. Additionally, on secure multicast startup the client proactively sends a `TimerNotify (0x0955)` once, so the timer can authenticate immediately even if the router doesn’t broadcast it right away. Plain multicast is unaffected.
- Option: `secureRoutingWaitForTimer` (default `true`) controls gating of outgoing frames until the timer is authenticated.

Authorized senders (Data Secure, secure routing)
- When sending to a Data Secure Group Address over routing, KNX routers enforce an “authorized senders” list per GA. If your current `physAddr` is not authorized for that GA, the router will drop the telegram.
- The client automatically avoids this problem by selecting an allowed sender IA for each secure GA based on the ETS keyring. If the configured `physAddr` is not in the GA’s Senders list, the library overrides the source IA with one that is authorized for that GA (taken from the keyring’s Senders for that GA) before building the Secure APDU.
- Prerequisites: your `.knxkeys` (ETS Project Keyring) must include the target GA and its Senders list. If no Senders are present for that GA in the keyring, the client keeps `physAddr` and the router may still drop the frame as unauthorized.
- This behavior is automatic whenever `hostProtocol: 'Multicast'` and `isSecureKNXEnabled: true` and the GA is protected by a Data Secure key in the keyring. No additional option is required.

Mixed secure/plain on one instance
- A single `KNXClient` instance can handle Data Secure and plain Group Addresses at the same time. Data Secure is applied per‑GA: if a GA has a key in the ETS keyring, the APDU is encrypted; if not, the APDU stays plain.
- Secure routing (multicast): when `isSecureKNXEnabled: true`, all routing frames are transported inside the KNX/IP Secure Wrapper (`0x0950`). “Plain” APDUs still travel inside that wrapper. This allows mixing secure and plain GA on the same instance. If you also need to emit non‑wrapped plain routing frames simultaneously, run a second `KNXClient` with `isSecureKNXEnabled: false`.
- Secure tunnelling (TCP): the tunnel is always wrapped (Secure Wrapper). APDU encryption (Data Secure) remains per‑GA; GA without keys remain plain.
- Receive path: with secure enabled, the client decrypts `0x0950` frames and forwards the inner plain cEMI; it also accepts non‑wrapped routing frames if present on the bus. The `indication` event always exposes a plain (decrypted) cEMI when keys are available.

Troubleshooting (routing)
- If an actuator doesn’t react to writes sent over routing, verify that your app injects `L_DATA_IND` (not `L_DATA_REQ`). From version 5.0.0‑beta the library automatically uses `L_DATA_IND` for multicast writes/reads/responses.
- For secure routing, ensure your ETS keyring contains a Backbone key and that the target Group Addresses are present with keys (Data Secure). You can list them with the example `examples/listSecureGroups.ts`.

Behavior when fields are unset
- secureTunnelConfig.tunnelInterfaceIndividualAddress (TunnelTCP): if omitted/empty, the client auto‑selects a tunnel from the ETS keyring and retries interfaces until authentication and connect succeed. The chosen IA is exposed runtime in `client._options.secureTunnelConfig.tunnelInterfaceIndividualAddress` after connect.
- physAddr:
  - Multicast: must be provided; it’s your node’s source IA on the bus.
  - TunnelUDP: optional; used as cEMI source if set.
  - TunnelTCP: optional and ignored for the bus source (gateway provides the tunnel IA); Data Secure signs as the interface IA from the keyring.

Secure TCP auto‑selection details
- IA selection: the client runs discovery for `ipAddr:ipPort`, reads the gateway “Host” IA, and selects keyring interfaces whose `Host` matches it. Candidates are sorted descending (e.g. …255, …254, …253). If no match by `Host`, it falls back to all keyring interfaces of type `Tunneling`.
- Single‑NIC discovery: when `options.interface` is empty/undefined, discovery is executed only on the local NIC that shares the same subnet of `ipAddr` (no scan across all OS interfaces).
- Timeouts: detailed discovery runs ~3s on the chosen NIC; if nothing is found, a lightweight simple discovery runs ~5s on the same NIC and is adapted to the detailed format.
- Logging: look for lines starting with “Secure TCP:” to follow selection steps (discovered Host IA, candidates, chosen IA).
- Override: set `secureTunnelConfig.tunnelInterfaceIndividualAddress` and/or `interface` explicitly to skip the auto‑selection.



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
