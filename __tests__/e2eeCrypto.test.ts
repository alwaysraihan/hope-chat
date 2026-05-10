/** Minimal Web Crypto shim for Jest (Hermes/RN provides real getRandomValues in-app). */
if (typeof global.crypto?.getRandomValues !== 'function') {
  (global as any).crypto = {
    getRandomValues(arr: Uint8Array) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  };
}

import {
  decryptMessagePayload,
  deriveConversationMessageKey,
  encryptMessagePayload,
} from '../src/services/e2ee/conversationCrypto';

describe('conversation E2EE envelope', () => {
  it('roundtrips text for the same conversation ids', () => {
    const key = deriveConversationMessageKey('user_a', 'user_b', 'chat-99');
    const enc = encryptMessagePayload('hello world', key);
    expect(enc.startsWith('HC1:')).toBe(true);
    expect(decryptMessagePayload(enc, key)).toBe('hello world');
  });

  it('matches independently of participant argument order', () => {
    const k1 = deriveConversationMessageKey('a', 'b', 'c');
    const k2 = deriveConversationMessageKey('b', 'a', 'c');
    expect(k1.length === k2.length && k1.every((b, i) => b === k2[i]!)).toBe(
      true,
    );
  });
});
