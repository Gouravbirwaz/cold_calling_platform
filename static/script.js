let device, activeConnection;
let agentId = null;
let callStartTime = null;
let isDeviceReady = false;
let isMuted = false;
let isUserHangup = false;
let call_sid = null;

// DOM elements
const phoneNumberInput = document.getElementById('phoneNumberInput');
const callBtn = document.getElementById('callBtn');
const hangupBtn = document.getElementById('hangupBtn');
const voicemailBtn = document.getElementById('voicemailBtn');
const muteBtn = document.getElementById('muteBtn');
const deviceStatusText = document.getElementById('deviceStatusText');
const deviceStatusIndicator = document.getElementById('deviceStatusIndicator');
const callStatusText = document.getElementById('callStatusText');
const callStatusIndicator = document.getElementById('callStatusIndicator');
const agentIdText = document.getElementById('agentIdText');
const logs = document.getElementById('logs');
const callQueueTableBody = document.getElementById('callQueueTableBody');
const noCallsMessage = document.getElementById('noCallsMessage');
const callLogTableBody = document.getElementById('callLogTableBody');
const satisfactionTableBody = document.getElementById('satisfactionTableBody');
const noSatisfactionMessage = document.getElementById('noSatisfactionMessage');
const callNotesInput = document.getElementById('callNotesInput');
const saveNotesBtn = document.getElementById('saveNotesBtn');
const agentSelect = document.getElementById('agentSelect');
const startBtn = document.getElementById('startBtn'); // New button to initiate Twilio

// Modal elements
const voicemailModal = document.getElementById('voicemailModal');
const voicemailSelect = document.getElementById('voicemailSelect');
const voicemailSendBtn = document.getElementById('voicemailSendBtn');
const voicemailCancelBtn = document.getElementById('voicemailCancelBtn');

const satisfactionModal = document.getElementById('satisfactionModal');
const satisfiedBtn = document.getElementById('satisfiedBtn');
const notSatisfiedBtn = document.getElementById('notSatisfiedBtn');
const satisfactionCancelBtn = document.getElementById('satisfactionCancelBtn');

// Global State
const callNotes = JSON.parse(localStorage.getItem('callNotes')) || {};

// Initial setup
callBtn.disabled = false;
voicemailBtn.disabled = false;

// --- Utility Functions ---
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDuration(ms) {
    if (!ms) return '--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getStatusBadge(status) {
    const statusMap = {
        'completed': 'badge-success',
        'in-progress': 'badge-warning',
        'failed': 'badge-danger',
        'pending': 'badge-secondary'
    };
    return `<span class="badge ${statusMap[status] || 'badge-secondary'}">${status}</span>`;
}

function getSatisfactionColor(satisfaction) {
    return satisfaction === 'Satisfied' ? 'text-green-400' :
        satisfaction === 'Not Satisfied' ? 'text-red-400' : 'text-gray-400';
}

// --- Log & Status Functions ---
function log(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const p = document.createElement('div');
    p.textContent = `[${timestamp}] ${msg}`;
    p.className = `log-entry ${type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : ''}`;
    logs.insertBefore(p, logs.firstChild);
    if (logs.children.length > 50) {
        logs.removeChild(logs.lastChild);
    }
}

function updateDeviceStatus(status, state) {
    deviceStatusText.textContent = status;
    deviceStatusIndicator.className = 'status-indicator ' + (state || 'status-idle');
    if (isDeviceReady && agentId) {
        callBtn.disabled = false;
        callBtn.classList.remove('btn-disabled');
        voicemailBtn.disabled = false;
    } else {
        callBtn.disabled = true;
        callBtn.classList.add('btn-disabled');
        voicemailBtn.disabled = true;
    }
}

function updateCallStatus(status, state) {
    callStatusText.textContent = status;
    callStatusIndicator.className = 'status-indicator ' + (state || 'status-idle');

    if (status === "In Call") {
        hangupBtn.classList.remove('hidden');
        muteBtn.classList.remove('hidden');
        voicemailBtn.classList.add('hidden');
        callBtn.classList.add('btn-disabled');
        callBtn.disabled = true;
    } else {
        hangupBtn.classList.add('hidden');
        muteBtn.classList.add('hidden');
        voicemailBtn.classList.remove('hidden');
        callBtn.classList.remove('btn-disabled');
        callBtn.disabled = !(isDeviceReady && agentId);
    }
}

// --- Drag and Drop Functions ---
let draggedNumber = null;

function handleDragStart(e) {
    draggedNumber = e.target.closest('tr').dataset.phoneNumber;
    e.target.style.opacity = '0.5';
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
}

function handleDragOver(e) {
    e.preventDefault();
    phoneNumberInput.style.borderColor = 'var(--accent-blue)';
    phoneNumberInput.style.backgroundColor = 'rgba(49, 130, 206, 0.1)';
}

function handleDragLeave(e) {
    phoneNumberInput.style.borderColor = 'var(--border-color)';
    phoneNumberInput.style.backgroundColor = 'var(--bg-tertiary)';
}

function handleDrop(e) {
    e.preventDefault();
    phoneNumberInput.style.borderColor = 'var(--border-color)';
    phoneNumberInput.style.backgroundColor = 'var(--bg-tertiary)';

    if (draggedNumber) {
        phoneNumberInput.value = draggedNumber;
        phoneNumberInput.removeAttribute('readonly');
        callNotesInput.value = callNotes[draggedNumber] || '';
        draggedNumber = null;
        log(`📱 Number ${phoneNumberInput.value} selected from queue`, 'success');
    }
}

// --- API Functions ---
async function fetchAndRenderCallQueue() {
    try {
        const response = await fetch('/api/calls');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const calls = await response.json();

        callQueueTableBody.innerHTML = '';

        if (calls.length > 0) {
            noCallsMessage.style.display = 'none';

            calls.forEach((call, index) => {
                const row = document.createElement('tr');
                row.classList.add('draggable-row');
                row.setAttribute('draggable', 'true');
                row.dataset.phoneNumber = call.caller_number;

                const priority = index < 3 ? 'High' : index < 7 ? 'Medium' : 'Low';
                const priorityClass = priority === 'High' ? 'badge-danger' :
                    priority === 'Medium' ? 'badge-warning' : 'badge-secondary';

                row.innerHTML = `
                    <td class="font-mono">${call.caller_number}</td>
                    <td>${getStatusBadge('pending')}</td>
                    <td><span class="badge ${priorityClass}">${priority}</span></td>
                    <td>
                        <button class="btn btn-primary btn-sm call-direct-btn" data-phone-number="${call.caller_number}" style="padding: 6px 12px; font-size: 12px;">
                            Call Now
                        </button>
                    </td>
                `;
                callQueueTableBody.appendChild(row);
            });

            document.querySelectorAll('.draggable-row').forEach(row => {
                row.addEventListener('dragstart', handleDragStart);
                row.addEventListener('dragend', handleDragEnd);
            });

            document.querySelectorAll('.call-direct-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const number = e.target.dataset.phoneNumber;
                    phoneNumberInput.value = number;
                    phoneNumberInput.removeAttribute('readonly');
                    callNotesInput.value = callNotes[number] || '';
                    if (isDeviceReady && agentId) {
                        callBtn.click();
                    }
                });
            });

        } else {
            noCallsMessage.style.display = 'block';
        }
    } catch (error) {
        log(`❌ Failed to fetch call queue: ${error}`, 'error');
        noCallsMessage.style.display = 'block';
    }
}

async function removeFromQueue(phoneNumber) {
    try {
        const response = await fetch('/api/remove_lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phoneNumber }),
        });
        if (!response.ok) {
            throw new Error(`Failed to remove from queue: ${response.statusText}`);
        }
        log(`✅ ${phoneNumber} removed from call queue`, 'success');
        fetchAndRenderCallQueue();
    } catch (error) {
        log(`❌ Error removing from queue: ${error}`, 'error');
    }
}

function addCallLogEntry(callerNumber, status, duration) {
    const row = document.createElement('tr');
    row.innerHTML = `
                <td class="font-mono text-sm">${callerNumber}</td>
                <td>${getStatusBadge(status)}</td>
                <td class="text-sm">${formatDuration(duration)}</td>
                <td class="text-sm text-slate-400">${formatTime(Date.now())}</td>
            `;
    callLogTableBody.insertBefore(row, callLogTableBody.firstChild);

    if (callLogTableBody.children.length > 10) {
        callLogTableBody.removeChild(callLogTableBody.lastChild);
    }
}

function addSatisfactionEntry(rating) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="text-sm">${agentId || 'N/A'}</td>
        <td class="text-sm">${rating}</td>
        <td class="text-sm text-slate-400">${formatTime(Date.now())}</td>
    `;
    satisfactionTableBody.insertBefore(row, satisfactionTableBody.firstChild);
    noSatisfactionMessage.style.display = 'none';

    // Keep only last 10 entries
    if (satisfactionTableBody.children.length > 10) {
        satisfactionTableBody.removeChild(satisfactionTableBody.lastChild);
    }
}

function showSatisfactionModal() {
    satisfactionModal.classList.remove('hidden');
}

// --- Core Twilio Logic ---
async function initTwilio() {
    log("▶️ User clicked, initializing Twilio...");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        let chosen_agent = agentSelect.value;
        log("🎤 Microphone access granted", "success");

        const res = await fetch('/token');
        if (!res.ok) throw new Error('Failed to fetch token');
        const { token } = await res.json();

        device = new Twilio.Device(token, {
            logLevel: 1,
            codecPreferences: ["opus", "pcmu"]
        });

        device.register();
        log("📡 Device.register() called");

        device.on("ready", () => {
            log("✅ Device ready", "success");
            updateDeviceStatus("Ready", "status-ready");
            isDeviceReady = true;
        });

        device.on("error", err => {
            log("❌ Device error: " + err.message, "error");
            updateDeviceStatus("Error", "status-error");
            isDeviceReady = false;
        });

        device.on("incoming", conn => {
            log("📞 Incoming call...", "info");
            updateCallStatus("Incoming", "status-in-call");
            activeConnection = conn;
            conn.on("disconnect", () => {
                log("📴 Incoming call ended");
                updateCallStatus("Idle", "status-idle");
            });
            conn.accept();
        });

    } catch (err) {
        log("❌ Init error: " + err.message, "error");
        updateDeviceStatus("Error", "status-error");
    }
}

// --- Event Handlers ---
agentSelect.addEventListener('change', (e) => {
    agentId = e.target.value;
    agentIdText.textContent = agentId;
    updateDeviceStatus(isDeviceReady ? "Ready" : "Error", isDeviceReady ? "status-ready" : "status-error");
    log(`👤 Agent set to: ${agentId}`, "success");
    // Call initTwilio once an agent is selected
    if (agentId && !isDeviceReady) {
        initTwilio();
    }
});

callBtn.onclick = async () => {
    const num = phoneNumberInput.value.trim();
    if (!num) {
        log("❌ Enter a phone number!", "error");
        return;
    }
    if (!agentId) {
        log("❌ Please select an Agent ID before making a call", "error");
        return;
    }

    log("📲 Requesting server to call " + num);
    updateCallStatus("Connecting...", "status-in-call");
    callStartTime = Date.now();
    isUserHangup = false;

    try {
        const res = await fetch('/make_call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_id: agentId, to: num })
        });

        const data = await res.json();
        if (!res.ok) {
            log("❌ Server failed to initiate call: " + data.error, "error");
            updateCallStatus("Idle", "status-idle");
            addCallLogEntry(num, 'failed', 0);
            return;
        }

        call_sid = data.customer_call_sid;
        const conferenceName = data.conference;
        log("🎉 Server initiated call. Conference: " + conferenceName);
        activeConnection = device.connect({ params: { To: `room:${conferenceName}` } });

        activeConnection.on("accept", () => {
            log("✅ Agent connected to conference", "success");
            updateCallStatus("In Call", "status-in-call");
        });

        activeConnection.on("disconnect", () => {
            const duration = callStartTime ? Date.now() - callStartTime : 0;
            log(`📴 Call ended. Duration: ${formatDuration(duration)}`);
            updateCallStatus("Idle", "status-idle");
            addCallLogEntry(num, 'completed', duration);
            if (!isUserHangup) {
                // Now, call the satisfaction function
                getCallSatisfaction();
            }
            activeConnection = null;
            removeFromQueue(num);
            phoneNumberInput.value = '';
            phoneNumberInput.setAttribute('readonly', true);
            callNotesInput.value = '';
        });

        activeConnection.on("cancel", () => {
            const duration = callStartTime ? Date.now() - callStartTime : 0;
            log("❌ Call canceled or failed to connect", "error");
            updateCallStatus("Idle", "status-idle");
            addCallLogEntry(num, 'failed', duration);
            if (!isUserHangup) {
                getCallSatisfaction();
            }
            activeConnection = null;
            phoneNumberInput.value = '';
            phoneNumberInput.setAttribute('readonly', true);
            callNotesInput.value = '';
        });

        activeConnection.on('mute', (isMuted) => {
            log(`🎤 Call is now ${isMuted ? 'muted' : 'unmuted'}`);
            muteBtn.innerHTML = isMuted ? '<span>🔊</span> Unmute Audio' : '<span>🔇</span> Mute Audio';
            muteBtn.classList.toggle('btn-secondary', !isMuted);
            muteBtn.classList.toggle('btn-primary', isMuted);
        });

    } catch (err) {
        log("❌ Client-side error: " + err.message, "error");
        updateCallStatus("Idle", "status-idle");
        addCallLogEntry(num, 'failed', 0);
    }
};

hangupBtn.onclick = () => {
    if (activeConnection && typeof activeConnection.disconnect === "function") {
        log("📴 Disconnecting call...", "info");
        isUserHangup = true;
        activeConnection.disconnect();
        activeConnection = null;
    } else {
        log("⚠️ No active connection to disconnect", "error");
    }
    updateCallStatus("Idle", "status-idle");
    getCallSatisfaction();
};


muteBtn.onclick = () => {
    if (activeConnection) {
        isMuted = !isMuted;
        activeConnection.mute(isMuted);
    }
};

voicemailBtn.onclick = () => {
    const num = phoneNumberInput.value.trim();
    if (!num) {
        log("❌ Please select a number for voicemail delivery", "error");
        return;
    }
    voicemailModal.classList.remove('hidden');
};

voicemailCancelBtn.onclick = () => {
    voicemailModal.classList.add('hidden');
};

voicemailSendBtn.onclick = async () => {
    voicemailModal.classList.add('hidden');
    const selectedVoicemail = voicemailSelect.value;
    const num = phoneNumberInput.value.trim();

    if (!num) {
        log("❌ Please select a number before sending voicemail.", "error");
        return;
    }

    log(`🤖 Sending AI voicemail: "${selectedVoicemail}" to ${num}`, "info");

    try {
        const response = await fetch("/api/send_voicemail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                to: num,
                voicemail: selectedVoicemail
            })
        });

        const data = await response.json();
        if (response.ok) {
            log(`✅ Voicemail sent to ${num}`, "success");
            removeFromQueue(num);
            phoneNumberInput.value = '';
            phoneNumberInput.setAttribute('readonly', true);
        } else {
            log(`❌ Failed to send voicemail: ${data.error}`, "error");
        }
    } catch (err) {
        log(`❌ Error while sending voicemail: ${err.message}`, "error");
    }
};

satisfiedBtn.onclick = () => {
    addSatisfactionEntry('Satisfied');
    satisfactionModal.classList.add('hidden');
    log("✅ Call marked as satisfied", "success");
};

notSatisfiedBtn.onclick = () => {
    addSatisfactionEntry('Not Satisfied');
    satisfactionModal.classList.add('hidden');
    log("❌ Call marked as not satisfied");
};

satisfactionCancelBtn.onclick = () => {
    addSatisfactionEntry('N/A');
    satisfactionModal.classList.add('hidden');
    log("⏭️ Satisfaction assessment skipped");
};

// --- Note Saving Functionality ---
saveNotesBtn.addEventListener("click", async () => {
    const phoneNumber = phoneNumberInput.value.trim();
    if (!phoneNumber) {
        log("🚫 Please select a number before saving notes.", "error");
        return;
    }

    const noteContent = callNotesInput.value.trim();
    if (!noteContent) {
        log("⚠️ Note is empty. Nothing to save.", "error");
        return;
    }

    try {
        const res = await fetch(`/api/calls`);
        const calls = await res.json();
        const user = calls.find(c => c.caller_number === phoneNumber);

        if (!user) {
            log(`❌ No record found for number ${phoneNumber}`, "error");
            return;
        }

        const response = await fetch("/api/add_note", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: user.user_id,
                agent_id: agentId,
                note: noteContent
            })
        });

        const data = await response.json();

        if (response.ok) {
            log(`📝 Notes for ${phoneNumber} saved successfully`, "success");
        } else {
            log(`❌ Failed to save notes: ${data.error}`, "error");
        }
    } catch (err) {
        log(`❌ Error while saving notes: ${err.message}`, "error");
    }
});

// --- Initialize Application ---
document.addEventListener('DOMContentLoaded', () => {
    log("🚀 Caprae Capital Professional Softphone System Started");
    fetchAndRenderCallQueue();
    loadAgents();
    setInterval(fetchAndRenderCallQueue, 30000);

    // Initial drag-drop listeners for the input field
    phoneNumberInput.addEventListener('dragover', handleDragOver);
    phoneNumberInput.addEventListener('dragleave', handleDragLeave);
    phoneNumberInput.addEventListener('drop', handleDrop);
});

phoneNumberInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (!callBtn.disabled && phoneNumberInput.value.trim()) {
            callBtn.click();
        }
    }
});

async function loadAgents() {
    try {
        const response = await fetch("/api/agents"); // Use relative path
        const agents = await response.json();

        const dropdown = document.getElementById("agentSelect");
        dropdown.innerHTML = "";

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select Agent";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        dropdown.appendChild(defaultOption);

        agents.forEach(agent => {
            const option = document.createElement("option");
            option.value = agent.agent_id;
            option.textContent = `${agent.name} (${agent.agent_id})`;
            dropdown.appendChild(option);
        });
    } catch (err) {
        console.error("Error fetching agents:", err);
        const dropdown = document.getElementById("agentSelect");
        dropdown.innerHTML = "<option>Error loading</option>";
    }
}

// Attach the Twilio initialization to a user-driven event
window.addEventListener('DOMContentLoaded', async() => {
    // initTwilio is now called when an agent is selected
});


async function getCallSatisfaction() {
    if (!call_sid) {
        log("⚠️ No call SID available to fetch transcript", "error");
        return;
    }

    try {
        // 1️⃣ Fetch transcript from server
        const transcriptRes = await fetch(`/get_transcript/${call_sid}`);
        if (!transcriptRes.ok) {
            throw new Error(`Failed to fetch transcript: ${transcriptRes.statusText}`);
        }

        const transcriptData = await transcriptRes.json();
        if (!transcriptData.recordings || transcriptData.recordings.length === 0) {
            log("⚠️ No recordings found for this call", "error");
            return;
        }

        // For simplicity, use the first recording's transcript
        const transcriptText = transcriptData.recordings[0].transcript;

        // 2️⃣ Send transcript to Flask endpoint to get rating from LLM
        const ratingRes = await fetch("/api/gemini_rating", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: transcriptText })
        });

        if (!ratingRes.ok) {
            throw new Error(`Failed to get rating: ${ratingRes.statusText}`);
        }

        const ratingData = await ratingRes.json();
        const rating = ratingData.rating;

        if (!rating || isNaN(rating)) {
            log("⚠️ LLM did not return a valid rating", "error");
            return;
        }

        // 3️⃣ Fill the rating into the UI
        // Example: append it to callNotesInput or a dedicated field
        callNotesInput.value = `Call Rating: ${rating}/10\n` + callNotesInput.value;
        log(`✅ Call rating received: ${rating}/10`, "success");

        // Optionally, also log it in your satisfaction table
        addSatisfactionEntry(`Rating: ${rating}/10`);

    } catch (err) {
        log(`❌ Error fetching call satisfaction: ${err.message}`, "error");
    }
}