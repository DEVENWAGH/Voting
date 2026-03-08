/**
 * Unit tests for WalletService
 */

import { expect } from "chai";
import { WalletService } from "../src/services/walletService.js";
import { ethers } from "ethers";

// Mock localStorage for Node.js environment
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }
}

// Set up global localStorage mock
global.localStorage = new LocalStorageMock();

// Mock crypto.subtle for Node.js environment if not available
if (!global.crypto) {
  const { webcrypto } = await import("crypto");
  global.crypto = webcrypto;
}

describe("WalletService", () => {
  let walletService;
  const testAadhaarHash =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const testAadhaarHash2 =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  beforeEach(() => {
    walletService = new WalletService();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up localStorage after each test
    localStorage.clear();
  });

  describe("createWallet", () => {
    it("should create a new wallet and return address and encrypted private key", async () => {
      const result = await walletService.createWallet(testAadhaarHash);

      expect(result).to.have.property("address");
      expect(result).to.have.property("encryptedPrivateKey");
      expect(result.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(result.encryptedPrivateKey).to.be.a("string");
      expect(result.encryptedPrivateKey.length).to.be.greaterThan(0);
    });

    it("should store wallet in localStorage", async () => {
      await walletService.createWallet(testAadhaarHash);

      const storageKey = "wallet_" + testAadhaarHash;
      const storedData = localStorage.getItem(storageKey);

      expect(storedData).to.not.be.null;
      const walletData = JSON.parse(storedData);
      expect(walletData).to.have.property("address");
      expect(walletData).to.have.property("encryptedPrivateKey");
      expect(walletData).to.have.property("createdAt");
    });

    it("should throw error if aadhaarHash is not provided", async () => {
      try {
        await walletService.createWallet();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Aadhaar hash is required");
      }

      try {
        await walletService.createWallet("");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Aadhaar hash is required");
      }
    });

    it("should throw error if wallet already exists", async () => {
      await walletService.createWallet(testAadhaarHash);

      try {
        await walletService.createWallet(testAadhaarHash);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Wallet already exists");
      }
    });

    it("should create different wallets for different Aadhaar hashes", async () => {
      const wallet1 = await walletService.createWallet(testAadhaarHash);
      const wallet2 = await walletService.createWallet(testAadhaarHash2);

      expect(wallet1.address).to.not.equal(wallet2.address);
      expect(wallet1.encryptedPrivateKey).to.not.equal(
        wallet2.encryptedPrivateKey,
      );
    });
  });

  describe("getWallet", () => {
    it("should retrieve and decrypt wallet", async () => {
      const created = await walletService.createWallet(testAadhaarHash);
      const wallet = await walletService.getWallet(testAadhaarHash);

      expect(wallet).to.be.instanceOf(ethers.Wallet);
      expect(wallet.address).to.equal(created.address);
      expect(wallet.privateKey).to.be.a("string");
    });

    it("should throw error if aadhaarHash is not provided", async () => {
      try {
        await walletService.getWallet();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Aadhaar hash is required");
      }

      try {
        await walletService.getWallet("");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Aadhaar hash is required");
      }
    });

    it("should throw error if wallet does not exist", async () => {
      try {
        await walletService.getWallet(testAadhaarHash);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Wallet not found");
      }
    });

    it("should throw error if decryption fails with wrong aadhaarHash", async () => {
      await walletService.createWallet(testAadhaarHash);

      try {
        await walletService.getWallet(testAadhaarHash2);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.be.a("string");
      }
    });

    it("should return wallet with valid private key that can sign", async () => {
      await walletService.createWallet(testAadhaarHash);
      const wallet = await walletService.getWallet(testAadhaarHash);

      const message = "Test message";
      const signature = await wallet.signMessage(message);

      expect(signature).to.be.a("string");
      expect(signature).to.match(/^0x[a-fA-F0-9]{130}$/);

      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      expect(recoveredAddress).to.equal(wallet.address);
    });
  });

  describe("walletExists", () => {
    it("should return true if wallet exists", async () => {
      await walletService.createWallet(testAadhaarHash);

      const exists = walletService.walletExists(testAadhaarHash);
      expect(exists).to.be.true;
    });

    it("should return false if wallet does not exist", () => {
      const exists = walletService.walletExists(testAadhaarHash);
      expect(exists).to.be.false;
    });

    it("should return false if aadhaarHash is not provided", () => {
      expect(walletService.walletExists()).to.be.false;
      expect(walletService.walletExists("")).to.be.false;
      expect(walletService.walletExists(null)).to.be.false;
    });

    it("should return false after wallet is removed", async () => {
      await walletService.createWallet(testAadhaarHash);
      expect(walletService.walletExists(testAadhaarHash)).to.be.true;

      walletService.removeWallet(testAadhaarHash);
      expect(walletService.walletExists(testAadhaarHash)).to.be.false;
    });
  });

  describe("getWalletAddress", () => {
    it("should return wallet address without decryption", async () => {
      const created = await walletService.createWallet(testAadhaarHash);
      const address = walletService.getWalletAddress(testAadhaarHash);

      expect(address).to.equal(created.address);
      expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should return null if wallet does not exist", () => {
      const address = walletService.getWalletAddress(testAadhaarHash);
      expect(address).to.be.null;
    });

    it("should return null if aadhaarHash is not provided", () => {
      expect(walletService.getWalletAddress()).to.be.null;
      expect(walletService.getWalletAddress("")).to.be.null;
      expect(walletService.getWalletAddress(null)).to.be.null;
    });
  });

  describe("removeWallet", () => {
    it("should remove wallet from localStorage", async () => {
      await walletService.createWallet(testAadhaarHash);
      expect(walletService.walletExists(testAadhaarHash)).to.be.true;

      walletService.removeWallet(testAadhaarHash);
      expect(walletService.walletExists(testAadhaarHash)).to.be.false;
    });

    it("should not throw error if wallet does not exist", () => {
      expect(() => walletService.removeWallet(testAadhaarHash)).to.not.throw();
    });

    it("should not throw error if aadhaarHash is not provided", () => {
      expect(() => walletService.removeWallet()).to.not.throw();
      expect(() => walletService.removeWallet("")).to.not.throw();
      expect(() => walletService.removeWallet(null)).to.not.throw();
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete wallet lifecycle", async () => {
      // Create wallet
      const created = await walletService.createWallet(testAadhaarHash);
      expect(created.address).to.be.a("string");

      // Check existence
      expect(walletService.walletExists(testAadhaarHash)).to.be.true;

      // Get address without decryption
      const address = walletService.getWalletAddress(testAadhaarHash);
      expect(address).to.equal(created.address);

      // Get full wallet
      const wallet = await walletService.getWallet(testAadhaarHash);
      expect(wallet.address).to.equal(created.address);

      // Remove wallet
      walletService.removeWallet(testAadhaarHash);
      expect(walletService.walletExists(testAadhaarHash)).to.be.false;
    });

    it("should handle multiple wallets independently", async () => {
      const wallet1 = await walletService.createWallet(testAadhaarHash);
      const wallet2 = await walletService.createWallet(testAadhaarHash2);

      expect(walletService.walletExists(testAadhaarHash)).to.be.true;
      expect(walletService.walletExists(testAadhaarHash2)).to.be.true;

      const retrieved1 = await walletService.getWallet(testAadhaarHash);
      const retrieved2 = await walletService.getWallet(testAadhaarHash2);

      expect(retrieved1.address).to.equal(wallet1.address);
      expect(retrieved2.address).to.equal(wallet2.address);

      walletService.removeWallet(testAadhaarHash);
      expect(walletService.walletExists(testAadhaarHash)).to.be.false;
      expect(walletService.walletExists(testAadhaarHash2)).to.be.true;
    });
  });

  describe("Edge cases", () => {
    it("should handle corrupted localStorage data gracefully", async () => {
      const storageKey = "wallet_" + testAadhaarHash;
      localStorage.setItem(storageKey, "invalid json");

      try {
        await walletService.getWallet(testAadhaarHash);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.be.a("string");
      }
    });

    it("should handle missing fields in stored data", async () => {
      const storageKey = "wallet_" + testAadhaarHash;
      localStorage.setItem(storageKey, JSON.stringify({ address: "0x123" }));

      try {
        await walletService.getWallet(testAadhaarHash);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.be.a("string");
      }
    });
  });
});
