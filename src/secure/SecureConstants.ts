/**
 * Constants for KNX Secure communication according to ISO 22510:2019
 */
export const KNX_SECURE = {
	// Service types for secure messages
	SERVICE_TYPE: {
		SECURE_WRAPPER: 0x0950, // Secure wrapper for existing messages
		SESSION_REQUEST: 0x0951, // Start secure session setup
		SESSION_RESPONSE: 0x0952, // Server response to session request
		SESSION_AUTHENTICATE: 0x0953, // Client authentication
		SESSION_STATUS: 0x0954, // Session status updates
		TIMER_NOTIFY: 0x0955, // Multicast timer sync
	},

	SESSION_STATUS: {
		AUTHENTICATION_SUCCESS: 0x00,
		AUTHENTICATION_FAILED: 0x01,
		UNAUTHENTICATED: 0x02,
		TIMEOUT: 0x03,
		CLOSE: 0x04,
		KEEPALIVE: 0x05,
	},

	// Secure session timeouts in seconds
	TIMEOUT: {
		AUTHENTICATION: 10, // Maximum time for authentication process
		SESSION: 60, // Maximum idle time for authenticated session
	},

	CRYPTO: {
		KEY_LENGTH: 16, // AES-128 key length in bytes
		MAC_LENGTH: 16, // Message Authentication Code length in bytes
		PBKDF2_ITERATIONS: 65536, // Iterations for password derivation
	},

	// Secure frame constraints
	FRAME: {
		MAX_PAYLOAD_LENGTH: 0xfeff,
		HEADER_SIZE: 6, // KNXnet/IP header size
	},

	USER: {
		RESERVED: 0x00,
		MANAGEMENT: 0x01,
		USER_MIN: 0x02,
		USER_MAX: 0x7f,
	},

	// Secure multicast group timer constants
	MULTICAST: {
		DEFAULT_LATENCY_TOLERANCE: 2000,
		DEFAULT_SYNC_LATENCY_FRACTION: 0.102, // Default sync latency fraction (10.2%)
		MIN_LATENCY_TOLERANCE: 20,
		MAX_DELAY_INITIAL_NOTIFY: 10000,
		MIN_DELAY_TIMEKEEPER_UPDATE: 100,
	},

	ERROR: {
		INVALID_USER_ID: 'Invalid user ID. Must be between 0x01 and 0x7F',
		INVALID_MAC_LENGTH: 'Invalid MAC length. Must be 16 bytes',
		INVALID_KEY_LENGTH: 'Invalid key length. Must be 16 bytes',
		MULTICAST_SESSION_ID: 'Session ID 0 is reserved for multicast',
		INVALID_BUFFER_LENGTH: 'Invalid buffer length',
		RESERVED_BYTE: 'Reserved byte must be 0x00',
		MAC_VERIFICATION: 'MAC verification failed',
		SESSION_TIMEOUT: 'Session timeout',
		PAYLOAD_TOO_LONG: 'Payload exceeds maximum length',
		SESSION_STATUS_INVALID_BUFFER:
			'Invalid buffer length for SessionStatus',
	},
} as const

export enum SecureSessionStatus {
	AUTHENTICATION_SUCCESS = KNX_SECURE.SESSION_STATUS.AUTHENTICATION_SUCCESS,
	AUTHENTICATION_FAILED = KNX_SECURE.SESSION_STATUS.AUTHENTICATION_FAILED,
	UNAUTHENTICATED = KNX_SECURE.SESSION_STATUS.UNAUTHENTICATED,
	TIMEOUT = KNX_SECURE.SESSION_STATUS.TIMEOUT,
	CLOSE = KNX_SECURE.SESSION_STATUS.CLOSE,
	KEEPALIVE = KNX_SECURE.SESSION_STATUS.KEEPALIVE,
}

export type SessionStatus =
	(typeof KNX_SECURE.SESSION_STATUS)[keyof typeof KNX_SECURE.SESSION_STATUS]

export type ServiceType =
	(typeof KNX_SECURE.SERVICE_TYPE)[keyof typeof KNX_SECURE.SERVICE_TYPE]

export function getSessionStatusString(status: SessionStatus): string {
	switch (status) {
		case KNX_SECURE.SESSION_STATUS.AUTHENTICATION_SUCCESS:
			return 'Authentication successful'
		case KNX_SECURE.SESSION_STATUS.AUTHENTICATION_FAILED:
			return 'Authentication failed'
		case KNX_SECURE.SESSION_STATUS.UNAUTHENTICATED:
			return 'Session not authenticated'
		case KNX_SECURE.SESSION_STATUS.TIMEOUT:
			return 'Session timeout'
		case KNX_SECURE.SESSION_STATUS.CLOSE:
			return 'Session closed'
		case KNX_SECURE.SESSION_STATUS.KEEPALIVE:
			return 'Keep alive'
		default:
			return 'Unknown status'
	}
}
