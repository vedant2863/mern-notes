let ws = null;
let currentPollId = null;

// Create a new poll via REST API
async function createPoll() {
    const question = document.getElementById("new-question").value;
    const optionsText = document.getElementById("new-options").value;
    const options = optionsText.split(",").map(o => o.trim()).filter(o => o);

    if (!question || options.length < 2) {
        alert("Enter a question and at least 2 options");
        return;
    }

    const response = await fetch("/polls/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, options }),
    });

    const poll = await response.json();
    connectToPoll(poll.id);
}

// Join an existing poll
function joinPoll() {
    const pollId = document.getElementById("poll-id-input").value.trim();
    if (pollId) {
        connectToPoll(pollId);
    }
}

// Connect WebSocket to a poll
function connectToPoll(pollId) {
    currentPollId = pollId;

    document.getElementById("create-section").style.display = "none";
    document.getElementById("poll-area").style.display = "block";

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = protocol + "//" + location.host + "/ws/polls/" + pollId;

    ws = new WebSocket(wsUrl);

    ws.onopen = function () {
        document.getElementById("status").className = "status connected";
        document.getElementById("status").textContent = "Connected - Poll ID: " + pollId;
    };

    ws.onmessage = function (event) {
        const data = JSON.parse(event.data);

        if (data.type === "initial") {
            document.getElementById("question").textContent = data.question;
            renderOptions(data.options, data.votes);
        }

        if (data.type === "vote_update") {
            updateVotes(data.votes);
        }
    };

    ws.onclose = function () {
        document.getElementById("status").className = "status disconnected";
        document.getElementById("status").textContent = "Disconnected";
    };
}

// Render option buttons
function renderOptions(options, votes) {
    const container = document.getElementById("options-container");
    container.innerHTML = "";

    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

    options.forEach(function (option) {
        const count = votes[option] || 0;
        const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

        const row = document.createElement("div");
        row.className = "option-row";
        row.onclick = function () { castVote(option); };

        row.innerHTML =
            '<span class="option-name">' + option + "</span>" +
            '<span class="vote-count">' + count + " votes</span>" +
            '<div class="bar-container">' +
            '<div class="bar-fill" style="width:' + percent + '%" data-option="' + option + '"></div>' +
            "</div>";

        container.appendChild(row);
    });
}

// Cast a vote via REST API
async function castVote(option) {
    await fetch("/polls/" + currentPollId + "/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: option }),
    });
    // No need to update UI — WebSocket broadcast will handle it
}

// Update vote counts from WebSocket broadcast
function updateVotes(votes) {
    const container = document.getElementById("options-container");
    const rows = container.querySelectorAll(".option-row");
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

    rows.forEach(function (row) {
        const name = row.querySelector(".option-name").textContent;
        const count = votes[name] || 0;
        const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

        row.querySelector(".vote-count").textContent = count + " votes";
        row.querySelector(".bar-fill").style.width = percent + "%";
    });
}
