# API Usage Examples

## Testing the Endpoints

### 1. Plan Endpoint (Generate Steps)

Creates a step-by-step plan from a user request.

```bash
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{
    "request": "Find me cheap flights to Hawaii for 2 people in December, plus recommend good snorkeling spots and cheap restaurants"
  }'
```

**Response:**
```json
{
  "steps": [
    {
      "id": "step-1",
      "title": "Search for flights from your location to Hawaii",
      "type": "research",
      "status": "pending",
      "result": ""
    },
    {
      "id": "step-2",
      "title": "Compare flight prices and airlines",
      "type": "comparison",
      "status": "pending",
      "result": ""
    },
    {
      "id": "step-3",
      "title": "Find best snorkeling spots in Hawaii",
      "type": "research",
      "status": "pending",
      "result": ""
    },
    {
      "id": "step-4",
      "title": "Recommend cheap restaurants with good reviews",
      "type": "research",
      "status": "pending",
      "result": ""
    }
  ]
}
```

---

### 2. Execute Step Endpoint

Executes a single step and returns the result.

```bash
curl -X POST http://localhost:3000/execute-step \
  -H "Content-Type: application/json" \
  -d '{
    "step": "Search for flights from your location to Hawaii"
  }'
```

**Response:**
```json
{
  "result": "Found several flight options:\n\n1. Southwest Airlines - $189 per person (4 stops, 12 hours)\n2. Hawaiian Airlines - $249 per person (2 stops, 8 hours)\n3. Delta - $279 per person (1 stop, 7 hours)\n4. United - $299 per person (Direct, 6 hours)\n\nBest value: Southwest at $189/person (total $378 for 2 people)\nFastest: United Direct flights at 6 hours"
}
```

---

### 3. Chat Endpoint

Send messages with full conversation history for follow-ups.

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find me cheap flights to Hawaii for 2 people in December"
      },
      {
        "role": "assistant",
        "content": "Found Southwest Airlines flights for $189/person (total $378 for 2 people) with 4 stops. Hawaiian Airlines $249/person with 2 stops. Delta $279/person with 1 stop. United $299/person with no stops (direct)."
      },
      {
        "role": "user",
        "content": "What about the Hawaiian Airlines option? How long does it take?"
      }
    ]
  }'
```

**Response:**
```json
{
  "result": "Hawaiian Airlines flights take approximately 8 hours total with 2 stops. This is a good middle ground between cost ($249/person) and convenience. The 2-stop route typically breaks down as:\n\n- Departure: 2-3 hours\n- First stop: 1-2 hour layover\n- Second leg: 2-3 hours\n- Second stop: 1-2 hour layover\n- Final leg to Hawaii: 2-3 hours\n\nTotal travel time is usually around 8-10 hours depending on layover lengths."
}
```

---

### 4. Task Endpoint (Legacy - Still Supported)

Original endpoint that still works with backwards compatibility.

```bash
# Old format (single task string)
curl -X POST http://localhost:3000/task \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Find me cheap flights to Hawaii"
  }'

# New format (messages array)
curl -X POST http://localhost:3000/task \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Find me cheap flights to Hawaii" }
    ]
  }'
```

---

## JavaScript/Node.js Examples

### Using fetch() in Frontend

```javascript
// Call /plan endpoint
async function planRequest(userRequest) {
  const response = await fetch('http://localhost:3000/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: userRequest })
  });
  
  const data = await response.json();
  return data.steps;
}

// Call /execute-step endpoint
async function executeStep(stepTitle) {
  const response = await fetch('http://localhost:3000/execute-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: stepTitle })
  });
  
  const data = await response.json();
  return data.result;
}

// Call /chat endpoint
async function sendChat(messages) {
  const response = await fetch('http://localhost:3000/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages })
  });
  
  const data = await response.json();
  return data.result;
}
```

### Using Node.js

```javascript
const fetch = require('node-fetch');

async function callPlanAPI(request) {
  const response = await fetch('http://localhost:3000/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request })
  });
  
  const json = await response.json();
  console.log('Generated steps:', json.steps);
  
  // Execute each step
  for (const step of json.steps) {
    const result = await fetch('http://localhost:3000/execute-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: step.title })
    });
    
    const data = await result.json();
    console.log(`${step.title}: ${data.result}`);
  }
}

callPlanAPI('Find me cheap flights to Hawaii');
```

---

## Python Examples

```python
import requests
import json

API_BASE = 'http://localhost:3000'

def plan_request(request_text):
    """Call /plan endpoint to generate steps"""
    response = requests.post(
        f'{API_BASE}/plan',
        json={'request': request_text}
    )
    return response.json()['steps']

def execute_step(step_title):
    """Execute a single step"""
    response = requests.post(
        f'{API_BASE}/execute-step',
        json={'step': step_title}
    )
    return response.json()['result']

def send_chat(messages):
    """Send chat message with history"""
    response = requests.post(
        f'{API_BASE}/chat',
        json={'messages': messages}
    )
    return response.json()['result']

# Example usage
steps = plan_request('Find me cheap flights to Hawaii')
print(f'Generated {len(steps)} steps')

for step in steps:
    result = execute_step(step['title'])
    print(f"{step['title']}: {result}")
```

---

## Request/Response Schema

### /plan

**Request:**
```json
{
  "request": "string (1-500 chars, the user request)"
}
```

**Response:**
```json
{
  "steps": [
    {
      "id": "step-1",
      "title": "string (step title/description)",
      "type": "research|booking|comparison|analysis|other",
      "status": "pending",
      "result": ""
    }
  ]
}
```

### /execute-step

**Request:**
```json
{
  "step": "string (the step title to execute)"
}
```

**Response:**
```json
{
  "result": "string (the step execution result)"
}
```

### /chat

**Request:**
```json
{
  "messages": [
    {
      "role": "user|assistant",
      "content": "string (message text)"
    }
  ]
}
```

**Response:**
```json
{
  "result": "string (assistant response)"
}
```

### /task (Legacy)

**Request (Old):**
```json
{
  "task": "string (the task to execute)"
}
```

**Request (New):**
```json
{
  "messages": [
    {
      "role": "user|assistant",
      "content": "string"
    }
  ]
}
```

**Response:**
```json
{
  "result": "string (AI response)",
  "steps": ["optional: array of step descriptions"]
}
```

---

## Error Responses

All errors return appropriate HTTP status codes:

```bash
# 400 Bad Request - Missing required field
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{}'

# Response:
# HTTP/1.1 400 Bad Request
# {"error": "request is required"}

# 401 Unauthorized - Invalid API key
# HTTP/1.1 401 Unauthorized
# {"error": "Invalid API key"}

# 500 Server Error - Server error
# HTTP/1.1 500 Internal Server Error
# {"error": "Internal server error"}
```

---

## Testing Tips

### 1. Use curl or Postman
```bash
# Simple test
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{"request":"What is AI?"}'
```

### 2. Check Backend Logs
```bash
# Terminal with backend running will show:
# /plan request received
# /execute-step request received
# planSteps completed: 5 steps generated
```

### 3. Monitor Network in Browser
- Open DevTools (F12)
- Go to Network tab
- Click "Plan & Execute"
- See requests to /plan, /execute-step, /chat
- Check response bodies

### 4. Test with Different Request Types
```javascript
// Simple query
"What is machine learning?"

// Multi-step task
"Plan a trip to Japan: flights, hotels, attractions, food"

// Research request
"Compare the top 3 programming languages in 2024"

// Product research
"Find the best budget laptop for video editing"
```

---

## Performance Benchmarks

| Endpoint | Avg Time | Bottleneck |
|----------|----------|-----------|
| `/plan` | 2-3s | OpenRouter API |
| `/execute-step` | 3-5s | OpenRouter API |
| `/chat` | 1-2s | OpenRouter API (fewer tokens) |

---

## Rate Limiting

Currently no rate limiting. For production, consider:
- Max 10 requests/minute per IP
- Max 5 concurrent requests
- Request body size limit: 5KB

---

## CORS Configuration

Currently allows requests from `http://localhost:5173`

For production, update in `server.js`:
```javascript
const corsOptions = {
  origin: 'https://yourdomain.com',
  credentials: true
};

app.use(cors(corsOptions));
```
