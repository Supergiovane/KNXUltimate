import { KNXClient, KNXClientEvents } from "../src";

async function main() {
    const discovered = await KNXClient.discover();

    console.log(discovered);

}

main().catch(console.error);