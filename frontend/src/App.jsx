import { useState } from 'react'
import './App.css'

function App() {
  const [input, setInput] = useState('')
  const [response, setResponse] = useState('')

  const handleSubmit = async () => {
    try {
      const res = await fetch('http://localhost:3000/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: input })
      })
      const data = await res.json()
      setResponse(data.message)
    } catch (error) {
      setResponse('Error: ' + error.message)
    }
  }

  return (
    <div className="app">
      <h1>AI Task Executor</h1>
      <input 
        type="text" 
        value={input} 
        onChange={e => setInput(e.target.value)} 
        placeholder="Enter a task"
      />
      <button onClick={handleSubmit}>Submit</button>
      <p>{response}</p>
    </div>
  )
}

export default App