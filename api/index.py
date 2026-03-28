import os
import base64
import json
from flask import Flask, request, jsonify, render_template, Response, stream_with_context
from flask_cors import CORS
import groq

app = Flask(__name__, template_folder="../templates", static_folder="../static")
CORS(app)

client = groq.Groq(api_key=os.environ.get("GROQ_API_KEY", ""))

GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "gemma2-9b-it",
    "mixtral-8x7b-32768",
    "qwen-qwq-32b",
    "deepseek-r1-distill-llama-70b",
]

LANGUAGES = [
    "English", "Turkish", "Spanish", "French", "German", "Italian",
    "Portuguese", "Russian", "Chinese", "Japanese", "Korean", "Arabic",
    "Hindi", "Dutch", "Polish", "Swedish", "Norwegian", "Danish",
    "Finnish", "Greek", "Hebrew", "Czech", "Romanian", "Hungarian",
]

def get_image_media_type(filename):
    name = (filename or "").lower()
    if name.endswith(".png"):
        return "image/png"
    if name.endswith(".gif"):
        return "image/gif"
    if name.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/models")
def get_models():
    return jsonify(GROQ_MODELS)


@app.route("/api/languages")
def get_languages():
    return jsonify(LANGUAGES)


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])
    model = data.get("model", "llama-3.3-70b-versatile")

    def generate():
        try:
            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                max_tokens=4096,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield f"data: {json.dumps({'content': delta.content})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/translate", methods=["POST"])
def translate():
    mode = request.form.get("mode", "text")
    target_lang = request.form.get("target_lang", "English")

    try:
        if mode == "image":
            model = "meta-llama/llama-4-scout-17b-16e-instruct"
            image_file = request.files.get("image")
            if not image_file:
                return jsonify({"error": "No image provided."}), 400

            img_b64 = base64.b64encode(image_file.read()).decode("utf-8")
            media_type = get_image_media_type(image_file.filename)

            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a professional translator. Extract all text visible in the image "
                        "and translate it into the specified target language. "
                        "Output only the translated text. No commentary, no explanation."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{media_type};base64,{img_b64}"},
                        },
                        {
                            "type": "text",
                            "text": f"Translate all text in this image to {target_lang}. Output only the translated text.",
                        },
                    ],
                },
            ]
        else:
            model = "llama-3.3-70b-versatile"
            text = request.form.get("text", "").strip()
            if not text:
                return jsonify({"error": "No text provided."}), 400

            messages = [
                {
                    "role": "system",
                    "content": (
                        f"You are a professional translator. Detect the source language automatically "
                        f"and translate the given text into {target_lang}. "
                        f"Output only the translated text. No notes, no explanation, no commentary."
                    ),
                },
                {"role": "user", "content": text},
            ]

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=2048,
        )
        return jsonify({
            "translation": response.choices[0].message.content,
            "model": model,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/math/extract", methods=["POST"])
def math_extract():
    mode = request.form.get("mode", "image")

    if mode == "text":
        text = request.form.get("text", "").strip()
        return jsonify({"problem": text})

    try:
        image_file = request.files.get("image")
        if not image_file:
            return jsonify({"error": "No image provided."}), 400

        img_b64 = base64.b64encode(image_file.read()).decode("utf-8")
        media_type = get_image_media_type(image_file.filename)

        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{media_type};base64,{img_b64}"},
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract the mathematical problem from this image exactly as written. "
                            "Output only the raw problem text. "
                            "No interpretation, no explanation, no commentary."
                        ),
                    },
                ],
            }
        ]

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=messages,
            max_tokens=1024,
        )
        return jsonify({"problem": response.choices[0].message.content})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/math/solve", methods=["POST"])
def math_solve():
    data = request.json
    problem = data.get("problem", "").strip()

    if not problem:
        return jsonify({"error": "No problem provided."}), 400

    try:
        system_prompt = (
            "You are a math tutor. Solve the given problem step by step in a clear, simple, "
            "and easy-to-understand way. Show your work and explain each step."
        )

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Solve this math problem: {problem}"},
            ],
            max_tokens=2048,
        )

        return jsonify({"solution": response.choices[0].message.content})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
