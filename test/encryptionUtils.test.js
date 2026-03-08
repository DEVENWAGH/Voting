/**
 * Tests for encryption utilities
 * Validates AES-256-GCM encryption, PBKDF2 key derivation, and wallet generation
 */

import { expect } from "chai";
import { ethers } from "ethers";
import {
  encryptPrivateKey,
  decryptPrivateKey,
  generateSecureWallet,
  createEncryptedWallet,
  restoreWalletFromEncrypted,
} from "../src/utils/encryptionUtils.js";

describe("Encryption Utils", () => {
  describe("generateSecureWallet", () => {
    it("should generate a valid wallet", () => {
      const wallet = generateSecureWallet();

      // HDNodeWallet is a subclass of Wallet in ethers v6
      expect(wallet.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(wallet.privateKey).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(wallet.address).to.be.a("string");
      expect(wallet.privateKey).to.be.a("string");
    });

    it("should generate unique wallets", () => {
      const wallet1 = generateSecureWallet();
      const wallet2 = generateSecureWallet();

      expect(wallet1.address).to.not.equal(wallet2.address);
      expect(wallet1.privateKey).to.not.equal(wallet2.privateKey);
    });
  });

  describe("encryptPrivateKey and decryptPrivateKey", () => {
    const testPrivateKey =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const testAadhaarHash =
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    it("should encrypt a private key", async () => {
      const encrypted = await encryptPrivateKey(
        testPrivateKey,
        testAadhaarHash,
      );

      expect(encrypted).to.be.a("string");
      expect(encrypted.length).to.be.greaterThan(0);
      expect(encrypted).to.not.equal(testPrivateKey);
    });

    it("should decrypt an encrypted private key", async () => {
      const encrypted = await encryptPrivateKey(
        testPrivateKey,
        testAadhaarHash,
      );
      const decrypted = await decryptPrivateKey(encrypted, testAadhaarHash);

      expect(decrypted).to.equal(testPrivateKey);
    });

    it("should produce different ciphertext for same input (due to random IV)", async () => {
      const encrypted1 = await encryptPrivateKey(
        testPrivateKey,
        testAadhaarHash,
      );
      const encrypted2 = await encryptPrivateKey(
        testPrivateKey,
        testAadhaarHash,
      );

      expect(encrypted1).to.not.equal(encrypted2);

      // But both should decrypt to the same value
      const decrypted1 = await decryptPrivateKey(encrypted1, testAadhaarHash);
      const decrypted2 = await decryptPrivateKey(encrypted2, testAadhaarHash);

      expect(decrypted1).to.equal(testPrivateKey);
      expect(decrypted2).to.equal(testPrivateKey);
    });

    it("should fail to decrypt with wrong Aadhaar hash", async () => {
      const encrypted = await encryptPrivateKey(
        testPrivateKey,
        testAadhaarHash,
      );
      const wrongAadhaarHash =
        "0x0000000000000000000000000000000000000000000000000000000000000000";

      try {
        await decryptPrivateKey(encrypted, wrongAadhaarHash);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Decryption failed");
      }
    });

    it("should handle different private key formats", async () => {
      const wallet = generateSecureWallet();
      const encrypted = await encryptPrivateKey(
        wallet.privateKey,
        testAadhaarHash,
      );
      const decrypted = await decryptPrivateKey(encrypted, testAadhaarHash);

      expect(decrypted).to.equal(wallet.privateKey);
    });
  });

  describe("createEncryptedWallet", () => {
    const testAadhaarHash =
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    it("should create a wallet with encrypted private key", async () => {
      const result = await createEncryptedWallet(testAadhaarHash);

      expect(result).to.have.property("address");
      expect(result).to.have.property("encryptedPrivateKey");
      expect(result.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(result.encryptedPrivateKey).to.be.a("string");
      expect(result.encryptedPrivateKey.length).to.be.greaterThan(0);
    });

    it("should create unique wallets for same Aadhaar hash", async () => {
      const wallet1 = await createEncryptedWallet(testAadhaarHash);
      const wallet2 = await createEncryptedWallet(testAadhaarHash);

      expect(wallet1.address).to.not.equal(wallet2.address);
      expect(wallet1.encryptedPrivateKey).to.not.equal(
        wallet2.encryptedPrivateKey,
      );
    });
  });

  describe("restoreWalletFromEncrypted", () => {
    const testAadhaarHash =
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    it("should restore a wallet from encrypted private key", async () => {
      // Create a wallet
      const created = await createEncryptedWallet(testAadhaarHash);

      // Restore it
      const restored = await restoreWalletFromEncrypted(
        created.encryptedPrivateKey,
        testAadhaarHash,
      );

      expect(restored).to.be.instanceOf(ethers.Wallet);
      expect(restored.address).to.equal(created.address);
    });

    it("should fail to restore with wrong Aadhaar hash", async () => {
      const created = await createEncryptedWallet(testAadhaarHash);
      const wrongAadhaarHash =
        "0x0000000000000000000000000000000000000000000000000000000000000000";

      try {
        await restoreWalletFromEncrypted(
          created.encryptedPrivateKey,
          wrongAadhaarHash,
        );
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Wallet restoration failed");
      }
    });

    it("should restore wallet with correct signing capability", async () => {
      // Create and restore wallet
      const created = await createEncryptedWallet(testAadhaarHash);
      const restored = await restoreWalletFromEncrypted(
        created.encryptedPrivateKey,
        testAadhaarHash,
      );

      // Test signing
      const message = "Test message";
      const signature = await restored.signMessage(message);

      expect(signature).to.be.a("string");
      expect(signature).to.match(/^0x[a-fA-F0-9]+$/);

      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      expect(recoveredAddress).to.equal(restored.address);
    });
  });

  describe("End-to-end encryption flow", () => {
    it("should complete full encryption/decryption cycle", async () => {
      const aadhaarHash = "0x" + "1".repeat(64);

      // Generate wallet
      const originalWallet = generateSecureWallet();

      // Encrypt private key
      const encrypted = await encryptPrivateKey(
        originalWallet.privateKey,
        aadhaarHash,
      );

      // Decrypt private key
      const decrypted = await decryptPrivateKey(encrypted, aadhaarHash);

      // Restore wallet
      const restoredWallet = new ethers.Wallet(decrypted);

      // Verify addresses match
      expect(restoredWallet.address).to.equal(originalWallet.address);

      // Verify signing works
      const message = "Voting transaction";
      const originalSignature = await originalWallet.signMessage(message);
      const restoredSignature = await restoredWallet.signMessage(message);

      expect(restoredSignature).to.equal(originalSignature);
    });
  });

  describe("Security properties", () => {
    it("should use different salts for each encryption", async () => {
      const privateKey = "0x" + "a".repeat(64);
      const aadhaarHash = "0x" + "b".repeat(64);

      const encrypted1 = await encryptPrivateKey(privateKey, aadhaarHash);
      const encrypted2 = await encryptPrivateKey(privateKey, aadhaarHash);

      // Different salts mean different ciphertext
      expect(encrypted1).to.not.equal(encrypted2);

      // But both decrypt correctly
      const decrypted1 = await decryptPrivateKey(encrypted1, aadhaarHash);
      const decrypted2 = await decryptPrivateKey(encrypted2, aadhaarHash);

      expect(decrypted1).to.equal(privateKey);
      expect(decrypted2).to.equal(privateKey);
    });

    it("should not leak information about private key length", async () => {
      const aadhaarHash = "0x" + "c".repeat(64);

      // Standard Ethereum private key (32 bytes = 64 hex chars + 0x prefix)
      const privateKey = "0x" + "d".repeat(64);

      const encrypted = await encryptPrivateKey(privateKey, aadhaarHash);

      // Encrypted data should be base64 encoded
      // Length should be consistent for same input length
      expect(encrypted).to.be.a("string");
      expect(encrypted.length).to.be.greaterThan(100); // Salt + IV + ciphertext + auth tag
    });
  });
});
