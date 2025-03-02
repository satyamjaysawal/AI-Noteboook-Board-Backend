// File: models/Connection.js
const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  source: {
    type: String,
    required: true,
    ref: 'Note'
  },
  target: {
    type: String,
    required: true,
    ref: 'Note'
  },
  sourceHandle: {
    type: String,
    default: null
  },
  targetHandle: {
    type: String,
    default: null
  },
  label: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Connection = mongoose.model('Connection', connectionSchema);

module.exports = Connection;