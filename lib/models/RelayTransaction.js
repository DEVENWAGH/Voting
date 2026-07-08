import mongoose from 'mongoose';

const RelayTransactionSchema = new mongoose.Schema(
  {
    txHash:      { type: String, required: true, unique: true, index: true },
    blockNumber: { type: Number, required: true },
    operation:   {
      type: String,
      required: true,
      enum: ['register_voter', 'cast_vote', 'create_election', 'add_candidate', 'transition_phase'],
      index: true,
    },
    electionId:  { type: Number, index: true },
    orgSlug:     { type: String, index: true },
    gasUsed:     { type: String, required: true },
    gasPrice:    { type: String, required: true },
    gasCostEth:  { type: String, required: true },
    metadata:    { type: mongoose.Schema.Types.Mixed },
    timestamp:   { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

RelayTransactionSchema.index({ operation: 1, timestamp: -1 });

export default mongoose.models.RelayTransaction
  ?? mongoose.model('RelayTransaction', RelayTransactionSchema);
