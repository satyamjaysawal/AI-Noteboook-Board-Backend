// File: models/Note.js
const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Untitled',
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  position: {
    x: {
      type: Number,
      default: 100
    },
    y: {
      type: Number,
      default: 100
    }
  },
  styling: {
    backgroundColor: {
      type: String,
      default: '#ffffff'
    },
    fontSize: {
      type: Number,
      default: 16,
      min: 12,
      max: 28
    }
  },
  imageUrl: {
    type: String,
    default: ''
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional: Add if you want user authentication
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPinned: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp before saving
noteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
noteSchema.index({ userId: 1, createdAt: -1 });
noteSchema.index({ tags: 1 });

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;