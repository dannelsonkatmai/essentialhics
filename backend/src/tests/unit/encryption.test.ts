// Encryption tests — uses a test key, not the real config
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32-byte hex

import { encrypt, decrypt, encryptArray, decryptArray } from '../../utils/encryption';

describe('AES-256-GCM encryption', () => {
  it('encrypts and decrypts a string round-trip', () => {
    const plain = 'supersecret-mfa-seed-BASE32ENCODED==';
    const ciphertext = encrypt(plain);
    expect(ciphertext).not.toBe(plain);
    expect(decrypt(ciphertext)).toBe(plain);
  });

  it('produces different ciphertexts each time (random IV)', () => {
    const plain = 'hello';
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it('throws on tampered ciphertext', () => {
    const cipher = encrypt('important');
    const tampered = Buffer.from(cipher, 'base64');
    tampered[20] ^= 0xff; // flip a byte
    expect(() => decrypt(tampered.toString('base64'))).toThrow();
  });

  it('handles arrays', () => {
    const codes = ['ABCDE-12345', 'FGHIJ-67890'];
    const encrypted = encryptArray(codes);
    expect(decryptArray(encrypted)).toEqual(codes);
  });
});
