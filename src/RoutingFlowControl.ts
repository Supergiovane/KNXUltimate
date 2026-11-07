/**
 * Implements the KNXnet/IP routing flow control of a device receiving ROUTING_BUSY.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

// ISO 22510 §5.5.2.3.5 (KNX 03.08.05 §2.3.5)
const BUSY_INCREMENT_COOLDOWN_MS = 10
const BUSY_RANDOM_TIME_FACTOR_MS = 50
const BUSY_SLOWDURATION_TIME_FACTOR_MS = 100
const BUSY_DECREMENT_TIME_MS = 5

/**
 * Tracks how long ROUTING_INDICATIONs must be held back, as XKNX does. N (the
 * ROUTING_BUSY count of the moving period) fades out by computing it on demand.
 */
export default class RoutingFlowControl {
	private receivedBusyFrames = 0

	private lastBusyTime: number | undefined

	/** End of tw, without the random extension */
	private waitEndTime = 0

	/** End of tw + trandom */
	private resumeTime = 0

	/** When N starts to decrease, tslowduration after resuming */
	private fadeOutStartTime = 0

	constructor(
		private readonly now: () => number = () => performance.now(),
		private readonly random: () => number = Math.random,
	) {}

	/** Milliseconds left before ROUTING_INDICATIONs may be sent again */
	get remainingPauseMs(): number {
		return Math.max(0, this.resumeTime - this.now())
	}

	handleRoutingBusy(waitTimeMs: number): void {
		const now = this.now()
		const sincePrevious =
			this.lastBusyTime === undefined ? Infinity : now - this.lastBusyTime
		this.lastBusyTime = now
		const fadedOut = Math.floor(
			(now - this.fadeOutStartTime) / BUSY_DECREMENT_TIME_MS,
		)
		if (fadedOut > 0) {
			this.receivedBusyFrames = Math.max(
				0,
				this.receivedBusyFrames - fadedOut,
			)
		}
		if (sincePrevious > BUSY_INCREMENT_COOLDOWN_MS) {
			this.receivedBusyFrames += 1
		}
		// The higher of the remaining tw and the tw just received applies
		if (this.waitEndTime - now >= waitTimeMs) return

		this.waitEndTime = now + waitTimeMs
		this.resumeTime =
			this.waitEndTime +
			this.random() * this.receivedBusyFrames * BUSY_RANDOM_TIME_FACTOR_MS
		this.fadeOutStartTime =
			this.resumeTime +
			this.receivedBusyFrames * BUSY_SLOWDURATION_TIME_FACTOR_MS
	}

	reset(): void {
		this.receivedBusyFrames = 0
		this.lastBusyTime = undefined
		this.waitEndTime = 0
		this.resumeTime = 0
		this.fadeOutStartTime = 0
	}
}
