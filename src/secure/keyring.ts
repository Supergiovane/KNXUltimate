import * as crypto from 'crypto';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import * as zlib from 'zlib';

// Address classes
export class IndividualAddress {
    raw: number;

    constructor(address: string | number) {
        if (typeof address === 'string') {
            const parts = address.split('.');
            if (parts.length !== 3) {
                throw new Error(`Invalid individual address format: ${address}`);
            }
            const area = parseInt(parts[0]);
            const line = parseInt(parts[1]);
            const device = parseInt(parts[2]);
            this.raw = (area << 12) | (line << 8) | device;
        } else {
            this.raw = address;
        }
    }

    toString(): string {
        const area = (this.raw >> 12) & 0xF;
        const line = (this.raw >> 8) & 0xF;
        const device = this.raw & 0xFF;
        return `${area}.${line}.${device}`;
    }
}

export class GroupAddress {
    raw: number;

    constructor(address: string | number) {
        if (typeof address === 'string') {
            // Check if it's a raw number string
            if (!address.includes('/')) {
                this.raw = parseInt(address);
                return;
            }
            
            const parts = address.split('/');
            if (parts.length === 3) {
                // 3-level format: main/middle/sub
                const main = parseInt(parts[0]);
                const middle = parseInt(parts[1]);
                const sub = parseInt(parts[2]);
                this.raw = (main << 11) | (middle << 8) | sub;
            } else if (parts.length === 2) {
                // 2-level format: main/sub
                const main = parseInt(parts[0]);
                const sub = parseInt(parts[1]);
                this.raw = (main << 11) | sub;
            } else {
                throw new Error(`Invalid group address format: ${address}`);
            }
        } else {
            this.raw = address;
        }
    }

    toString(): string {
        const main = (this.raw >> 11) & 0x1F;
        const middle = (this.raw >> 8) & 0x7;
        const sub = this.raw & 0xFF;
        return `${main}/${middle}/${sub}`;
    }
}

// Interface for keyring data structures
export interface Interface {
    type: string;
    individualAddress: IndividualAddress;
    host?: IndividualAddress;
    userId?: number;
    password?: string;
    authentication?: string;
    decryptedPassword?: string;
    decryptedAuthentication?: string;
    groupAddresses: Map<string, IndividualAddress[]>;
}

export interface Backbone {
    key?: string;
    decryptedKey?: Buffer;
    latency?: number;
    multicastAddress?: string;
}

export interface GroupAddressKey {
    address: GroupAddress;
    key: string;
    decryptedKey?: Buffer;
}

export interface Device {
    individualAddress: IndividualAddress;
    toolKey?: string;
    decryptedToolKey?: Buffer;
    managementPassword?: string;
    decryptedManagementPassword?: string;
    authentication?: string;
    decryptedAuthentication?: string;
    sequenceNumber?: number;
    serialNumber?: string;
}

export class Keyring {
    private interfaces: Map<string, Interface> = new Map();
    private backbones: Backbone[] = [];
    private groupAddresses: Map<string, GroupAddressKey> = new Map();
    private devices: Map<string, Device> = new Map();
    private passwordHash?: Buffer;
    private createdBy?: string;
    private created?: string;
    private iv?: Buffer;

    /**
     * Load a .knxkeys file with the given password
     */
    async load(filePath: string, password: string): Promise<void> {
        if (process.env.KNX_DEBUG === '1') console.log('🔐 Loading keyring file:', filePath);
        
        // Read and unzip the .knxkeys file
        const zipContent = fs.readFileSync(filePath);
        const xmlContent = await this.unzipKnxKeys(zipContent);
        
        // Parse XML
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xmlContent);
        
        // Hash the password using PBKDF2 (MUST use salt "1.keyring.ets.knx.org")
        this.passwordHash = this.hashKeyringPassword(password);
        if (process.env.KNX_DEBUG === '1') console.log('Password hash:', this.passwordHash.toString('hex'));
        
        // Extract keyring data
        await this.parseKeyring(result);
    }

    getCreatedBy(): string | undefined {
        return this.createdBy;
    }

    getCreated(): string | undefined {
        return this.created;
    }

    /**
     * Hash keyring password using PBKDF2 with the correct salt
     * This is CRITICAL - must use salt "1.keyring.ets.knx.org"
     */
    private hashKeyringPassword(password: string): Buffer {
        return crypto.pbkdf2Sync(
            Buffer.from(password, 'utf-8'),
            Buffer.from('1.keyring.ets.knx.org', 'utf-8'),
            65536,  // iterations
            16,     // key length
            'sha256'
        );
    }

    /**
     * Decrypt data using AES-128-CBC
     */
    private decryptAes128Cbc(encryptedData: Buffer, key: Buffer, iv: Buffer): Buffer {
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        decipher.setAutoPadding(false); // Important: no auto padding
        return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    }

    /**
     * Extract password from decrypted data (match xknx)
     * Format: 8 bytes header + password + PKCS#7 padding
     */
    private extractPassword(data: Buffer): string {
        if (!data || data.length === 0) return '';
        const pad = data[data.length - 1];
        const padLen = pad >= 1 && pad <= 16 ? pad : 0;
        const end = data.length - padLen;
        if (end <= 8) return '';
        const payload = data.slice(8, end);
        return payload.toString('utf-8');
    }

    /**
     * Unzip the .knxkeys file to get the XML content
     */
    private async unzipKnxKeys(zipContent: Buffer): Promise<string> {
        return new Promise((resolve, reject) => {
            zlib.unzip(zipContent.slice(30), (err, buffer) => {
                if (err) {
                    // Try to find the XML content manually
                    const xmlStart = zipContent.indexOf('<?xml');
                    if (xmlStart !== -1) {
                        const xmlEnd = zipContent.indexOf('</Keyring>') + 10;
                        resolve(zipContent.slice(xmlStart, xmlEnd).toString('utf-8'));
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(buffer.toString('utf-8'));
                }
            });
        });
    }

    /**
     * Parse the keyring XML structure
     */
    private async parseKeyring(data: any): Promise<void> {
        const keyring = data.Keyring;
        
        if (!keyring) {
            throw new Error('Invalid keyring format');
        }

        // Store metadata
        this.createdBy = keyring.$?.CreatedBy;
        this.created = keyring.$?.Created;
        if (this.created) {
            const createdHash = crypto.createHash('sha256').update(Buffer.from(this.created, 'utf-8')).digest();
            this.iv = createdHash.slice(0, 16);
        }
        
        if (process.env.KNX_DEBUG === '1') console.log(`Keyring created by: ${this.createdBy} on ${this.created}`);
        
        // Parse interfaces
        if (keyring.Interface) {
            const interfaces = Array.isArray(keyring.Interface) ? keyring.Interface : [keyring.Interface];
            for (const iface of interfaces) {
                this.parseInterface(iface);
            }
        }
        
        // Parse backbone
        if (keyring.Backbone) {
            const backbones = Array.isArray(keyring.Backbone) ? keyring.Backbone : [keyring.Backbone];
            for (const backbone of backbones) {
                this.parseBackbone(backbone);
            }
        }
        
        // Parse group addresses
        if (keyring.GroupAddresses?.[0]?.Group) {
            const groups = Array.isArray(keyring.GroupAddresses[0].Group) 
                ? keyring.GroupAddresses[0].Group 
                : [keyring.GroupAddresses[0].Group];
            for (const group of groups) {
                this.parseGroupAddress(group);
            }
        }
        
        // Parse devices
        if (keyring.Devices?.[0]?.Device) {
            const devices = Array.isArray(keyring.Devices[0].Device)
                ? keyring.Devices[0].Device
                : [keyring.Devices[0].Device];
            for (const device of devices) {
                this.parseDevice(device);
            }
        }
    }

    /**
     * Parse and decrypt an interface
     */
    private parseInterface(data: any): void {
        const attrs = data.$;
        if (!attrs) return;

        const iface: Interface = {
            type: attrs.Type,
            individualAddress: new IndividualAddress(attrs.IndividualAddress),
            host: attrs.Host ? new IndividualAddress(attrs.Host) : undefined,
            userId: attrs.UserID ? parseInt(attrs.UserID) : undefined,
            password: attrs.Password,
            authentication: attrs.Authentication,
            groupAddresses: new Map()
        };

        // Decrypt passwords if present
        if (iface.password && this.passwordHash) {
            const encrypted = Buffer.from(iface.password, 'base64');
            const iv = this.iv ?? Buffer.alloc(16, 0);
            const decrypted = this.decryptAes128Cbc(encrypted, this.passwordHash, iv);
            if (process.env.KNX_DEBUG === '1') console.log(`Interface ${iface.individualAddress} password raw:`, decrypted.toString('hex'));
            iface.decryptedPassword = this.extractPassword(decrypted);
            if (process.env.KNX_DEBUG === '1') console.log(`Interface ${iface.individualAddress} password:`, iface.decryptedPassword);
        }

        if (iface.authentication && this.passwordHash) {
            const encrypted = Buffer.from(iface.authentication, 'base64');
            const iv = this.iv ?? Buffer.alloc(16, 0);
            const decrypted = this.decryptAes128Cbc(encrypted, this.passwordHash, iv);
            if (process.env.KNX_DEBUG === '1') console.log(`Interface ${iface.individualAddress} auth raw:`, decrypted.toString('hex'));
            iface.decryptedAuthentication = this.extractPassword(decrypted);
            if (process.env.KNX_DEBUG === '1') console.log(`Interface ${iface.individualAddress} auth:`, iface.decryptedAuthentication);
        }

        // Parse assigned group addresses
        if (data.Group) {
            const groups = Array.isArray(data.Group) ? data.Group : [data.Group];
            for (const group of groups) {
                const groupAddr = new GroupAddress(group.$.Address);
                const senders = group.$.Senders ? 
                    group.$.Senders.split(' ').map((s: string) => new IndividualAddress(s)) : [];
                iface.groupAddresses.set(groupAddr.toString(), senders);
            }
        }

        this.interfaces.set(iface.individualAddress.toString(), iface);
    }

    /**
     * Parse and decrypt backbone
     */
    private parseBackbone(data: any): void {
        const attrs = data.$;
        if (!attrs) return;

        const backbone: Backbone = {
            key: attrs.Key,
            latency: attrs.Latency ? parseInt(attrs.Latency) : undefined,
            multicastAddress: attrs.MulticastAddress
        };

        // Decrypt key if present
        if (backbone.key && this.passwordHash) {
            const encrypted = Buffer.from(backbone.key, 'base64');
            const iv = this.iv ?? Buffer.alloc(16, 0);
            backbone.decryptedKey = this.decryptAes128Cbc(encrypted, this.passwordHash, iv);
            if (process.env.KNX_DEBUG === '1') console.log('Backbone key:', backbone.decryptedKey?.toString('hex'));
        }

        this.backbones.push(backbone);
    }

    /**
     * Parse and decrypt group address
     */
    private parseGroupAddress(data: any): void {
        const attrs = data.$;
        if (!attrs || !attrs.Address || !attrs.Key) return;

        const group: GroupAddressKey = {
            address: new GroupAddress(attrs.Address),
            key: attrs.Key
        };

        // Decrypt key
        if (this.passwordHash) {
            const encrypted = Buffer.from(group.key, 'base64');
            const iv = this.iv ?? Buffer.alloc(16, 0);
            group.decryptedKey = this.decryptAes128Cbc(encrypted, this.passwordHash, iv);
            if (process.env.KNX_DEBUG === '1') console.log(`Group ${group.address} key:`, group.decryptedKey?.toString('hex'));
        }

        this.groupAddresses.set(group.address.toString(), group);
    }

    /**
     * Parse and decrypt device
     */
    private parseDevice(data: any): void {
        const attrs = data.$;
        if (!attrs) return;

        const device: Device = {
            individualAddress: new IndividualAddress(attrs.IndividualAddress),
            toolKey: attrs.ToolKey,
            managementPassword: attrs.ManagementPassword,
            authentication: attrs.Authentication,
            sequenceNumber: attrs.SequenceNumber ? parseInt(attrs.SequenceNumber) : undefined,
            serialNumber: attrs.SerialNumber
        };

        // Decrypt keys and passwords
        if (device.toolKey && this.passwordHash) {
            const encrypted = Buffer.from(device.toolKey, 'base64');
            const iv = this.iv ?? Buffer.alloc(16, 0);
            device.decryptedToolKey = this.decryptAes128Cbc(encrypted, this.passwordHash, iv);
            if (process.env.KNX_DEBUG === '1') console.log(`Device ${device.individualAddress} tool key:`, device.decryptedToolKey?.toString('hex'));
        }

        if (device.managementPassword && this.passwordHash) {
            const encrypted = Buffer.from(device.managementPassword, 'base64');
            const iv = this.iv ?? Buffer.alloc(16, 0);
            const decrypted = this.decryptAes128Cbc(encrypted, this.passwordHash, iv);
            if (process.env.KNX_DEBUG === '1') console.log(`Device ${device.individualAddress} mgmt raw:`, decrypted.toString('hex'));
            device.decryptedManagementPassword = this.extractPassword(decrypted);
        }

        if (device.authentication && this.passwordHash) {
            const encrypted = Buffer.from(device.authentication, 'base64');
            const iv = this.iv ?? Buffer.alloc(16, 0);
            const decrypted = this.decryptAes128Cbc(encrypted, this.passwordHash, iv);
            if (process.env.KNX_DEBUG === '1') console.log(`Device ${device.individualAddress} auth raw:`, decrypted.toString('hex'));
            device.decryptedAuthentication = this.extractPassword(decrypted);
        }

        this.devices.set(device.individualAddress.toString(), device);
    }

    // Getters for accessing keyring data
    getInterfaces(): Map<string, Interface> {
        return this.interfaces;
    }

    getInterface(address: string): Interface | undefined {
        return this.interfaces.get(address);
    }

    getBackbones(): Backbone[] {
        return this.backbones;
    }

    getGroupAddresses(): Map<string, GroupAddressKey> {
        return this.groupAddresses;
    }

    getGroupAddress(address: string): GroupAddressKey | undefined {
        return this.groupAddresses.get(address);
    }

    getDevices(): Map<string, Device> {
        return this.devices;
    }

    getDevice(address: string): Device | undefined {
        return this.devices.get(address);
    }
}
