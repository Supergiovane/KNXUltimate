import dpts, { fromBuffer, resolve } from "../src/dptlib";
import { KNXClient, KNXClientEvents } from "../src/KNXClient";
import KNXAddress from "../src/protocol/KNXAddress";
import KNXDataBuffer from "../src/protocol/KNXDataBuffer";

// Create tunnel socket with source knx address 1.1.100
const optionsDefaults: {
  physAddr: string;
  connectionKeepAliveTimeout: number;
  ipAddr: string;
  hostProtocol: string;
  isSecureKNXEnabled: boolean;
  ipPort: number;
  suppress_ack_ldatareq: boolean;
  loglevel: string;
  localEchoInTunneling: boolean;
  interface: string;
} = {
  physAddr: "15.15.21",
  connectionKeepAliveTimeout: 60,
  ipAddr: "192.168.1.15",
  hostProtocol: "TunnelUDP",
  isSecureKNXEnabled: false,
  ipPort: 3671,
  suppress_ack_ldatareq: false,
  loglevel: "info",
  localEchoInTunneling: true,
  interface: "",
};
const knxClient: KNXClient = new KNXClient(optionsDefaults);

knxClient.on(KNXClientEvents.error, (err: any) => {
  console.log("BANANA ERRORE", err);
});

// Call discoverCB when a knx gateway has been discovered.
knxClient.on(KNXClientEvents.discover, (info: string) => {
  const [ip, port] = info.split(":");
  discoverCB(ip, port);
});

knxClient.on(KNXClientEvents.disconnected, (info: any) => {
  console.log("BANANA DISCONNESSO", info);
});

knxClient.on(KNXClientEvents.close, (info: any) => {
  console.log("BANANA CHIUSO", info);
});

knxClient.on(KNXClientEvents.connected, (info: any) => {
  console.log("CONNESSO CON CHANNEL ID ", knxClient.channelID);
});

knxClient.on(KNXClientEvents.connecting, (info: any) => {
  console.log("CONNECTING ", info);
});

const wait = (t: number = 3000): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, t);
  });
};

const handleBusEvent = function (
  _datagram: any,
  _echoed: any,
  rawCEMISocketMessage: any
) {
  try {
    var dpt = resolve("DPT1.001");
    var jsvalue = fromBuffer(_datagram.cEMIMessage.npdu.dataValue, dpt);
  } catch (error) {
    console.log(error);
  }

  let sType = "";
  if (_datagram.cEMIMessage.npdu.isGroupRead) sType = "GroupValue_Read";
  if (_datagram.cEMIMessage.npdu.isGroupResponse) sType = "GroupValue_Response";
  if (_datagram.cEMIMessage.npdu.isGroupWrite) sType = "GroupValue_Write";

  let srcAddress = _datagram.cEMIMessage.srcAddress.toString();
  let dstAddress = _datagram.cEMIMessage.dstAddress.toString();

  let isRepeated = _datagram.cEMIMessage.control.repeat === 1 ? false : true;

  let cemiETS = "";

  if (rawCEMISocketMessage !== undefined) {
    try {
      var iStart = _datagram._header._headerLength + 4;
      cemiETS = rawCEMISocketMessage.toString("hex").substring(iStart * 2);
    } catch (error) {
      cemiETS = "";
    }
  }

  console.log(
    "BANANA",
    srcAddress,
    dstAddress,
    jsvalue,
    "Echoed",
    _echoed,
    "Type",
    sType,
    "Repeat",
    isRepeated,
    "cemiETS",
    cemiETS
  );
};

try {
  console.log("INIZIO CONNESSIONE");
  knxClient.Connect();
} catch (error) {
  console.log("ERRORE CONNESSIONE", error);
  process.exit(1)
}

knxClient.on(KNXClientEvents.indication, handleBusEvent);

setTimeout(() => {
  try {
    console.log("ACCENDEO");
    knxClient.write("0/1/1", true, "DPT1.001");
  } catch (error) {
    console.log("ORRORE", error);
  }
}, 5000);

setTimeout(() => {
  let writeraw = Buffer.from("01", "hex");
  let bitlenght = 1;

  try {
    console.log("RAWEO", writeraw);
    knxClient.writeRaw("0/1/1", writeraw, bitlenght);
  } catch (error) {
    console.log("ORRORE", error);
  }
}, 8000);

setTimeout(() => {
  console.log("DISCONNETTO");
  knxClient.Disconnect();
}, 10000);

setTimeout(() => {
  console.log("CONNETTO");
  knxClient.Connect();
}, 12000);

const discoverCB = (ip: string, port: string) => {
  // console.log("Connecting to ", ip, port);
  // // Connect to the knx gateway on ip:port
  // knxClient.connectAsync(ip, port)
  //     .then(() => {
  //         console.log("Connected through channel id ", knxClient.channelID);
  //         var dpt = DPTLib.resolve("DPT1.001");
  //         let adpu = {};
  //         console.log("SENT", DPTLib.populateAPDU(false, adpu, dpt))
  //         //knxClient.sendWriteRequest("15.15.0", "0/1/1", DPTLib.populateAPDU(false, "", dpt));
  //     });
};
