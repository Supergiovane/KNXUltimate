/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import { DatapointConfig } from ".";

//
//  DPT15.*: Access data
//

// TODO: implement fromBuffer, formatAPDU

//  DPT15 base type info
const config: DatapointConfig = {
  id: "DPT15",
  basetype: {
    bitlength: 32,
    valuetype: "basic",
    desc: "4-byte access control data",
  },

  //  DPT15 subtypes info
  subtypes: {
    "000": {
      name: "Entrance access",
    },
  },
};

export default config;
