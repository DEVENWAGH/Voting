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
import Voter from '@/lib/models/Voter';
import BiometricHash from '@/lib/models/BiometricHash';

export async function GET(request, { params }) {
  try {
    await connectDB();
    const { electionId } = await params;
    const eid = String(electionId);

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

    // 8. Demographics & Geography (Age groups, roster gender, Rekognition gender, locations)
    const votes = await VoteActivity.find({ electionId: eid }).lean();
    const nullifierHashes = votes.map(v => v.voterNullifier).filter(Boolean);

    const voters = await Voter.find({ nullifierHash: { $in: nullifierHashes }, electionId: eid }).lean();
    const biometrics = await BiometricHash.find({ nullifierHash: { $in: nullifierHashes } }).lean();

    const voterMap = {};
    for (const v of voters) {
      voterMap[v.nullifierHash] = v;
    }

    const bioMap = {};
    for (const b of biometrics) {
      bioMap[b.nullifierHash] = b;
    }

    const ageGroups = {
      '18-25': 0,
      '26-35': 0,
      '36-50': 0,
      '50+': 0,
      'Unknown': 0
    };

    const rosterGenders = {
      'Male': 0,
      'Female': 0,
      'Other': 0,
      'Unknown': 0
    };

    const rekognitionGenders = {
      'Male': 0,
      'Female': 0,
      'Unknown': 0
    };

    let genderMatches = 0;
    let genderMismatches = 0;
    let genderCompareUnknowns = 0;

    const locations = [];

    for (const vote of votes) {
      // Geolocation details
      if (vote.voterLocation) {
        locations.push({
          latitude: vote.voterLocation.latitude,
          longitude: vote.voterLocation.longitude,
          city: vote.voterLocation.city || 'Local Area',
          country: vote.voterLocation.country || 'Local Region',
          timestamp: vote.timestamp
        });
      }

      const voter = voterMap[vote.voterNullifier];
      const bio = bioMap[vote.voterNullifier];

      // Age groups
      if (voter && voter.age) {
        const age = voter.age;
        if (age >= 18 && age <= 25) ageGroups['18-25']++;
        else if (age >= 26 && age <= 35) ageGroups['26-35']++;
        else if (age >= 36 && age <= 50) ageGroups['36-50']++;
        else if (age > 50) ageGroups['50+']++;
        else ageGroups['Unknown']++;
      } else {
        ageGroups['Unknown']++;
      }

      // Roster genders
      let rGender = 'Unknown';
      if (voter && voter.gender) {
        const g = voter.gender.trim().toLowerCase();
        if (g === 'male' || g === 'm') { rGender = 'Male'; rosterGenders['Male']++; }
        else if (g === 'female' || g === 'f') { rGender = 'Female'; rosterGenders['Female']++; }
        else if (g) { rGender = 'Other'; rosterGenders['Other']++; }
        else { rosterGenders['Unknown']++; }
      } else {
        rosterGenders['Unknown']++;
      }

      // Rekognition genders
      let awsGender = 'Unknown';
      if (bio && bio.faceAttributes && bio.faceAttributes.gender) {
        const g = bio.faceAttributes.gender.trim().toLowerCase();
        if (g === 'male') { awsGender = 'Male'; rekognitionGenders['Male']++; }
        else if (g === 'female') { awsGender = 'Female'; rekognitionGenders['Female']++; }
        else { rekognitionGenders['Unknown']++; }
      } else {
        rekognitionGenders['Unknown']++;
      }

      // Gender Match checks
      if (rGender !== 'Unknown' && awsGender !== 'Unknown') {
        if (rGender.toLowerCase() === awsGender.toLowerCase()) {
          genderMatches++;
        } else {
          genderMismatches++;
        }
      } else {
        genderCompareUnknowns++;
      }
    }

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
        demographics: {
          ageGroups,
          rosterGenders,
          rekognitionGenders,
          genderMatchStats: {
            matches: genderMatches,
            mismatches: genderMismatches,
            unknowns: genderCompareUnknowns,
            matchRate: (genderMatches + genderMismatches) > 0
              ? Number(((genderMatches / (genderMatches + genderMismatches)) * 100).toFixed(1))
              : 100
          },
          locations
        }
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
