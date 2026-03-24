# AI Task Executor - Workflow Guide

## ✨ What's New

The app has been refactored to use a **task execution workflow** instead of chat-focused interface:

1. **Single Request Input** - Enter one large request (e.g., "Find flights to Florida under $150 and budget hotels")
2. **Automatic Planning** - AI breaks your request into 3-7 actionable steps
3. **Step-by-Step Execution** - Execute each step individually and see results
4. **Final Summary** - Generate a clean, formatted summary after all steps complete
5. **Optional Chat** - Ask follow-up questions if needed

## 🚀 Getting Started

### Prerequisites
- Node.js 14+
- OpenRouter API key (set in `backend/.env`)

### Installation & Setup

```bash
# 1. Backend setup
cd backend
npm install
# Make sure .env has: OPENROUTER_API_KEY=your_key

# 2. Frontend setup (in new terminal)
cd frontend
npm install
```

### Running the App

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# Should print: Server running at http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Should print: http://localhost:5173
```

Then open **http://localhost:5173** in your browser.

## 📋 Workflow Architecture

### Data Structure

Each task has this shape:

```javascript
{
  id: "1234567890",                    // Timestamp
  title: "Find flights to...",         // First 60 chars of request
  userRequest: "Full user request...", // Complete original request
  steps: [
    {
      id: "step-1",
      title: "Search for flights",
      type: "research",              // research|booking|comparison|analysis|other
      status: "completed",           // pending|running|completed|failed
      result: "Found 5 flights..."   // AI execution result
    },
    // More steps...
  ],
  summary: "Final summary text...",   // Generated after executing all steps
  messages: [                          // Chat history for follow-ups
    { role: "user", content: "..." },
    { role: "assistant", content: "..." }
  ]
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/plan` | POST | Break request into steps |
| `/execute-step` | POST | Execute a single step |
| `/chat` | POST | Send follow-up questions |
| `/task` | POST | Legacy endpoint (still supported) |

### Frontend Workflow

1. **Input Phase**
   - User enters request in textarea
   - Click "Plan & Execute" button
   - App calls `/plan` endpoint

2. **Planning Phase**
   - Backend breaks request into steps (using OpenRouter)
   - Steps displayed as cards with "pending" status
   - Each step shows: title, type, execute button

3. **Execution Phase**
   - Click "Execute" button on any step
   - Button shows "Running..." (disabled)
   - After completion: shows "✓ Done"
   - Result displayed below step card

4. **Summary Phase**
   - "Generate Final Summary" button appears after completing steps
   - AI reads all results and creates formatted summary
   - Summary displayed in highlighted box

5. **Chat Phase** (Optional)
   - Click "Ask Follow-up Questions" button
   - Ask clarifications or refinements
   - Full conversation history sent to AI

## 🎨 UI Features

- **Task List** - All your tasks in sidebar
- **Status Indicators** - Color-coded step status (green=done, orange=running, red=failed)
- **Result Display** - Results show in collapsible cards with syntax highlighting
- **Modern Design** - Professional SaaS styling with shadows and animations
- **Responsive** - Works on desktop, tablet, mobile
- **Auto-save** - All data persists in localStorage

## 🔧 Common Tasks

### Clear All Tasks
```javascript
// In browser console
localStorage.removeItem('aiTasks');
location.reload();
```

### Check Backend Logs
```bash
# In backend terminal, you'll see logs like:
# /plan request received
# /execute-step request received
# planSteps completed: 5 steps generated
```

### Test API Manually
```bash
# Test /plan endpoint
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{"request":"Find me cheap flights to Hawaii"}'
```

## 🐛 Troubleshooting

### "401 Unauthorized" Error
- Check `backend/.env` has valid `OPENROUTER_API_KEY`
- Make sure key is not expired on OpenRouter website

### Steps not appearing
- Check browser console for errors
- Verify backend logs show `/plan request received`
- Make sure OpenRouter API is responding (check status page)

### "Failed to generate summary"
- Some steps must be "completed" status
- Try running at least one step first
- Check OpenRouter API limits

### Styles look weird
- Clear browser cache: `Cmd+Shift+Delete`
- Make sure frontend is running on port 5173

## 📚 Example Requests

Good workflow requests have multiple actionable steps:

```
"I'm planning a trip to Japan for 5 days. Find me:
1. Cheap flights from NYC departing Dec 15-25
2. Budget-friendly hotels in Tokyo near Shibuya
3. Free or cheap attractions (temples, parks, museums)
4. Best public transport options (JR Pass, Suica card)
5. Recommended restaurants with good reviews under $20/meal"
```

This breaks down into: search flights → search hotels → research attractions → research transport → research food.

## 🎯 Architecture Overview

```
Frontend (React)
├── Input Component (textarea)
├── Task List (sidebar)
├── Workflow Display
│   ├── Step Cards (status, execute button)
│   └── Result Display
├── Summary Section
└── Optional Chat
        ↓
    HTTP Requests to:
        ↓
Backend (Node.js + Express)
├── /plan endpoint (planSteps function)
├── /execute-step endpoint (processTask function)
├── /chat endpoint (full conversation support)
└── OpenRouter API (llama-3-8b-instruct model)

Data Persistence:
├── Frontend: localStorage (aiTasks key)
└── Backend: Memory only (resets on restart)
```

## 🚀 Performance Tips

- Keep requests under 500 characters for better planning
- Execute 1 step at a time instead of parallel (safer)
- Close browser DevTools for faster rendering (it slows React)
- Clear old tasks regularly from sidebar (they clutter the UI)

## 📝 Next Steps

After building this:
- Add persistent backend database (MongoDB/PostgreSQL)
- Add user authentication
- Add email notifications when tasks complete
- Add batch execution (all steps in parallel)
- Export results as PDF/Word

---

**Happy task executing! 🎉**
