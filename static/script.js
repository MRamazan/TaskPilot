const $ = (id) => document.getElementById(id);

const progress = $("progress");
const showProgress = () => progress.classList.remove("hidden");
const hideProgress = () => progress.classList.add("hidden");

marked.setOptions({ breaks: true, gfm: true });

document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        $("tab-" + tab.dataset.tab).classList.add("active");
    });
});

(async () => {
    const [modelsRes, langsRes] = await Promise.all([
        fetch("/api/models"),
        fetch("/api/languages"),
    ]);
    const models = await modelsRes.json();
    const langs = await langsRes.json();

    const modelSel = $("chat-model");
    models.forEach((m) => {
        const o = document.createElement("option");
        o.value = m;
        o.textContent = m;
        modelSel.appendChild(o);
    });

    const langSel = $("translate-target");
    langs.forEach((l) => {
        const o = document.createElement("option");
        o.value = l;
        o.textContent = l;
        langSel.appendChild(o);
    });
})();

let chatHistory = [];
let chatBusy = false;

function makeAvatar(role) {
    const el = document.createElement("div");
    el.className = "msg-avatar";
    el.textContent = role === "user" ? "U" : "AI";
    return el;
}

function makeBubble(role, html) {
    const el = document.createElement("div");
    el.className = "msg-bubble";
    if (role === "assistant") {
        el.innerHTML = html || "";
    } else {
        el.textContent = html;
    }
    return el;
}

function appendMsg(role, content) {
    const container = $("chat-messages");
    const empty = container.querySelector(".empty-state");
    if (empty) empty.remove();

    const row = document.createElement("div");
    row.className = `message ${role}`;
    const bubble = makeBubble(role, role === "assistant" ? marked.parse(content || "") : content);
    row.appendChild(makeAvatar(role));
    row.appendChild(bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return bubble;
}

function showTyping() {
    const container = $("chat-messages");
    const row = document.createElement("div");
    row.className = "message assistant";
    row.id = "typing-row";
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.innerHTML = `<div class="typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    row.appendChild(makeAvatar("assistant"));
    row.appendChild(bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    const el = $("typing-row");
    if (el) el.remove();
}

async function sendChat() {
    if (chatBusy) return;
    const input = $("chat-input");
    const text = input.value.trim();
    if (!text) return;

    const model = $("chat-model").value;
    input.value = "";
    input.style.height = "auto";

    chatHistory.push({ role: "user", content: text });
    appendMsg("user", text);
    showTyping();

    chatBusy = true;
    $("chat-send").disabled = true;

    let fullText = "";
    let bubble = null;

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: chatHistory, model }),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop();

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const raw = line.slice(6).trim();
                if (raw === "[DONE]") continue;
                try {
                    const data = JSON.parse(raw);
                    if (data.error) throw new Error(data.error);
                    if (data.content) {
                        fullText += data.content;
                        removeTyping();
                        if (!bubble) {
                            bubble = appendMsg("assistant", fullText);
                        } else {
                            bubble.innerHTML = marked.parse(fullText);
                            $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
                        }
                    }
                } catch {}
            }
        }

        chatHistory.push({ role: "assistant", content: fullText });
    } catch (err) {
        removeTyping();
        appendMsg("assistant", "Error: " + err.message);
    }

    chatBusy = false;
    $("chat-send").disabled = false;
}

$("chat-send").addEventListener("click", sendChat);

$("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
    }
});

$("chat-input").addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 160) + "px";
});

$("chat-clear").addEventListener("click", () => {
    chatHistory = [];
    $("chat-messages").innerHTML = `<div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>Select a model and start chatting</span>
    </div>`;
});

let translateMode = "text";
let mathMode = "image";

document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        document.querySelectorAll(`.seg-btn[data-target="${target}"]`).forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const mode = btn.dataset.mode;

        if (target === "translate") {
            translateMode = mode;
            $("translate-text-section").classList.toggle("hidden", mode !== "text");
            $("translate-image-section").classList.toggle("hidden", mode !== "image");
            $("translate-result").classList.add("hidden");
        }

        if (target === "math") {
            mathMode = mode;
            $("math-image-section").classList.toggle("hidden", mode !== "image");
            $("math-text-section").classList.toggle("hidden", mode !== "text");
            $("math-extract-card").classList.add("hidden");
            $("math-solution-card").classList.add("hidden");
        }
    });
});

function setupDropzone(zoneId, inputId, previewId) {
    const zone = $(zoneId);
    const input = $(inputId);
    const preview = $(previewId);

    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("over");
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            loadPreview(file, preview, zone);
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
        }
    });

    input.addEventListener("change", () => {
        if (input.files[0]) loadPreview(input.files[0], preview, zone);
    });
}

function loadPreview(file, previewEl, zone) {
    const reader = new FileReader();
    reader.onload = (e) => {
        previewEl.src = e.target.result;
        previewEl.classList.remove("hidden");
        const body = zone.querySelector(".dropzone-body");
        if (body) body.classList.add("hidden");
    };
    reader.readAsDataURL(file);
}

setupDropzone("translate-dropzone", "translate-file", "translate-preview");
setupDropzone("math-dropzone", "math-file", "math-preview");

$("translate-submit").addEventListener("click", async () => {
    const btn = $("translate-submit");
    const targetLang = $("translate-target").value;

    btn.disabled = true;
    showProgress();
    $("translate-result").classList.add("hidden");

    try {
        const fd = new FormData();
        fd.append("mode", translateMode);
        fd.append("target_lang", targetLang);

        if (translateMode === "text") {
            const text = $("translate-text").value.trim();
            if (!text) { alert("Enter text to translate."); return; }
            fd.append("text", text);
        } else {
            const file = $("translate-file").files[0];
            if (!file) { alert("Upload an image first."); return; }
            fd.append("image", file);
        }

        const res = await fetch("/api/translate", { method: "POST", body: fd });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        $("translate-output").textContent = data.translation;
        $("translate-model-badge").textContent = translateMode === "image" ? "llama-4-scout" : "llama-3.3-70b";
        $("translate-result").classList.remove("hidden");
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        hideProgress();
    }
});

$("math-submit").addEventListener("click", async () => {
    const btn = $("math-submit");
    btn.disabled = true;
    showProgress();
    $("math-extract-card").classList.add("hidden");
    $("math-solution-card").classList.add("hidden");

    try {
        let problem = "";

        if (mathMode === "image") {
            const file = $("math-file").files[0];
            if (!file) { alert("Upload an image first."); return; }

            const fd = new FormData();
            fd.append("mode", "image");
            fd.append("image", file);

            const extractRes = await fetch("/api/math/extract", { method: "POST", body: fd });
            const extractData = await extractRes.json();
            if (extractData.error) throw new Error(extractData.error);

            problem = extractData.problem;
            $("math-extract-body").textContent = problem;
            $("math-extract-card").classList.remove("hidden");
        } else {
            problem = $("math-text").value.trim();
            if (!problem) { alert("Enter a math problem."); return; }
        }

        const solveRes = await fetch("/api/math/solve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ problem }),
        });
        const solveData = await solveRes.json();
        if (solveData.error) throw new Error(solveData.error);

        $("math-solution-body").textContent = solveData.solution;
$("math-solution-card").classList.remove("hidden");
renderMathInElement($("math-solution-body"), {
    delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
});

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        hideProgress();
    }
});
