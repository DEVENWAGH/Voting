/**
 * GET /api/analytics/[electionId]
 * Real-time analytics for a specific election.
 * Returns hourly distribution, candidate breakdown, activity feed, and stats.
 * 
 * This is the "Serverless Real-Time Analytics" cloud integration —
 * uses MongoDB aggregation pipeline instead of slow blockchain queries.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VoteActivity from '@/lib/models/VoteActivity';
import Election from '@/lib/models/Election';

export async function GET(request, { params }) {
  try {
    await connectDB();
    const { electionId } = await params;
    const eid = Number(electionId);

    // 1. Hourly vote distribution (time-series data for chart)
    const hourlyDistribution = await VoteActivity.aggregate([
      { $match: { electionId: eid } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%dT%H:00:00', date: '$timestamp' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          hour: '$_id',
          count: 1,
        },
      },
    ]);

    // 2. Per-candidate vote breakdown (bar chart data)
    const candidateBreakdown = await VoteActivity.aggregate([
      { $match: { electionId: eid } },
      {
        $group: {
          _id: '$candidateId',
          votes: { $sum: 1 },
          firstVote: { $min: '$timestamp' },
          lastVote: { $max: '$timestamp' },
        },
      },
      { $sort: { votes: -1 } },
      {
        $project: {
          _id: 0,
          candidateId: '$_id',
          votes: 1,
          firstVote: 1,
          lastVote: 1,
        },
      },
    ]);

    // 3. Total stats
    const totalVotes = await VoteActivity.countDocuments({ electionId: eid });
    const votesLast1h = await VoteActivity.countDocuments({
      electionId: eid,
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    const votesLast24h = await VoteActivity.countDocuments({
      electionId: eid,
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    // 4. Peak voting hour
    const peakHour = hourlyDistribution.length > 0
      ? hourlyDistribution.reduce((max, h) => h.count > max.count ? h : max, hourlyDistribution[0])
      : null;

    // 5. Recent activity feed (last 50 events)
    const recentActivity = await VoteActivity.find({ electionId: eid })
      .sort({ timestamp: -1 })
      .limit(50)
      .select('candidateId txHash blockNumber timestamp')
      .lean();

    // 6. Election metadata
    const election = await Election.findOne({ electionId: eid }).lean();

    // 7. Votes per minute (velocity) — last 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentCount = await VoteActivity.countDocuments({
      electionId: eid,
      timestamp: { $gte: tenMinAgo },
    });
    const votesPerMinute = (recentCount / 10).toFixed(2);

    return NextResponse.json({
      success: true,
      data: {
        electionId: eid,
        election: election ? {
          title: election.title,
          description: election.description,
          phase: election.phase,
          startTime: election.startTime,
          endTime: election.endTime,
        } : null,
        stats: {
          totalVotes,
          votesLast1h,
          votesLast24h,
          votesPerMinute: Number(votesPerMinute),
          peakHour: peakHour ? { hour: peakHour.hour, votes: peakHour.count } : null,
          candidateCount: candidateBreakdown.length,
        },
        hourlyDistribution,
        candidateBreakdown,
        recentActivity: recentActivity.map(v => ({
          candidateId: v.candidateId,
          txHash: v.txHash,
          blockNumber: v.blockNumber,
          timestamp: v.timestamp,
        })),
      },
    });
  } catch (err) {
    console.error('[analytics]', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
