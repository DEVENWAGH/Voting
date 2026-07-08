/**
 * GET    /api/relay/transactions — relay gas history and analytics
 * DELETE /api/relay/transactions — clear history (guardian only)
 */
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import connectDB from '@/lib/db';
import RelayTransaction from '@/lib/models/RelayTransaction';
import { getRelayBalance, getRelayAddress } from '@/lib/relay';

async function isGuardianAddress(address) {
  if (!address || !ethers.isAddress(address)) return false;
  const normalized = address.toLowerCase();
  const envGuardians = [
    process.env.ADMIN_RELAY_ADDRESS,
    process.env.GUARDIAN_1_ADDRESS,
    process.env.GUARDIAN_2_ADDRESS,
    process.env.GUARDIAN_3_ADDRESS,
  ]
    .filter(Boolean)
    .map((a) => a.toLowerCase());
  if (envGuardians.includes(normalized)) return true;

  try {
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!contractAddress) return false;
    const abi = (await import('@/lib/contracts/VotingV1.json')).default.abi;
    const provider = new ethers.JsonRpcProvider(
      process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL,
    );
    const contract = new ethers.Contract(contractAddress, abi, provider);
    const onChain = await contract.getGuardians();
    return onChain.some((g) => g.toLowerCase() === normalized);
  } catch {
    return false;
  }
}

export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);
    const op = searchParams.get('op');

    const filter = op ? { operation: op } : {};
    const skip = (page - 1) * limit;

    const [transactions, total, byOperation, dailySpend, address, balance] = await Promise.all([
      RelayTransaction.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RelayTransaction.countDocuments(filter),
      RelayTransaction.aggregate([
        {
          $group: {
            _id: '$operation',
            count: { $sum: 1 },
            totalGasEth: { $sum: { $toDouble: '$gasCostEth' } },
          },
        },
        { $sort: { totalGasEth: -1 } },
      ]),
      RelayTransaction.aggregate([
        {
          $match: {
            timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
            gasEth: { $sum: { $toDouble: '$gasCostEth' } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      getRelayAddress(),
      getRelayBalance(),
    ]);

    const allTimeAgg = await RelayTransaction.aggregate([
      {
        $group: {
          _id: null,
          totalGasEth: { $sum: { $toDouble: '$gasCostEth' } },
          totalTx: { $sum: 1 },
          avgGasEth: { $avg: { $toDouble: '$gasCostEth' } },
        },
      },
    ]);
    const allTime = allTimeAgg[0] || { totalGasEth: 0, totalTx: 0, avgGasEth: 0 };

    const last24hAgg = await RelayTransaction.aggregate([
      { $match: { timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: null,
          totalGasEth: { $sum: { $toDouble: '$gasCostEth' } },
          count: { $sum: 1 },
        },
      },
    ]);
    const last24h = last24hAgg[0] || { totalGasEth: 0, count: 0 };

    return NextResponse.json({
      address,
      balance,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      analytics: {
        totalGasSpentEth: Number(allTime.totalGasEth.toFixed(8)),
        totalTransactions: allTime.totalTx,
        avgGasPerTxEth: Number((allTime.avgGasEth || 0).toFixed(8)),
        last24hGasEth: Number(last24h.totalGasEth.toFixed(8)),
        last24hTxCount: last24h.count,
        byOperation: byOperation.map((r) => ({
          operation: r._id,
          count: r.count,
          totalGasEth: Number(r.totalGasEth.toFixed(8)),
        })),
        dailySpend: dailySpend.map((d) => ({
          date: d._id,
          count: d.count,
          gasEth: Number(d.gasEth.toFixed(8)),
        })),
      },
      transactions: transactions.map((t) => ({
        txHash: t.txHash,
        blockNumber: t.blockNumber,
        operation: t.operation,
        electionId: t.electionId,
        orgSlug: t.orgSlug,
        gasUsed: t.gasUsed,
        gasPrice: t.gasPrice,
        gasCostEth: t.gasCostEth,
        timestamp: t.timestamp,
        metadata: t.metadata,
      })),
    });
  } catch (err) {
    console.error('[relay/transactions]', err);
    return NextResponse.json({ error: err.message || 'Failed to load relay transactions' }, { status: 500 });
  }
}

/** Clear relay transaction log (MongoDB only — on-chain txs are unchanged). */
export async function DELETE(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { guardianAddress, before, scope } = body;

    if (!(await isGuardianAddress(guardianAddress))) {
      return NextResponse.json(
        { error: 'Unauthorized — connect with a registered guardian wallet' },
        { status: 403 },
      );
    }

    await connectDB();

    let filter = {};
    if (scope === 'before' && before) {
      const cutoff = new Date(before);
      if (Number.isNaN(cutoff.getTime())) {
        return NextResponse.json({ error: 'Invalid before date' }, { status: 400 });
      }
      filter = { timestamp: { $lt: cutoff } };
    }

    const result = await RelayTransaction.deleteMany(filter);

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
      message:
        result.deletedCount === 0
          ? 'No transactions matched — history is already empty'
          : `Cleared ${result.deletedCount} transaction record(s)`,
    });
  } catch (err) {
    console.error('[relay/transactions DELETE]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to clear transaction history' },
      { status: 500 },
    );
  }
}
