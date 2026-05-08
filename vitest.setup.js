import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto?.subtle === 'undefined') {
    Object.defineProperty(globalThis, 'crypto', {
        value: webcrypto,
        writable: true,
        configurable: true
    });
}

// For jsdom where window.crypto might be a frozen/non-configurable property:
// fallback — try to set subtle directly on jsdom's crypto
if (typeof globalThis.crypto?.subtle === 'undefined' && globalThis.crypto) {
    try {
        globalThis.crypto.subtle = webcrypto.subtle;
    } catch {
        // Give up — testCryptoSupport will return false
    }
}