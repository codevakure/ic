import mongoose, { Schema } from 'mongoose';
import { ISession } from '~/types';

const sessionSchema: Schema<ISession> = new Schema({
  refreshTokenHash: {
    type: String,
    required: true,
  },
  expiration: {
    type: Date,
    required: true,
    expires: 0,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Admin dashboard indexes for efficient session queries
sessionSchema.index({ expiration: 1, user: 1 }); // For active sessions by user
sessionSchema.index({ user: 1, expiration: 1 }); // For user session lookups
sessionSchema.index({ createdAt: 1 }); // For sessions created today

export default sessionSchema;
