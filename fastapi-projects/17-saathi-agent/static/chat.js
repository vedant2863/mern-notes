/**
 * Saathi Chat — WebSocket client for the finance agent.
 */

const messagesDiv = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const statusSpan = document.getElementById("status");
const toolIndicator = document.getElementById("tool-indicator");
const toolText = document.getElementById("tool-text");

let ws = null;
let conversationId = null;

// Connect to WebSocket
function connect() {
    const wsUrl = "ws://localhost:8000/ws/chat";
    ws = new WebSocket(wsUrl);

    ws.onopen = function () {
        statusSpan.textContent = "Connected";
        statusSpan.className = "status connected";
        messageInput.disabled = false;
    };

    ws.onclose = function () {
        statusSpan.textContent = "Disconnected";
        statusSpan.className = "status disconnected";
        messageInput.disabled = true;

        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
    };

    ws.onmessage = function (event) {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };
}

// Handle incoming messages from the server
function handleMessage(data) {
    if (data.type === "connected") {
        conversationId = data.conversation_id;
        return;
    }

    if (data.type === "tool_call") {
        // Show tool usage indicator
        toolIndicator.style.display = "flex";
        toolText.textContent = data.data;
        return;
    }

    if (data.type === "text") {
        // Hide tool indicator
        toolIndicator.style.display = "none";

        // Append text to the current assistant message
        let lastMsg = messagesDiv.querySelector(".message.assistant:last-child .message-content");

        if (!lastMsg || lastMsg.dataset.complete === "true") {
            // Create a new assistant message bubble
            const msgDiv = document.createElement("div");
            msgDiv.className = "message assistant";
            msgDiv.innerHTML = '<div class="message-content"></div>';
            messagesDiv.appendChild(msgDiv);
            lastMsg = msgDiv.querySelector(".message-content");
        }

        lastMsg.textContent += data.data;
        scrollToBottom();
        return;
    }

    if (data.type === "done") {
        // Mark the current message as complete
        toolIndicator.style.display = "none";
        const lastMsg = messagesDiv.querySelector(".message.assistant:last-child .message-content");
        if (lastMsg) {
            lastMsg.dataset.complete = "true";
        }
        return;
    }
}

// Add a user message to the chat
function addUserMessage(text) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "message user";
    msgDiv.innerHTML = '<div class="message-content">' + escapeHtml(text) + "</div>";
    messagesDiv.appendChild(msgDiv);
    scrollToBottom();
}

// Send a message
chatForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const text = messageInput.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

    // Show user message
    addUserMessage(text);

    // Send to server
    ws.send(JSON.stringify({ message: text }));

    // Clear input
    messageInput.value = "";
});

// Scroll chat to bottom
function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Start connection
connect();
