// Shared KNX/KNX Secure constants

// Data Secure SCF for encryption + S_A_DATA, no tool/system broadcast
export const SCF_ENCRYPTION_S_A_DATA = 0x10 // tool_access=0, alg=001, system_broadcast=0, service=000

// KNX/IP service types
export const KNXIP = {
	SECURE_SESSION_REQUEST: 0x0951,
	SECURE_SESSION_RESPONSE: 0x0952,
	SECURE_SESSION_AUTHENTICATE: 0x0953,
	SECURE_SESSION_STATUS: 0x0954,
	SECURE_WRAPPER: 0x0950,
	TUNNELING_CONNECT_REQUEST: 0x0205,
	TUNNELING_CONNECT_RESPONSE: 0x0206,
	TUNNELING_REQUEST: 0x0420,
	TUNNELING_ACK: 0x0421,
} as const

// cEMI
export const CEMI = {
	L_DATA_REQ: 0x11,
	ADDITIONAL_INFO_NONE: 0x00,
	DEFAULT_GROUP_FLAGS: 0xbce0,
	CTRL2_RELEVANT_MASK: 0x8f, // 1000_1111
} as const

// APCI (application layer)
export const APCI = {
	GROUP_VALUE_READ: 0x0000,
	GROUP_VALUE_RESPONSE: 0x0040,
	GROUP_VALUE_WRITE: 0x0080,
	SERVICE_MASK: 0x03c0,
} as const

// Secure APCI header (APCI_SEC)
export const APCI_SEC = {
	HIGH: 0x03,
	LOW: 0xf1,
	HEADER: Buffer.from([0x03, 0xf1]),
} as const

// TPCI (transport layer)
export const TPCI_DATA = 0x00 // data TPDU

// Secure Wrapper constants
export const SECURE_WRAPPER_TAG = Buffer.from('0000', 'hex')
export const SECURE_WRAPPER_CTR_SUFFIX = Buffer.from('0000ff00', 'hex')
export const SECURE_WRAPPER_MAC_SUFFIX = Buffer.from('ff00', 'hex')
export const SECURE_WRAPPER_OVERHEAD = 38 // header(6)+sid(2)+seq(6)+serial(6)+tag(2)+mac(16)
export const KNXIP_HDR_SECURE_WRAPPER = Buffer.from('06100950', 'hex')
export const KNXIP_HDR_TUNNELING_REQUEST = Buffer.from('06100420', 'hex')
export const KNXIP_HDR_TUNNELING_ACK = Buffer.from('06100421', 'hex')
export const KNXIP_HDR_TUNNELING_CONNECT_REQUEST = Buffer.from(
	'06100205',
	'hex',
)
export const KNXIP_HDR_SECURE_SESSION_REQUEST = Buffer.from('06100951', 'hex')
export const KNXIP_HDR_SECURE_SESSION_AUTHENTICATE = Buffer.from(
	'06100953',
	'hex',
)
export const TUNNELING_ACK_TOTAL_LEN = 0x000a

// Data Secure counter suffix (seq + addr + suffix)
export const DATA_SECURE_CTR_SUFFIX = Buffer.from([
	0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
])

// Session authenticate CTR IV suffix for MAC transformation
export const AUTH_CTR_IV = Buffer.from(
	'0000000000000000000000000000ff00',
	'hex',
)

// Default delays/timeouts
export const CONNECT_SEND_DELAY_MS = 150
export const DEFAULT_STATUS_TIMEOUT_MS = 5000
export const WAIT_FOR_STATUS_DEFAULT_MS = 4000
export const KNXIP_HEADER_LEN = 6
export const TUNNEL_CONN_HEADER_LEN = 0x04
export const DEFAULT_SRC_IA_FALLBACK = '1.1.255'

// KNX Secure default timeouts (handshake phases)
export const SECURE_SESSION_TIMEOUT_MS = 5000 // wait for SESSION_RESPONSE
export const SECURE_AUTH_TIMEOUT_MS = 5000 // wait for SESSION_STATUS
export const SECURE_CONNECT_TIMEOUT_MS = 15000 // wait for CONNECT_RESPONSE

// HPAI/CRD for connect request
export const HPAI_CONTROL_ENDPOINT_EMPTY = Buffer.from(
	'0802000000000000',
	'hex',
)
export const HPAI_DATA_ENDPOINT_EMPTY = Buffer.from('0802000000000000', 'hex')
export const CRD_TUNNEL_LINKLAYER = Buffer.from('04040200', 'hex')

// Common lengths
export const PUBLIC_KEY_LEN = 32
export const SECURE_SEQ_LEN = 6
export const SERIAL_LEN = 6
export const AES_BLOCK_LEN = 16
export const MAC_LEN_FULL = 16
export const MAC_LEN_SHORT = 4 // Data Secure MAC length
