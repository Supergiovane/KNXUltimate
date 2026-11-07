/**
 * Tests the ROUTING_BUSY wait time calculation.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import RoutingFlowControl from '../../src/RoutingFlowControl'

describe('RoutingFlowControl', () => {
	function setup(random = 0) {
		const time = { now: 1000 }
		const flowControl = new RoutingFlowControl(
			() => time.now,
			() => random,
		)
		return { time, flowControl }
	}

	it('does not pause before a ROUTING_BUSY', () => {
		assert.equal(setup().flowControl.remainingPauseMs, 0)
	})

	it('pauses for tw', () => {
		const { time, flowControl } = setup()
		flowControl.handleRoutingBusy(100)
		assert.equal(flowControl.remainingPauseMs, 100)
		time.now += 99
		assert.equal(flowControl.remainingPauseMs, 1)
		time.now += 1
		assert.equal(flowControl.remainingPauseMs, 0)
	})

	it('adds trandom up to N * 50 ms', () => {
		const { flowControl } = setup(1)
		flowControl.handleRoutingBusy(100)
		assert.equal(flowControl.remainingPauseMs, 150)
	})

	it('keeps the remaining time when it is higher than the new tw', () => {
		const { time, flowControl } = setup()
		flowControl.handleRoutingBusy(100)
		time.now += 20
		flowControl.handleRoutingBusy(50)
		assert.equal(flowControl.remainingPauseMs, 80)
	})

	it('takes the new tw when it is higher than the remaining time', () => {
		const { time, flowControl } = setup()
		flowControl.handleRoutingBusy(100)
		time.now += 90
		flowControl.handleRoutingBusy(50)
		assert.equal(flowControl.remainingPauseMs, 50)
	})

	it('counts N only for frames more than 10 ms after the previous one', () => {
		const { time, flowControl } = setup(1)
		flowControl.handleRoutingBusy(100)
		time.now += 10
		flowControl.handleRoutingBusy(200)
		// N is still 1
		assert.equal(flowControl.remainingPauseMs, 250)
		time.now += 11
		flowControl.handleRoutingBusy(300)
		// N is 2
		assert.equal(flowControl.remainingPauseMs, 400)
	})

	it('decrements N every 5 ms once tslowduration has elapsed', () => {
		const { time, flowControl } = setup(1)
		flowControl.handleRoutingBusy(20)
		time.now += 11
		flowControl.handleRoutingBusy(20)
		time.now += 11
		flowControl.handleRoutingBusy(20)
		// N is 3: resume after 20 + 150 ms, then tslowduration of 300 ms
		assert.equal(flowControl.remainingPauseMs, 170)

		time.now += 170 + 300
		flowControl.handleRoutingBusy(20)
		// Nothing faded out yet: N is 4
		assert.equal(flowControl.remainingPauseMs, 220)

		time.now += 220 + 400 + 3 * 5
		flowControl.handleRoutingBusy(20)
		// Three decrements and this frame: N is 2
		assert.equal(flowControl.remainingPauseMs, 120)
	})

	it('never lets N go below zero', () => {
		const { time, flowControl } = setup(1)
		flowControl.handleRoutingBusy(20)
		time.now += 100000
		flowControl.handleRoutingBusy(20)
		assert.equal(flowControl.remainingPauseMs, 70)
	})

	it('forgets everything on reset', () => {
		const { flowControl } = setup(1)
		flowControl.handleRoutingBusy(100)
		flowControl.reset()
		assert.equal(flowControl.remainingPauseMs, 0)
		flowControl.handleRoutingBusy(100)
		assert.equal(flowControl.remainingPauseMs, 150)
	})
})
