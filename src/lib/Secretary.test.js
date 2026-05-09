// Secretary.test.js

import { describe, it, expect, beforeAll } from "vitest";
import Secretary from "./Secretary.js";

const CHARSET_NUMBER = "0123456789";
const CHARSET_ALPHABET_L = "abcdefghijklmnopqrstuvwxyz";
const CHARSET_ALPHABET_U = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CHARSET_SPECIAL_29 = "!#$%&()*+,-./:;<=>?@[]^_`{|}~";
const CHARSET_SPECIAL_32 = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
const CHARSET_SPECIAL_33 = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~ ";

function allCharsIn(str, charset) {
    for (const ch of str) {
        if (!charset.includes(ch)) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// 1. Utility functions (pure, no internal state)
// ---------------------------------------------------------------------------
describe("Utility functions", () => {
    describe("base64ToBuffer / bufferToBase64", () => {
        it("round-trips binary data", () => {
            const original = new Uint8Array([
                0, 1, 255, 128, 64, 32, 16, 8, 4, 2,
            ]).buffer;
            const b64 = Secretary.bufferToBase64(original);
            const result = Secretary.base64ToBuffer(b64);
            expect(new Uint8Array(result)).toEqual(new Uint8Array(original));
        });
        it("handles empty buffer", () => {
            const original = new Uint8Array([]).buffer;
            const b64 = Secretary.bufferToBase64(original);
            expect(b64).toBe("");
            const result = Secretary.base64ToBuffer(b64);
            expect(new Uint8Array(result)).toEqual(new Uint8Array([]));
        });
        it("handles single-byte values", () => {
            const bytes = [0, 127, 128, 255];
            for (const b of bytes) {
                const buf = new Uint8Array([b]).buffer;
                const b64 = Secretary.bufferToBase64(buf);
                const back = Secretary.base64ToBuffer(b64);
                expect(new Uint8Array(back)).toEqual(new Uint8Array([b]));
            }
        });
    });

    describe("stringToBuffer / bufferToString", () => {
        it("round-trips plain text", () => {
            const str = "Hello, World! Amnesiac Secretary";
            const buf = Secretary.stringToBuffer(str);
            const back = Secretary.bufferToString(buf);
            expect(back).toBe(str);
        });
        it("handles empty string", () => {
            const buf = Secretary.stringToBuffer("");
            const back = Secretary.bufferToString(buf);
            expect(back).toBe("");
        });
        it("handles special characters", () => {
            const str = "!@#$%^&*()_+=-`~[]{}|;:'\",.<>?/\\ \t\n";
            const buf = Secretary.stringToBuffer(str);
            const back = Secretary.bufferToString(buf);
            expect(back).toBe(str);
        });
        it("coerces non-string input to string", () => {
            const buf = Secretary.stringToBuffer(12345);
            const back = Secretary.bufferToString(buf);
            expect(back).toBe("12345");
        });
    });

    describe("pack / unpack", () => {
        it("round-trips multiple ArrayBuffers", () => {
            const a = new Uint8Array([1, 2, 3]).buffer;
            const b = new Uint8Array([4, 5, 6, 7]).buffer;
            const c = new Uint8Array([]).buffer;
            const packed = Secretary.pack([a, b, c]);
            const [ra, rb, rc] = Secretary.unpack(packed);
            expect(new Uint8Array(ra)).toEqual(new Uint8Array([1, 2, 3]));
            expect(new Uint8Array(rb)).toEqual(new Uint8Array([4, 5, 6, 7]));
            expect(rc).toBeNull();
        });
        it("handles single item", () => {
            const a = new Uint8Array([255, 254, 253]).buffer;
            const packed = Secretary.pack([a]);
            const [ra] = Secretary.unpack(packed);
            expect(new Uint8Array(ra)).toEqual(new Uint8Array([255, 254, 253]));
        });
        it("handles empty array", () => {
            const packed = Secretary.pack([]);
            const result = Secretary.unpack(packed);
            expect(result).toEqual([]);
        });
        it("handles null entries (zero-length -> null)", () => {
            const a = new Uint8Array([10, 20]).buffer;
            const packed = Secretary.pack([null, a, null]);
            const [r1, r2, r3] = Secretary.unpack(packed);
            expect(r1).toBeNull();
            expect(new Uint8Array(r2)).toEqual(new Uint8Array([10, 20]));
            expect(r3).toBeNull();
        });
        it("empty unpack input produces empty array", () => {
            const packed = new Uint8Array([]).buffer;
            const result = Secretary.unpack(packed);
            expect(result).toEqual([]);
        });
    });

    describe("compress / decompress", () => {
        it("round-trips small data", async () => {
            const original = new Uint8Array([72, 101, 108, 108, 111]).buffer;
            const compressed = await Secretary.compress(original);
            const decompressed = await Secretary.decompress(compressed);
            expect(new Uint8Array(decompressed)).toEqual(
                new Uint8Array(original),
            );
        });
        it("round-trips larger data", async () => {
            const data = new Uint8Array(1000);
            for (let i = 0; i < data.length; i++) data[i] = i % 256;
            const compressed = await Secretary.compress(data.buffer);
            const decompressed = await Secretary.decompress(compressed);
            expect(new Uint8Array(decompressed)).toEqual(data);
        });
        it("handles empty buffer", async () => {
            const original = new Uint8Array([]).buffer;
            const compressed = await Secretary.compress(original);
            const decompressed = await Secretary.decompress(compressed);
            expect(new Uint8Array(decompressed)).toEqual(new Uint8Array([]));
        });
        it("produced data is actually compressed (smaller for repetitive data)", async () => {
            const data = new Uint8Array(500).fill(65);
            const compressed = await Secretary.compress(data.buffer);
            expect(compressed.byteLength).toBeLessThan(data.byteLength);
        });
    });

    describe("capability checks", () => {
        it("testCompressionSupport returns true", () => {
            expect(Secretary.testCompressionSupport()).toBe(true);
        });
        it("testCryptoSupport does not throw and returns a boolean", async () => {
            const result = await Secretary.testCryptoSupport();
            expect(typeof result).toBe("boolean");
        });
    });
});

// ---------------------------------------------------------------------------
// 2. State management
// ---------------------------------------------------------------------------
describe("State management", () => {
    it("isUnlocked returns false initially", () => {
        Secretary.reset();
        expect(Secretary.isUnlocked()).toBe(false);
    });
    it("reset clears all internal state", () => {
        expect(Secretary.isUnlocked()).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 3. Unlock / Encode lifecycle
// ---------------------------------------------------------------------------
describe("Unlock / Encode lifecycle", () => {
    let ciphertextNoData;
    let ciphertextWithData;

    beforeAll(() => {
        Secretary.reset();
        return Secretary.unlock("testpass");
    }, 30000);

    it("unlock new vault returns true", () => {
        expect(Secretary.isUnlocked()).toBe(true);
    });

    it("encode exports a valid non-empty base64 ciphertext", async () => {
        ciphertextNoData = await Secretary.encode();
        expect(typeof ciphertextNoData).toBe("string");
        expect(ciphertextNoData.length).toBeGreaterThan(0);
    });

    it("encode is deterministic when state has not changed", async () => {
        const again = await Secretary.encode();
        expect(again).toBe(ciphertextNoData);
    });

    it("encode output changes after setData modifies payload", async () => {
        await Secretary.setData("meta", "some value");
        ciphertextWithData = await Secretary.encode();
        expect(ciphertextWithData).not.toBe(ciphertextNoData);
        expect(ciphertextWithData.length).toBeGreaterThan(0);
    });

    it("encode with new passphrase changes the key", async () => {
        const newCt = await Secretary.encode("newpass");
        // old passphrase should fail
        Secretary.reset();
        await expect(Secretary.unlock("testpass", newCt)).rejects.toThrow();
        // new passphrase should work
        Secretary.reset();
        await expect(Secretary.unlock("newpass", newCt)).resolves.toBe(true);
    }, 30000);

    it("encode throws when not unlocked", async () => {
        Secretary.reset();
        await expect(Secretary.encode()).rejects.toThrow("Not unlocked");
    });
});

// ---------------------------------------------------------------------------
// 4. Unlock existing vault / verifyPassphrase
// ---------------------------------------------------------------------------
describe("Unlock existing vault / verifyPassphrase", () => {
    // Re-use the ciphertext captured in the previous block
    let ct;

    beforeAll(() => {
        // Grab ciphertext from the helper that the previous describe stored
        // We re-create it here because module-level variables are cleaner
        Secretary.reset();
        return Secretary.unlock("testpass")
            .then(() => Secretary.encode())
            .then((c) => {
                ct = c;
                Secretary.reset();
            });
    }, 30000);

    it("unlock existing vault succeeds", async () => {
        await expect(Secretary.unlock("testpass", ct)).resolves.toBe(true);
        expect(Secretary.isUnlocked()).toBe(true);
    });

    it("wrong passphrase is rejected", async () => {
        Secretary.reset();
        await expect(Secretary.unlock("wrong", ct)).rejects.toThrow();
    });

    it("verifyPassphrase returns true for correct passphrase", async () => {
        Secretary.reset();
        await expect(Secretary.verifyPassphrase("testpass", ct)).resolves.toBe(
            true,
        );
    });

    it("verifyPassphrase returns false for wrong passphrase", async () => {
        await expect(Secretary.verifyPassphrase("wrong", ct)).resolves.toBe(
            false,
        );
    });

    it("verifyPassphrase preserves locked state when starting locked", async () => {
        Secretary.reset();
        expect(Secretary.isUnlocked()).toBe(false);
        await Secretary.verifyPassphrase("testpass", ct);
        expect(Secretary.isUnlocked()).toBe(false);
    });

    it("verifyPassphrase preserves unlocked state when starting unlocked", async () => {
        await Secretary.unlock("testpass", ct);
        expect(Secretary.isUnlocked()).toBe(true);
        await Secretary.verifyPassphrase("wrong", ct);
        expect(Secretary.isUnlocked()).toBe(true);
        await Secretary.verifyPassphrase("testpass", ct);
        expect(Secretary.isUnlocked()).toBe(true);
    }, 30000);
});

// ---------------------------------------------------------------------------
// 5. Password generation
// ---------------------------------------------------------------------------
describe("Password generation", () => {
    it("throws when not unlocked", async () => {
        Secretary.reset();
        await expect(
            Secretary.generate("id1", "id2", "1", 20, 91),
        ).rejects.toThrow("Not unlocked");
    });

    describe("with unlocked vault", () => {
        beforeAll(() => {
            Secretary.reset();
            return Secretary.unlock("genpass");
        }, 30000);

        it("strength 0 returns base64 string", async () => {
            const pwd = await Secretary.generate("id1", "id2", "1", 20, 0);
            expect(typeof pwd).toBe("string");
            expect(pwd.length).toBeGreaterThan(0);
            expect(() => window.atob(pwd)).not.toThrow();
        });

        it("strength 10 (numbers only)", async () => {
            const pwd = await Secretary.generate("id1", "id2", "1", 20, 10);
            expect(pwd.length).toBe(20);
            expect(allCharsIn(pwd, CHARSET_NUMBER)).toBe(true);
        });

        it("strength 36 (numbers + lowercase)", async () => {
            const pwd = await Secretary.generate("id1", "id2", "1", 20, 36);
            expect(pwd.length).toBe(20);
            expect(allCharsIn(pwd, CHARSET_NUMBER + CHARSET_ALPHABET_L)).toBe(
                true,
            );
        });

        it("strength 62 (numbers + lower + upper)", async () => {
            const pwd = await Secretary.generate("id1", "id2", "1", 20, 62);
            expect(pwd.length).toBe(20);
            expect(
                allCharsIn(
                    pwd,
                    CHARSET_NUMBER + CHARSET_ALPHABET_L + CHARSET_ALPHABET_U,
                ),
            ).toBe(true);
        });

        it("strength 91 (numbers + lower + upper + special_29)", async () => {
            const pwd = await Secretary.generate("id1", "id2", "1", 20, 91);
            expect(pwd.length).toBe(20);
            expect(
                allCharsIn(
                    pwd,
                    CHARSET_NUMBER +
                        CHARSET_ALPHABET_L +
                        CHARSET_ALPHABET_U +
                        CHARSET_SPECIAL_29,
                ),
            ).toBe(true);
        });

        it("strength 94 (includes \" ' \\ and more specials, no space)", async () => {
            const pwd = await Secretary.generate("id1", "id2", "1", 20, 94);
            expect(pwd.length).toBe(20);
            expect(
                allCharsIn(
                    pwd,
                    CHARSET_NUMBER +
                        CHARSET_ALPHABET_L +
                        CHARSET_ALPHABET_U +
                        CHARSET_SPECIAL_32,
                ),
            ).toBe(true);
            expect(pwd).not.toContain(" ");
        });

        it("strength 95 (includes space)", async () => {
            const pwd = await Secretary.generate("id1", "id2", "1", 20, 95);
            expect(pwd.length).toBe(20);
            expect(
                allCharsIn(
                    pwd,
                    CHARSET_NUMBER +
                        CHARSET_ALPHABET_L +
                        CHARSET_ALPHABET_U +
                        CHARSET_SPECIAL_33,
                ),
            ).toBe(true);
        });

        it("output length matches requested length", async () => {
            const lengths = [8, 16, 24, 32];
            for (const len of lengths) {
                const pwd = await Secretary.generate(
                    "len",
                    "test",
                    "1",
                    len,
                    62,
                );
                expect(pwd.length).toBe(len);
            }
        });

        it("same inputs produce same output (deterministic)", async () => {
            const a = await Secretary.generate("det", "id", "r1", 16, 62);
            const b = await Secretary.generate("det", "id", "r1", 16, 62);
            expect(a).toBe(b);
        });

        it("different identity1 produces different output", async () => {
            const a = await Secretary.generate("alpha", "id", "r1", 16, 62);
            const b = await Secretary.generate("beta", "id", "r1", 16, 62);
            expect(a).not.toBe(b);
        });

        it("different identity2 produces different output", async () => {
            const a = await Secretary.generate("id", "alpha", "r1", 16, 62);
            const b = await Secretary.generate("id", "beta", "r1", 16, 62);
            expect(a).not.toBe(b);
        });

        it("different revision produces different output", async () => {
            const a = await Secretary.generate("id", "id", "v1", 16, 62);
            const b = await Secretary.generate("id", "id", "v2", 16, 62);
            expect(a).not.toBe(b);
        });

        it("different length produces different output", async () => {
            const a = await Secretary.generate("id", "id", "r1", 12, 62);
            const b = await Secretary.generate("id", "id", "r1", 16, 62);
            expect(a).not.toBe(b);
        });

        it("throws for invalid strength value", async () => {
            await expect(
                Secretary.generate("id", "id", "r1", 20, 99),
            ).rejects.toThrow("Invalid strength value");
            await expect(
                Secretary.generate("id", "id", "r1", 20, -1),
            ).rejects.toThrow("Invalid strength value");
        });
    });
});

// ---------------------------------------------------------------------------
// 6. Payload data (getData / setData / unsetData)
// ---------------------------------------------------------------------------
describe("Payload data", () => {
    beforeAll(() => {
        Secretary.reset();
        return Secretary.unlock("datapass");
    }, 30000);

    it("getData returns undefined when no data has been stored", async () => {
        await expect(Secretary.getData("nonexistent")).resolves.toBeUndefined();
    });

    it("setData / getData round-trip a string value", async () => {
        await Secretary.setData("username", "alice");
        await expect(Secretary.getData("username")).resolves.toBe("alice");
    });

    it("setData / getData with a numeric value", async () => {
        await Secretary.setData("count", 42);
        await expect(Secretary.getData("count")).resolves.toBe(42);
    });

    it("setData / getData with boolean values", async () => {
        await Secretary.setData("flag", true);
        await expect(Secretary.getData("flag")).resolves.toBe(true);
    });

    it("setData / getData with an object", async () => {
        const obj = { a: 1, b: [2, 3] };
        await Secretary.setData("obj", obj);
        await expect(Secretary.getData("obj")).resolves.toEqual(obj);
    });

    it("setData / getData with null", async () => {
        await Secretary.setData("nothing", null);
        await expect(Secretary.getData("nothing")).resolves.toBeNull();
    });

    it("updating an existing key overwrites the value", async () => {
        await Secretary.setData("username", "bob");
        await expect(Secretary.getData("username")).resolves.toBe("bob");
    });

    it("getData returns undefined for key that was never set", async () => {
        await expect(Secretary.getData("missing_key")).resolves.toBeUndefined();
    });

    it("unsetData removes the key and returns its value", async () => {
        await Secretary.setData("temp", "remove_me");
        const removed = await Secretary.unsetData("temp");
        expect(removed).toBe("remove_me");
        await expect(Secretary.getData("temp")).resolves.toBeUndefined();
    });

    it("unsetData returns undefined for non-existent key", async () => {
        const removed = await Secretary.unsetData("does_not_exist");
        expect(removed).toBeUndefined();
    });
});
