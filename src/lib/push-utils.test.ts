import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "./push-utils";

describe("urlBase64ToUint8Array", () => {
  it("decodes a URL-safe base64 string with no padding needed", () => {
    // "AB" decoded from base64 -> byte 0x41 ("A" as a code point is 65, but
    // "AB" as base64 text decodes to the bytes for length-2 input — verified
    // against Buffer's own decoding below rather than hand-computed, since
    // base64 padding math is exactly the kind of thing worth double-checking
    // against a known-good implementation instead of by hand.
    const input = "SGVsbG8"; // "Hello" without its trailing "=" padding
    const result = urlBase64ToUint8Array(input);
    expect(Buffer.from(result).toString("utf-8")).toBe("Hello");
  });

  it("converts URL-safe characters (- and _) back to standard base64 (+ and /)", () => {
    // Bytes 0xFB 0xFF 0xBF standard-base64-encode to "+/+/" — url-safe
    // base64 encodes the same bytes as "-_-_".
    const standard = Buffer.from([0xfb, 0xff, 0xbf]).toString("base64"); // "+/+/"
    const urlSafe = standard.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const result = urlBase64ToUint8Array(urlSafe);
    expect(Array.from(result)).toEqual([0xfb, 0xff, 0xbf]);
  });

  it("produces the correct byte length for a realistic VAPID-key-sized input", () => {
    // Real VAPID public keys are 65 raw bytes (an uncompressed P-256 EC
    // point), which base64-encodes to 87-88 characters depending on padding.
    const rawBytes = new Uint8Array(65).fill(7);
    const base64 = Buffer.from(rawBytes).toString("base64url");
    const result = urlBase64ToUint8Array(base64);
    expect(result.length).toBe(65);
    expect(Array.from(result)).toEqual(Array.from(rawBytes));
  });

  it("round-trips arbitrary binary data exactly", () => {
    const original = new Uint8Array([0, 1, 2, 253, 254, 255, 128, 64]);
    const base64 = Buffer.from(original).toString("base64url");
    const result = urlBase64ToUint8Array(base64);
    expect(Array.from(result)).toEqual(Array.from(original));
  });
});
