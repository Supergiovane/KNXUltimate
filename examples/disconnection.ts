/**
 * Example showing clean KNX disconnection handling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNXClient, KNXClientEvents } from '../src'
import { wait } from '../src/utils'

async function capturePackets() {
    const events: string[] = []
    let client: KNXClient
    let heartbeatCount = 0
    // Keep the timing budget tiny so the script completes quickly
    const REQUIRED_HEARTBEATS = 3  // For short disconnection test
    const HEARTBEAT_INTERVAL = 10  // 10 seconds between heartbeats
    const TOTAL_CAPTURE_TIME = (REQUIRED_HEARTBEATS + 2) * HEARTBEAT_INTERVAL * 1000

    console.log(`Capture configuration:
- Required heartbeats: ${REQUIRED_HEARTBEATS} (1 initial + 1 during disconnection + 1 after reconnection)
- Heartbeat interval: ${HEARTBEAT_INTERVAL} seconds
- Total capture time: ${TOTAL_CAPTURE_TIME/1000} seconds`)

    try {
        console.log('\nPhase 1: Discovering KNX interfaces...')
        // Discover an interface; reuse the first hit for this demo
        const interfaces = await KNXClient.discover(1000)

        if (interfaces.length === 0) {
            throw new Error('No KNX interfaces found')
        }

        console.log('Discovered interfaces:', interfaces)
        const [ip, port] = interfaces[0].split(':')
        console.log('Using interface:', ip, 'port:', port)

        return new Promise<void>((resolve, reject) => {
            // Build a tunnel client that captures packets in sniffing mode
            client = new KNXClient({
                ipAddr: ip,
                ipPort: port,
                loglevel: 'debug',
                suppress_ack_ldatareq: false,
                hostProtocol: 'TunnelUDP',
                sniffingMode: true,
                connectionKeepAliveTimeout: HEARTBEAT_INTERVAL
            })

            // Track heartbeats through state responses
            client.on(KNXClientEvents.response, (host, header, message) => {
                if (message.constructor.name === 'KNXConnectionStateResponse') {
                    heartbeatCount++
                    console.log(`\nPhase 3: Heartbeat ${heartbeatCount}/${REQUIRED_HEARTBEATS} received`)
                    console.log('Time elapsed since connection:', Math.floor((Date.now() - connectionTime)/1000), 'seconds')
                }
            })

            let connectionTime: number

            client.on(KNXClientEvents.connected, async (info) => {
                console.log('\nPhase 2: Successfully connected to KNX interface')
                connectionTime = Date.now()
                events.push('connected')
                
                try {
                    console.log(`Starting packet capture. Waiting ${TOTAL_CAPTURE_TIME/1000} seconds to collect ${REQUIRED_HEARTBEATS} heartbeats...`)
                    await wait(TOTAL_CAPTURE_TIME)
                    
                    if (heartbeatCount < REQUIRED_HEARTBEATS) {
                        console.log(`\nWarning: Only captured ${heartbeatCount} heartbeats out of ${REQUIRED_HEARTBEATS} required`)
                    }
                    
                    console.log('\nPhase 4: Initiating disconnection...')
                    await client.Disconnect()
                    
                    // Save captured packets
                    const packets = (client as any).sniffingPackets
                    
                    const output = {
                        captureDate: new Date().toISOString(),
                        testConfiguration: {
                            requiredHeartbeats: REQUIRED_HEARTBEATS,
                            heartbeatInterval: HEARTBEAT_INTERVAL,
                            totalCaptureTime: TOTAL_CAPTURE_TIME
                        },
                        clientOptions: {
                            ipAddr: client['_options'].ipAddr,
                            ipPort: client['_options'].ipPort,
                            hostProtocol: client['_options'].hostProtocol,
                            connectionKeepAliveTimeout: client['_options'].connectionKeepAliveTimeout
                        },
                        captureResults: {
                            totalHeartbeats: heartbeatCount,
                            totalPackets: packets.length,
                            events
                        },
                        packets
                    }
                    
                    console.log('\nPacket sequence:')
                    let lastTimestamp = connectionTime
                    packets.forEach((packet: any, index: number) => {
                        const currentDelta = packet.deltaReq
                        const absoluteTime = lastTimestamp + currentDelta
                        lastTimestamp = absoluteTime
                        
                        console.log(`\nPacket ${index + 1}:`)
                        console.log('Type:', packet.reqType || packet.resType || 'Unknown')
                        console.log('Time since connection:', Math.floor((absoluteTime - connectionTime)/1000), 'seconds')
                        if (packet.request) {
                            console.log('Request:', packet.request)
                            console.log('Request length:', packet.request.length / 2, 'bytes')
                        }
                        if (packet.response) {
                            console.log('Response:', packet.response)
                            console.log('Response length:', packet.response.length / 2, 'bytes')
                        }
                        console.log('Delta timing:', {
                            fromLastPacket: packet.deltaReq,
                            requestToResponse: packet.deltaRes
                        })
                    })

                    resolve()
                } catch (error) {
                    reject(error)
                }
            })

            client.on(KNXClientEvents.error, (err) => {
                console.error('KNX Error:', err)
                events.push(`error: ${err.message}`)
            })
            
            client.on(KNXClientEvents.disconnected, (reason) => {
                console.log('KNX disconnected:', reason)
                events.push(`disconnected: ${reason}`)
            })

            console.log('\nConnecting to KNX interface...')
            client.Connect()
        })
        
    } catch (error) {
        console.error('Capture failed with error:', error)
        console.error('Stack:', error.stack)
        process.exit(1)
    }
}

console.log('Starting KNX packet capture for short disconnection test...')
capturePackets().catch(console.error)
