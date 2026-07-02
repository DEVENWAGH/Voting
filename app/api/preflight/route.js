/**
 * POST /api/preflight
 * Edge Pre-flight Validation Endpoint
 * 
 * Validates a vote attempt BEFORE it hits the blockchain.
 * This prevents wasted gas fees on invalid transactions.
 * 
 * In production, this runs on CloudFront Lambda@Edge with DynamoDB
 * Global Tables for sub-10ms latency at the edge closest to the voter.
 * 
 * Body: { nullifierHash, electionId }
 * Returns: { allowed, reason, code, latencyMs, cached }
 */
import { NextResponse } from 'next/server';
import { preflightCheck } from '@/lib/preflightCache';

export async function POST(request) {
  try {
    const { nullifierHash, electionId } = await request.json();

    if (!nullifierHash || electionId === undefined) {
      return NextResponse.json(
        {
          allowed: false,
          reason: 'Missing required fields: nullifierHash, electionId',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    const result = await preflightCheck(nullifierHash, Number(electionId));

    return NextResponse.json(result, {
      status: result.allowed ? 200 : 403,
      headers: {
        // Simulate edge cache headers
        'X-Preflight-Cache': 'HIT',
        'X-Preflight-Latency': `${result.latencyMs}ms`,
        'X-Edge-Location': 'local-dev',
      },
    });
  } catch (err) {
    console.error('[preflight]', err);
    return NextResponse.json(
      {
        allowed: true, // Fail-open: don't block legitimate voters on error
        reason: 'Pre-flight check unavailable, proceeding to blockchain.',
        code: 'PREFLIGHT_ERROR',
        error: err.message,
      },
      { status: 200 }
    );
  }
}
