import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
    const implementationAddress = process.env.CONTRACT_IMPL_ADDRESS || '';

    // Standard parameters for VotingV1 contract
    const guardiansCount = 3;
    const threshold = 2;

    return NextResponse.json({
      contractAddress,
      implementationAddress,
      guardiansCount,
      threshold,
    });
  } catch (err) {
    console.error('[api/admin/governance GET]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch governance parameters' }, { status: 500 });
  }
}
