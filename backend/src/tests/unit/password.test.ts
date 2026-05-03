import { validatePasswordPolicy, hashPassword, verifyPassword, isPasswordExpired } from '../../utils/password';

describe('validatePasswordPolicy', () => {
  it('accepts a valid password', () => {
    expect(validatePasswordPolicy('SecurePass@123!').valid).toBe(true);
  });

  it('rejects passwords shorter than 12 chars', () => {
    const r = validatePasswordPolicy('Short@1A');
    expect(r.valid).toBe(false);
    expect(r.message).toMatch(/12 characters/);
  });

  it('rejects passwords without uppercase', () => {
    expect(validatePasswordPolicy('lowercase@12345!').valid).toBe(false);
  });

  it('rejects passwords without lowercase', () => {
    expect(validatePasswordPolicy('UPPERCASE@12345!').valid).toBe(false);
  });

  it('rejects passwords without a digit', () => {
    expect(validatePasswordPolicy('NoDigitHere@ABC!').valid).toBe(false);
  });

  it('rejects passwords without a special character', () => {
    expect(validatePasswordPolicy('NoSpecialChar12A').valid).toBe(false);
  });
});

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a password round-trip', async () => {
    const password = 'SecurePass@123!';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});

describe('isPasswordExpired', () => {
  it('returns true when passwordChangedAt is null', () => {
    expect(isPasswordExpired(null)).toBe(true);
  });

  it('returns false for a recent password change', () => {
    expect(isPasswordExpired(new Date())).toBe(false);
  });

  it('returns true when password is older than 90 days', () => {
    const old = new Date();
    old.setDate(old.getDate() - 91);
    expect(isPasswordExpired(old)).toBe(true);
  });
});
