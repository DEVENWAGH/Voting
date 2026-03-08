import { ethers } from 'ethers';

const PBKDF2_ITERATIONS = 100000;

async function deriveKey(aadhaarHash, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(aadhaarHash),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function generateSecureWallet() {
  return ethers.Wallet.createRandom();
}

export async function encryptPrivateKey(privateKey, aadhaarHash) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(aadhaarHash, salt);

  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(privateKey)
  );

  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return Buffer.from(combined).toString('base64');
}

export async function decryptPrivateKey(encryptedData, aadhaarHash) {
  try {
    const combined = Buffer.from(encryptedData, 'base64');
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);

    const key = await deriveKey(aadhaarHash, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Decryption failed: Invalid key or corrupted data');
  }
}

export async function createEncryptedWallet(aadhaarHash) {
  const wallet = generateSecureWallet();
  const encryptedPrivateKey = await encryptPrivateKey(wallet.privateKey, aadhaarHash);
  return { address: wallet.address, encryptedPrivateKey };
}

export async function restoreWalletFromEncrypted(encryptedPrivateKey, aadhaarHash) {
  try {
    const privateKey = await decryptPrivateKey(encryptedPrivateKey, aadhaarHash);
    return new ethers.Wallet(privateKey);
  } catch {
    throw new Error('Wallet restoration failed: Invalid key or corrupted data');
  }
}
