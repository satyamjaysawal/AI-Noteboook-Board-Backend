// File: routes/noteRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Add this line
const Note = require('../models/Note');
const Connection = require('../models/Connection');

// Middleware to validate ObjectId
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid note ID' });
  }
  next();
};

// GET all notes with optional filters
router.get('/notes', async (req, res) => {
  try {
    const { tag, pinned, search, sortBy = 'createdAt', order = 'desc' } = req.query;
    const query = {};

    if (tag) query.tags = tag;
    if (pinned) query.isPinned = pinned === 'true';
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortField = sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt';

    const notes = await Note.find(query)
      .sort({ [sortField]: sortOrder })
      .lean();

    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET a single note by ID
router.get('/notes/:id', validateObjectId, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).lean();
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE a new note
router.post('/notes', async (req, res) => {
  try {
    const noteData = {
      title: req.body.title,
      content: req.body.content,
      position: req.body.position || { x: 100, y: 100 },
      styling: {
        backgroundColor: req.body.styling?.backgroundColor || '#ffffff',
        fontSize: req.body.styling?.fontSize || 16
      },
      imageUrl: req.body.imageUrl || '',
      tags: req.body.tags || [],
      isPinned: req.body.isPinned || false
    };

    const note = new Note(noteData);
    const newNote = await note.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('note-added', newNote);
    }

    res.status(201).json(newNote);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// UPDATE a note
router.put('/notes/:id', validateObjectId, async (req, res) => {
  try {
    if (!req.body.content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const updateData = {
      title: req.body.title || 'Untitled',
      content: req.body.content,
      position: req.body.position || { x: 100, y: 100 },
      styling: {
        backgroundColor: req.body.styling?.backgroundColor || '#ffffff',
        fontSize: req.body.styling?.fontSize || 16
      },
      imageUrl: req.body.imageUrl || '',
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      isPinned: req.body.isPinned ?? false,
      updatedAt: Date.now()
    };

    const updatedNote = await Note.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedNote) return res.status(404).json({ message: 'Note not found' });

    const io = req.app.get('io');
    if (io) {
      io.emit('note-updated', updatedNote);
    }

    res.json(updatedNote);
  } catch (err) {
    console.error('Update note error:', err); // Log detailed error
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE a note and its connections
router.delete('/notes/:id', validateObjectId, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    // Delete the note
    await Note.findByIdAndDelete(req.params.id);

    // Delete associated connections
    await Connection.deleteMany({
      $or: [{ source: req.params.id }, { target: req.params.id }]
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('note-deleted', req.params.id);
      io.emit('connection-deleted', { noteId: req.params.id });
    }

    res.json({ message: 'Note and associated connections deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// TOGGLE pin status
router.patch('/notes/:id/pin', validateObjectId, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    const updatedNote = await Note.findByIdAndUpdate(
      req.params.id,
      { isPinned: !note.isPinned, updatedAt: Date.now() },
      { new: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('note-updated', updatedNote);
    }

    res.json(updatedNote);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;