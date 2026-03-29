# TaskPilot

A multi-tool AI assistant with purpose-built Llama pipelines for chat, translation, and math.

**Live demo:** [your-url.vercel.app](https://your-url.vercel.app)

## Features

- **Chat** — streaming multi-turn chat with selectable Llama models
- **Translate** — text or image translation with automatic language detection
- **Math** — two-step pipeline: extract problem from image, solve step by step with KaTeX rendering

## Stack

Python, Flask, Groq API, Vercel

## Setup

1. Clone the repo
2. Install dependencies: `pip install -r requirements.txt`
3. Set your Groq API key: `export GROQ_API_KEY=your_key`
4. Run: `python -c "from api.index import app; app.run(debug=True, port=5000)"`
5. Open [http://localhost:5000](http://localhost:5000)
