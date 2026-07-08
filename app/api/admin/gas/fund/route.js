import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST() {
  try {
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Relayer address: derived from ADMIN_RELAY_PRIVATE_KEY or ADMIN_RELAY_ADDRESS
    const relayerPrivateKey = process.env.ADMIN_RELAY_PRIVATE_KEY;
    let relayerAddress = process.env.ADMIN_RELAY_ADDRESS;
    if (relayerPrivateKey && !relayerAddress) {
      const wallet = new ethers.Wallet(relayerPrivateKey);
      relayerAddress = wallet.address;
    }
    if (!relayerAddress) {
      relayerAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    }

    // Deployer/Gas Station address: derived from DEPLOYER_PRIVATE_KEY
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!deployerPrivateKey) {
      return NextResponse.json({ error: 'Deployer private key not configured' }, { status: 400 });
    }

    const deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
    const deployerAddress = deployerWallet.address;

    // Check if they are the same wallet (e.g. Sepolia configured with same key)
    if (deployerAddress.toLowerCase() === relayerAddress.toLowerCase()) {
      return NextResponse.json({
        success: true,
        message: 'Deployer and Relayer use the same wallet address on Sepolia. Please fund the wallet manually if needed.',
      });
    }

    // Transfer 5.0 ETH from Deployer to Relayer (for local nodes or funded deployer accounts)
    try {
      const tx = await deployerWallet.sendTransaction({
        to: relayerAddress,
        value: ethers.parseEther('5.0'),
      });
      await tx.wait();
      return NextResponse.json({
        success: true,
        message: `Successfully transferred 5.0 ETH from Deployer to Relayer! Tx: ${tx.hash}`,
      });
    } catch (err) {
      console.warn('Auto-transfer failed:', err.message);
      return NextResponse.json({
        error: `Could not auto-transfer: ${err.message}. Please fund ${relayerAddress} manually.`,
      }, { status: 500 });
    }
  } catch (err) {
    console.error('[api/admin/gas/fund POST]', err);
    return NextResponse.json({ error: err.message || 'Funding failed' }, { status: 500 });
  }
}
