/**
 * GET  /api/relay/status  — relay wallet balance + address
 * POST /api/relay/vote    — gasless vote (called by verify-otp internally, can also be direct)
 */
import { NextResponse } from 'next/server';
import { getRelayBalance, getRelayAddress } from '@/lib/relay';

export async function GET() {
  try {
    const [address, balance] = await Promise.all([
      getRelayAddress(),
      getRelayBalance(),
    ]);
    return NextResponse.json({ address, balanceETH: balance });
  } catch (err) {
    console.error('[relay/status]', err);
    return NextResponse.json({ error: 'Could not reach blockchain node' }, { status: 503 });
  }
}
