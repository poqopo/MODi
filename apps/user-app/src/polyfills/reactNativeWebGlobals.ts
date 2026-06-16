declare const require: (path: string) => unknown

if (typeof document === 'undefined') {
  require('react-native/Libraries/Core/setUpXHR')
}

type EventInitLike = {
  bubbles?: boolean
  cancelable?: boolean
  composed?: boolean
}

type GlobalWithWebEvents = typeof globalThis & {
  CustomEvent?: typeof CustomEvent
  Event?: typeof Event
  Intl?: typeof Intl
  URL?: typeof URL
  webkitURL?: typeof URL
}

const globalScope = globalThis as GlobalWithWebEvents

if (typeof globalScope.URL === 'undefined' && typeof globalScope.webkitURL !== 'undefined') {
  globalScope.URL = globalScope.webkitURL
}

const intlScope = (globalScope.Intl ??= {} as typeof Intl) as typeof Intl & {
  PluralRules?: typeof Intl.PluralRules
}

if (typeof intlScope.PluralRules === 'undefined') {
  class MinimalPluralRules {
    constructor(
      _locales?: string | string[],
      private readonly options: Intl.PluralRulesOptions = {},
    ) {}

    resolvedOptions(): Intl.ResolvedPluralRulesOptions {
      return {
        locale: 'en-US',
        maximumFractionDigits: 3,
        minimumFractionDigits: 0,
        minimumIntegerDigits: 1,
        pluralCategories: ['one', 'two', 'few', 'other'],
        type: this.options.type ?? 'cardinal',
      }
    }

    select(value: number): Intl.LDMLPluralRule {
      const absoluteValue = Math.abs(Number(value))

      if (this.options.type === 'ordinal') {
        const mod10 = absoluteValue % 10
        const mod100 = absoluteValue % 100

        if (mod10 === 1 && mod100 !== 11) {
          return 'one'
        }

        if (mod10 === 2 && mod100 !== 12) {
          return 'two'
        }

        if (mod10 === 3 && mod100 !== 13) {
          return 'few'
        }

        return 'other'
      }

      return absoluteValue === 1 ? 'one' : 'other'
    }
  }

  intlScope.PluralRules = MinimalPluralRules as unknown as typeof Intl.PluralRules
}

if (typeof globalScope.Event === 'undefined') {
  class MinimalEvent {
    static readonly AT_TARGET = 2
    static readonly BUBBLING_PHASE = 3
    static readonly CAPTURING_PHASE = 1
    static readonly NONE = 0

    readonly AT_TARGET = 2
    readonly BUBBLING_PHASE = 3
    readonly CAPTURING_PHASE = 1
    readonly NONE = 0

    bubbles: boolean
    cancelable: boolean
    composed: boolean
    currentTarget: EventTarget | null = null
    defaultPrevented = false
    eventPhase = 0
    isTrusted = false
    target: EventTarget | null = null
    timeStamp = Date.now()
    type: string

    constructor(type: string, init: EventInitLike = {}) {
      this.type = type
      this.bubbles = Boolean(init.bubbles)
      this.cancelable = Boolean(init.cancelable)
      this.composed = Boolean(init.composed)
    }

    composedPath() {
      return []
    }

    preventDefault() {
      if (this.cancelable) {
        this.defaultPrevented = true
      }
    }

    stopImmediatePropagation() {}

    stopPropagation() {}
  }

  globalScope.Event = MinimalEvent as unknown as typeof Event
}

if (typeof globalScope.CustomEvent === 'undefined') {
  class MinimalCustomEvent<T = unknown> extends globalScope.Event {
    detail: T

    constructor(type: string, init: CustomEventInit<T> = {}) {
      super(type, init)
      this.detail = init.detail as T
    }

    initCustomEvent() {}
  }

  globalScope.CustomEvent = MinimalCustomEvent as unknown as typeof CustomEvent
}
