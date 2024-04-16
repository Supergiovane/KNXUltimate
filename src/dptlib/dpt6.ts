/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import type { DatapointConfig } from ".";

const config: DatapointConfig = {
  id: 'DPT6', // Adding the ID for DPT6
  basetype: {
    bitlength: 8,
    signedness: 'signed',
    valuetype: 'basic',
    desc: '8-bit signed value',
    range: [-128, 127],
    help: `// Send value -128 to 127
msg.payload = -24;
return msg;`
  },
  subtypes: {
    // 6.001 percentage (-128%..127%)
    '001': {
      name: 'Percent (-128..127%)',
      desc: 'percent',
      unit: '%'
    },
    // 6.002 counter pulses (-128..127)
    '010': {
      name: 'Counter pulses (-128..127%)',
      desc: 'counter pulses',
      unit: 'pulses'
    },
    // 6.02 Status with mode
    '020': {
      name: 'Status with mode (-128..127%)',
      desc: 'status with mode',
      unit: 'status'
    }
  }
};

export default config;
