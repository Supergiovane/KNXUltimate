/**
 * Unit tests for Typed Emitter.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it } from 'node:test'
import assert from 'assert'
import { applyMixin } from '../../src/TypedEmitter'

class MixinClass {
	mixinMethod() {
		return 'mixinMethod'
	}
}

class TargetClass {}

describe('applyMixin', () => {
	it('should apply mixin methods to the target class', () => {
		applyMixin(TargetClass, MixinClass)
		const targetInstance = new TargetClass()

		// Check if mixinMethod is now part of TargetClass's prototype
		assert.strictEqual(typeof targetInstance['mixinMethod'], 'function')
		assert.strictEqual(targetInstance['mixinMethod'](), 'mixinMethod')
	})

	it('should apply multiple mixins to the target class', () => {
		class AnotherMixin {
			anotherMethod() {
				return 'anotherMethod'
			}
		}

		applyMixin(TargetClass, MixinClass)
		applyMixin(TargetClass, AnotherMixin)
		const targetInstance = new TargetClass()

		// Check if both mixinMethod and anotherMethod are now part of TargetClass's prototype
		assert.strictEqual(typeof targetInstance['mixinMethod'], 'function')
		assert.strictEqual(targetInstance['mixinMethod'](), 'mixinMethod')
		assert.strictEqual(typeof targetInstance['anotherMethod'], 'function')
		assert.strictEqual(targetInstance['anotherMethod'](), 'anotherMethod')
	})

	it('should not override the constructor if includeConstructor is false', () => {
		class ConstructorMixin {
			initialized: boolean = false

			constructor() {
				this.initialized = true
			}
		}

		applyMixin(TargetClass, ConstructorMixin, false)
		const targetInstance = new TargetClass()

		// Check that the targetInstance does not have an 'initialized' property
		assert.strictEqual(targetInstance['initialized'], undefined)
	})

	it('should override the constructor if includeConstructor is true', () => {
		class ConstructorMixin {
			initialized: boolean = false

			constructor() {
				this.initialized = true
			}
		}

		class NewTargetClass {
			initialized: boolean

			constructor() {
				this.initialized = true
			}
		}

		applyMixin(NewTargetClass, ConstructorMixin, true)
		const targetInstance = new NewTargetClass()

		// Check that the targetInstance has an 'initialized' property set to true
		assert.strictEqual(targetInstance['initialized'], true)
	})

	it('should apply inherited methods from mixin to the target class', () => {
		class ParentMixin {
			parentMethod() {
				return 'parentMethod'
			}
		}

		class ChildMixin extends ParentMixin {
			childMethod() {
				return 'childMethod'
			}
		}

		applyMixin(TargetClass, ChildMixin)
		const targetInstance = new TargetClass()

		// Check if both parentMethod and childMethod are now part of TargetClass's prototype
		assert.strictEqual(typeof targetInstance['parentMethod'], 'function')
		assert.strictEqual(targetInstance['parentMethod'](), 'parentMethod')
		assert.strictEqual(typeof targetInstance['childMethod'], 'function')
		assert.strictEqual(targetInstance['childMethod'](), 'childMethod')
	})
})
