import { KNXClient, KNXClientEvents, logStream } from '../src'
import { module, setLogLevel } from '../src/KnxLog'
import { wait } from '../src/utils'
import { Writable } from 'stream'
import * as fs from 'fs'

const logger = module('KNX-TEST')

const logFileStream = new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
        const formattedLog = `${chunk.timestamp} [${chunk.level}] ${chunk.label}: ${chunk.message}\n`
        fs.appendFile('knx-test.log', formattedLog, (err) => {
            if (err) {
                logger.error('Error writing to log file:', err)
                callback(err)
                return
            }
            callback()
        })
    }
})

logStream.pipe(logFileStream)
    .on('error', (error) => {
        logger.error('Stream error:', error)
    })

async function testKNXClient() {
    setLogLevel('debug')
    
    let heartbeatCount = 0
    const REQUIRED_HEARTBEATS = 3
    const HEARTBEAT_INTERVAL = 10
    const TOTAL_CAPTURE_TIME = (REQUIRED_HEARTBEATS + 2) * HEARTBEAT_INTERVAL * 1000

    logger.info('Starting KNX test...')
    logger.debug('Test configuration - Required heartbeats: ' + REQUIRED_HEARTBEATS + 
        ', Heartbeat interval: ' + HEARTBEAT_INTERVAL + ' seconds' +
        ', Total capture time: ' + TOTAL_CAPTURE_TIME/1000 + ' seconds')
    
    logger.info('Discovering KNX interfaces...')
    
    const discovered = await KNXClient.discover();

    if (discovered.length === 0) {
        logger.error('No KNX interfaces found')
        logFileStream.end()
        return
    }

    logger.info('Found interfaces:', discovered)
    const [ip, port] = discovered[0].split(':')
    
    const client = new KNXClient({
        ipAddr: ip,
        ipPort: port,
        hostProtocol: 'TunnelUDP',
        connectionKeepAliveTimeout: HEARTBEAT_INTERVAL
    })

    client.on(KNXClientEvents.response, (host, header, message) => {
        if (message.constructor.name === 'KNXConnectionStateResponse') {
            heartbeatCount++
            logger.info(`Heartbeat ${heartbeatCount}/${REQUIRED_HEARTBEATS} received`)
        }
    })

    client.on(KNXClientEvents.connected, async () => {
        logger.info('Connected to KNX interface')
        logger.info(`Waiting ${TOTAL_CAPTURE_TIME/1000} seconds to collect ${REQUIRED_HEARTBEATS} heartbeats...`)
        
        await wait(TOTAL_CAPTURE_TIME)
        
        if (heartbeatCount < REQUIRED_HEARTBEATS) {
            logger.warn(`Only captured ${heartbeatCount} heartbeats out of ${REQUIRED_HEARTBEATS} required`)
        }
        
        logger.info('Initiating disconnection...')
        await client.Disconnect()
        logFileStream.end()
    })

    client.on(KNXClientEvents.error, (err) => {
        logger.error('KNX Error:', err)
    })
    
    client.on(KNXClientEvents.disconnected, (reason) => {
        logger.info('Disconnected:', reason)
    })

    logger.info('Connecting to KNX interface...')
    client.Connect()
}

testKNXClient()