import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rpcUrl = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/dsi1THtX01kZlCl-eMP08';
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x3463331f0EAD5f654B19E669FABB7965AFE7495C';

console.log('RPC URL:', rpcUrl);
console.log('Contract Address:', contractAddress);

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const abi = JSON.parse(readFileSync(resolve(__dirname, '../lib/contracts/VotingV1.json'), 'utf8')).abi;
  const contract = new ethers.Contract(contractAddress, abi, provider);

  try {
    const guardians = await contract.getGuardians();
    console.log('Guardians on contract:', guardians);
  } catch (err) {
    console.error('Error fetching guardians:', err.message);
  }
}

main();
