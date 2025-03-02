require('dotenv').config(); // Load environment variables

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// Ensure CLIENT_URL is set
if (!process.env.CLIENT_URL) {
  console.warn("⚠️ Warning: CLIENT_URL is not set in .env. Defaulting to http://localhost:5173");
}

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));

app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/noteflow')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});
app.set('io', io);

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // 1000 requests in dev, 100 in prod
});
app.use(limiter);

// Initialize Google Generative AI
let genAI, model;
try {
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
  });
} catch (error) {
  console.error('🔥 Failed to initialize AI model:', error.message);
  process.exit(1);
}

// Helper functions
const cleanMarkdown = (text) => text.replace(/```json/g, '').replace(/```/g, '').trim();

const formatResponse = async (task, prompt) => {
  const prompts = {
    correct_sentence: `Correct the grammar and structure of this sentence without explanation:\n"${prompt}"`,
    word_suggestions: `Suggest 3-5 alternative words for each significant word in this text (exclude articles and prepositions). Return the suggestions as a JSON array where each item is a string in the format "word: suggestion1, suggestion2, suggestion3, suggestion4, suggestion5":\n"${prompt}"`,
    summarize: `Summarize this text in 1-2 sentences:\n"${prompt}"`,
    generate: `Generate a response based on this prompt:\n"${prompt}"`,
    expand: `Expand this text into a detailed paragraph:\n"${prompt}"`
  };

  const finalPrompt = prompts[task] || prompts.generate;

  try {
    const result = await model.generateContent(finalPrompt);
    const textResponse = result.response.text().trim();
    const cleanedResponse = cleanMarkdown(textResponse);

    if (task === 'word_suggestions') {
      try {
        const suggestions = JSON.parse(cleanedResponse);
        return { suggestions };
      } catch {
        const lines = cleanedResponse.split('\n').filter(line => line.trim());
        return { suggestions: lines.length === 1 ? cleanedResponse.split(',').map(s => s.trim()) : lines };
      }
    }
    return { response: cleanedResponse };
  } catch (error) {
    throw new Error(`AI processing failed: ${error.message}`);
  }
};

// Home Route
app.get('/', (_, res) => {
  res.json({ message: '🚀 Welcome to NoteFlow API! Your server is up and running.' });
});

// Routes
app.use('/api', require('./routes/noteRoutes'));
app.use('/api', require('./routes/connectionRoutes'));

// Socket.io event handling
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('ai-process', async ({ task, prompt }) => {
    try {
      const result = await formatResponse(task, prompt);
      socket.emit('ai-response', { success: true, task, prompt, result });
    } catch (error) {
      socket.emit('ai-response', { success: false, error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// 404 Route Handler (Fixed Unused `req`)
app.use((_, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global Error Handler (Fixed Unused `req` and `next`)
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}, allowing requests from ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
});
