# AI Suite — Web

A minimalist AI assistant with Chat, Translation, and Math solving. Built with Flask + Groq API. Deployable to Vercel.

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
gh repo create ai-suite-web --public --push
```

### 2. Import into Vercel

- Go to [vercel.com](https://vercel.com) and click **Add New Project**
- Import your GitHub repository
- Framework preset: **Other**
- No build command needed
- Click **Deploy**

### 3. Set environment variable

In the Vercel dashboard, go to your project → **Settings** → **Environment Variables**:

| Name | Value |
|------|-------|
| `GROQ_API_KEY` | your key from [console.groq.com](https://console.groq.com) |

Redeploy after adding the variable.

## Local development

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
export GROQ_API_KEY=your_key_here
python -c "from api.index import app; app.run(debug=True, port=5000)"
```

Open [http://localhost:5000](http://localhost:5000)

## Features

### Chat
Multi-turn streaming chat with any Groq model. Supports markdown rendering.

### Translate
- **Text** — auto-detects source language, translates to target using `llama-3.3-70b-versatile`
- **Image** — extracts and translates text from uploaded images using `llama-4-scout-17b` (vision)

### Math
- **Image** — upload a photo of a problem; extracted via `llama-4-scout-17b`, solved by `llama-3.3-70b-versatile`
- **Text** — type a problem directly and solve it

## Project structure

```
.
├── api/
│   └── index.py        # Flask app (Vercel Python serverless)
├── static/
│   ├── style.css
│   └── script.js
├── templates/
│   └── index.html
├── requirements.txt
└── vercel.json
```
