import { fromBuffer, resolve } from "../src/dptlib";
import KNXClient, { KNXClientEvents } from "../src/KNXClient";
import KNXRoutingIndication from "src/protocol/KNXRoutingIndication";

// Create tunnel socket with source knx address 1.1.100
const knxClient = new KNXClient({
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
});

knxClient.on(KNXClientEvents.error, (err: any) => {
  console.log("BANANA ERRORE", err);
});

// Call discoverCB when a knx gateway has been discovered.
knxClient.on(KNXClientEvents.discover, (info: string) => {
  const [ip, port] = info.split(":");
  discoverCB(ip, port);
});

knxClient.on(KNXClientEvents.disconnected, (reason) => {
  console.log("BANANA DISCONNESSO", reason);
});

knxClient.on(KNXClientEvents.close, () => {
  console.log("BANANA CHIUSO");
});

knxClient.on(KNXClientEvents.connected, () => {
  console.log("CONNESSO CON CHANNEL ID ", knxClient.channelID);
});

knxClient.on(KNXClientEvents.connecting, (options) => {
  console.log("CONNECTING ", options);
});

const wait = (t: number = 3000): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, t);
  });
};

const handleBusEvent = function (
  packet: KNXRoutingIndication,
  echoed: boolean,
) {
  try {
    var dpt = resolve("DPT1.001");
    var jsvalue = fromBuffer(packet.cEMIMessage.npdu.dataValue, dpt);
  } catch (error) {
    console.log(error);
  }

  let sType = "";
  if (packet.cEMIMessage.npdu.isGroupRead) sType = "GroupValue_Read";
  if (packet.cEMIMessage.npdu.isGroupResponse) sType = "GroupValue_Response";
  if (packet.cEMIMessage.npdu.isGroupWrite) sType = "GroupValue_Write";

  let srcAddress = packet.cEMIMessage.srcAddress.toString();
  let dstAddress = packet.cEMIMessage.dstAddress.toString();

  let isRepeated = packet.cEMIMessage.control.repeat === 1 ? false : true;

  let cemiETS = "";

  // if (rawCEMISocketMessage !== undefined) {
  //   try {
  //     var iStart = _datagram._header._headerLength + 4;
  //     cemiETS = rawCEMISocketMessage.toString("hex").substring(iStart * 2);
  //   } catch (error) {
  //     cemiETS = "";
  //   }
  // }

  console.log(
    "BANANA",
    srcAddress,
    dstAddress,
    jsvalue,
    "Echoed",
    echoed,
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
