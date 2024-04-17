import KnxLog from '../KnxLog';
import os from 'os';

interface NetworkInterface {
  address: string;
  family: string | number;
  internal: boolean;
}

function getIPv4Interfaces(): { [key: string]: NetworkInterface } {
  const candidateInterfaces: { [key: string]: NetworkInterface } = {};
  const interfaces = os.networkInterfaces();
  for (const iface in interfaces) {
    for (const key in interfaces[iface]) {
      const intf: NetworkInterface = interfaces[iface][key];
      try {
        KnxLog.get().debug('ipAddressHelper.js: parsing interface: %s (%j)', iface, intf);
        if (
          intf.family !== undefined &&
          (intf.family.toString().includes('4') || intf.family === 4) &&
          !intf.internal
        ) {
          KnxLog.get().trace('ipAddressHelper.js: Found suitable interface: %s (%j)', iface, intf);
          candidateInterfaces[iface] = intf;
        } else {
          KnxLog.get().trace('ipAddressHelper.js: Found NOT suitable interface: %s (%j)', iface, intf);
        }
      } catch (error) {
        KnxLog.get().error(
          'ipAddressHelper.js: getIPv4Interfaces: error parsing the interface %s (%j)',
          iface,
          intf
        );
      }
    }
  }

  return candidateInterfaces;
}

export function getLocalAddress(_interface: string = ''): string {
  KnxLog.get().trace('ipAddressHelper.js: getLocalAddress: getting interfaces');
  const candidateInterfaces = getIPv4Interfaces();
  if (_interface !== '') {
    if (!candidateInterfaces.hasOwnProperty(_interface)) {
      KnxLog.get().error(
        'ipAddressHelper.js: exports.getLocalAddress: Interface ' +
          _interface +
          ' not found or has no useful IPv4 address!'
      );
      throw Error('Interface ' + _interface + ' not found or has no useful IPv4 address!');
    } else {
      return candidateInterfaces[_interface].address;
    }
  }

  if (Object.keys(candidateInterfaces).length > 0) {
    return candidateInterfaces[Object.keys(candidateInterfaces)[0]].address;
  }

  throw Error('No valid IPv4 interfaces detected');
}