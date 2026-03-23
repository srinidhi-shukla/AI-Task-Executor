require('dotenv').config();

const express = require('express');
const OpenAI = require('openai');

const app = express();

app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/task', async (req, res) => {
  const { task } = req.body;

  // Validate that task exists
  if (!task) {
    return res.status(400).json({ error: 'Task is required' });
  }

  try {
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { 
          role: 'system', 
          content: 'You are an AI task executor. For any user task, break it down into short actionable steps and provide a concise result summary. Always respond with valid JSON in this exact format: {"steps": ["step 1", "step 2", ...], "result": "summary text"}' 
        },
        { role: 'user', content: task },
      ],
    });

    const responseText = completion.choices[0].message.content;
    
    // Parse the JSON response
    const parsedResponse = JSON.parse(responseText);
    
    res.json(parsedResponse);
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Failed to process task with AI' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});