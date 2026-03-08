import { ethers } from 'ethers';
import { createEncryptedWallet, restoreWalletFromEncrypted } from '../utils/encryptionUtils.js';

const STORAGE_KEY_PREFIX = 'wallet_';

export class WalletService {
  _key(aadhaarHash) {
    return STORAGE_KEY_PREFIX + aadhaarHash;
  }

  async createWallet(aadhaarHash) {
    if (!aadhaarHash) {
      throw new Error('Aadhaar hash is required');
    }
    if (this.walletExists(aadhaarHash)) {
      throw new Error('Wallet already exists for this Aadhaar hash');
    }

    const { address, encryptedPrivateKey } = await createEncryptedWallet(aadhaarHash);
    const walletData = { address, encryptedPrivateKey, createdAt: new Date().toISOString() };
    localStorage.setItem(this._key(aadhaarHash), JSON.stringify(walletData));
    return { address, encryptedPrivateKey };
  }

  async getWallet(aadhaarHash) {
    if (!aadhaarHash) {
      throw new Error('Aadhaar hash is required');
    }
    const stored = localStorage.getItem(this._key(aadhaarHash));
    if (!stored) {
      throw new Error('Wallet not found for this Aadhaar hash');
    }
    const walletData = JSON.parse(stored);
    return restoreWalletFromEncrypted(walletData.encryptedPrivateKey, aadhaarHash);
  }

  walletExists(aadhaarHash) {
    if (!aadhaarHash) return false;
    return localStorage.getItem(this._key(aadhaarHash)) !== null;
  }

  getWalletAddress(aadhaarHash) {
    if (!aadhaarHash) return null;
    const stored = localStorage.getItem(this._key(aadhaarHash));
    if (!stored) return null;
    try {
      return JSON.parse(stored).address;
    } catch {
      return null;
    }
  }

  removeWallet(aadhaarHash) {
    if (!aadhaarHash) return;
    localStorage.removeItem(this._key(aadhaarHash));
  }
}

export default new WalletService();
