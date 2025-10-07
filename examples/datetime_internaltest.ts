/**
 * Internal example validating KNX datetime handling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNXClientOptions } from "../src/KNXClient";
import { KNXClientEvents, KNXClient, dptlib } from "../src";
import { resolve, fromBuffer } from "../src/dptlib";



async function main() {
    // Simulate receiving a KNX telegram encoded as DPT 10.001 (time of day)
    const config = resolve("10.001");
    let rawArray = new Uint8Array([16, 58, 11]);
    let _Rawvalue = Buffer.from(rawArray);
    let jsValue = fromBuffer(_Rawvalue, config);
    console.log(jsValue);

    // Simulate encoding the current time back to a KNX payload
    const dpt = resolve("10.001");
    let d = new Date().toString();
    let toKnxBuff = dpt.formatAPDU(d)
    console.log(toKnxBuff);
}

main().catch(console.error);
