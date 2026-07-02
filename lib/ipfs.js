/**
 * lib/ipfs.js
 * Pinata IPFS utility — pin JSON and files to IPFS via Pinata API.
 *
 * Usage:
 *   import { pinJSON, pinFile, getIPFSUrl } from '@/lib/ipfs';
 *
 *   const cid = await pinJSON({ type: 'voter-list', data: [...] }, 'voter-list-election-0');
 *   const url = getIPFSUrl(cid);
 */

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
const PINATA_GATEWAY =
  process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs";

if (!PINATA_JWT) {
  console.warn("[ipfs] PINATA_JWT not set — IPFS pinning will fail at runtime");
}

/**
 * Pin a JSON object to IPFS via Pinata.
 * Returns the IPFS CID (content identifier) string.
 *
 * @param {object} jsonData  — the object to pin
 * @param {string} name      — human-readable name shown in Pinata dashboard
 * @param {object} metadata  — optional key/value metadata attached to the pin
 * @returns {Promise<string>} CID
 */
export async function pinJSON(
  jsonData,
  name = "block-vote-data",
  metadata = {},
) {
  const body = {
    pinataContent: jsonData,
    pinataMetadata: { name, keyvalues: metadata },
    pinataOptions: { cidVersion: 1 },
  };

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata pinJSON failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.IpfsHash; // CID
}

/**
 * Pin a file (Buffer or Blob) to IPFS via Pinata.
 * Returns the IPFS CID.
 *
 * @param {Buffer|Blob} fileBuffer — raw file bytes
 * @param {string} fileName        — filename for the pin
 * @param {string} mimeType        — MIME type of the file
 * @param {object} metadata        — optional key/value metadata
 * @returns {Promise<string>} CID
 */
export async function pinFile(
  fileBuffer,
  fileName,
  mimeType = "application/octet-stream",
  metadata = {},
) {
  const formData = new FormData();

  const blob =
    fileBuffer instanceof Blob
      ? fileBuffer
      : new Blob([fileBuffer], { type: mimeType });

  formData.append("file", blob, fileName);
  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: fileName, keyvalues: metadata }),
  );
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata pinFile failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.IpfsHash; // CID
}

/**
 * Fetch and return the JSON content of an IPFS CID.
 * Uses the Pinata gateway by default.
 *
 * @param {string} cid
 * @returns {Promise<object>}
 */
export async function fetchFromIPFS(cid) {
  const url = `${PINATA_GATEWAY}/${cid}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`IPFS fetch failed for CID ${cid}: ${res.status}`);
  return res.json();
}

/**
 * Returns a publicly accessible IPFS gateway URL for a given CID.
 *
 * @param {string} cid
 * @returns {string}
 */
export function getIPFSUrl(cid) {
  if (!cid) return "";
  return `${PINATA_GATEWAY}/${cid}`;
}

/**
 * Unpin a CID from Pinata (frees storage quota).
 *
 * @param {string} cid
 * @returns {Promise<void>}
 */
export async function unpin(cid) {
  const res = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
  });
  if (!res.ok) {
    const err = await res.text();
    console.warn(`[ipfs] unpin failed for ${cid}: ${err}`);
  }
}
