# 🚀 AI Task Executor

A modern, AI-powered task execution system that breaks down large requests into actionable steps, executes them, and generates structured summaries.

## ✨ Features

- **Smart Planning**: AI automatically breaks your request into 3-7 actionable steps
- **Step-by-Step Execution**: Execute each step independently and see results
- **Status Tracking**: Visual indicators show step progress (pending → running → completed)
- **Final Summary**: Auto-generates a clean, formatted summary after execution
- **Optional Chat**: Ask follow-up questions about your results
- **Auto-Save**: All data persists to browser localStorage
- **Modern UI**: Professional SaaS design with animations and responsive layout

## 🎯 How It Works

1. **Enter Request** - Type your task (e.g., "Find me flights to Hawaii under $500")
2. **AI Plans** - System breaks it into steps
3. **Execute** - Click "Execute" on each step to run it
4. **View Results** - See results appear under each step
5. **Summary** - Generate a final formatted summary
6. **Follow Up** - Optionally ask clarifying questions via chat

## 🛠️ Quick Start

### Prerequisites
- Node.js 14+
- OpenRouter API key

### Installation

```bash
# Backend
cd backend
npm install
echo "OPENROUTER_API_KEY=your_key_here" > .env

# Frontend
cd ../frontend
npm install
```

### Running

**Terminal 1 - Backend:**
```bash
cd backend && npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend && npm run dev
```

Then open **http://localhost:5173**

## 📚 Documentation

- [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md) - Complete workflow documentation
- [REFACTOR_SUMMARY.md](REFACTOR_SUMMARY.md) - What changed in this refactor

## 🏗️ Architecture

- **Frontend**: React with Hooks, localStorage persistence
- **Backend**: Node.js + Express, OpenRouter API integration
- **AI Provider**: OpenRouter (llama-3-8b-instruct model)
- **Data**: Browser localStorage (tasks array)

## 📋 API Endpoints

- `POST /plan` - Break request into steps
- `POST /execute-step` - Execute individual steps
- `POST /chat` - Send follow-up questions
- `POST /task` - Legacy support

## 🐛 Troubleshooting

- **401 Error**: Check OPENROUTER_API_KEY in backend/.env
- **Steps not appearing**: Check backend logs and /plan response
- **Summary not generating**: Execute at least one step first
- **Frontend won't load**: Ensure backend running on 3000, check browser console

---

**Built with React + Node.js + OpenRouter API** 🎉
