// File: routes/connectionRoutes.js
const express = require('express');
const router = express.Router();
const Connection = require('../models/Connection');
const Note = require('../models/Note');

// GET all connections
router.get('/connections', async (req, res) => {
  try {
    const connections = await Connection.find();
    res.json(connections);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE a new connection
router.post('/connections', async (req, res) => {
  // Validate that source and target notes exist
  try {
    const sourceExists = await Note.exists({ _id: req.body.source });
    const targetExists = await Note.exists({ _id: req.body.target });
    
    if (!sourceExists || !targetExists) {
      return res.status(400).json({ 
        message: 'Source or target note does not exist' 
      });
    }
    
    const connection = new Connection({
      source: req.body.source,
      target: req.body.target,
      sourceHandle: req.body.sourceHandle,
      targetHandle: req.body.targetHandle,
      label: req.body.label || ''
    });

    const newConnection = await connection.save();
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('connection-added', newConnection);
    }
    
    res.status(201).json(newConnection);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a connection
router.delete('/connections/:id', async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    await Connection.findByIdAndDelete(req.params.id);
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('connection-deleted', req.params.id);
    }
    
    res.json({ message: 'Connection deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;