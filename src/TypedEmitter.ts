import EventEmitter from 'events'

// eslint-disable-next-line @typescript-eslint/ban-types
export type Constructor<T = {}> = new (...args: any[]) => T

export function applyMixin(
	target: Constructor,
	mixin: Constructor,
	includeConstructor = false,
): void {
	// Figure out the inheritance chain of the mixin
	const inheritanceChain: Constructor[] = [mixin]
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const current = inheritanceChain[0]
		const base = Object.getPrototypeOf(current)
		if (base?.prototype) {
			inheritanceChain.unshift(base)
		} else {
			break
		}
	}
	for (const ctor of inheritanceChain) {
		for (const prop of Object.getOwnPropertyNames(ctor.prototype)) {
			// Do not override the constructor
			if (includeConstructor || prop !== 'constructor') {
				Object.defineProperty(
					target.prototype,
					prop,
					Object.getOwnPropertyDescriptor(ctor.prototype, prop) ??
						Object.create(null),
				)
			}
		}
	}
}

export type EventHandler =
	// Add more overloads as necessary
	| ((arg1: any, arg2: any, arg3: any, arg4: any) => void)
	| ((arg1: any, arg2: any, arg3: any) => void)
	| ((arg1: any, arg2: any) => void)
	| ((arg1: any) => void)
	| ((...args: any[]) => void)

export interface TypedEventEmitter<
	TEvents extends Record<keyof TEvents, EventHandler>,
> {
	on<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this
	once<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this
	prependListener<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this
	prependOnceListener<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this

	removeListener<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this
	off<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this

	removeAllListeners(event?: keyof TEvents): this

	emit<TEvent extends keyof TEvents>(
		event: TEvent,
		...args: Parameters<TEvents[TEvent]>
	): boolean

	setMaxListeners(n: number): this
	getMaxListeners(): number

	listeners<TEvent extends keyof TEvents>(
		eventName: TEvent,
	): TEvents[TEvent][]
	rawListeners<TEvent extends keyof TEvents>(
		eventName: TEvent,
	): TEvents[TEvent][]
	listenerCount<TEvent extends keyof TEvents>(
		event: TEvent,
		listener?: TEvents[TEvent],
	): number

	eventNames(): Array<keyof TEvents>
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TypedEventEmitter<
	TEvents extends Record<keyof TEvents, EventHandler>,
> {}

// Make TypedEventEmitter inherit from EventEmitter without actually extending
applyMixin(TypedEventEmitter, EventEmitter)
