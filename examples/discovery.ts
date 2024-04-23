import { KNXClientEvents, KNXClient, dptlib } from "../src";

const client = new KNXClient({
    hostProtocol: 'Multicast',
})


client.on(KNXClientEvents.discover, (host) => {
    console.log(`Discovered KNX gateway at ${host}`)
})


client.startDiscovery()
