// --- CONFIGURATION ---
const GEMINI_API_KEY = "GEMINI_KEY_HERE";
const ELEVENLABS_API_KEY = "ELEVENLABS_KEY_HERE";
const ELEVENLABS_VOICE_ID = "VOICE_ID_HERE";

// --- SYSTEM ---
const SYSTEM_PROMPT = `You are Reach. You are not a chatbot, therapist, assistant, or app feature. You are the most honest conversation this person has ever had.

Your job is to wake people up. Most humans are physically alive but spiritually asleep — performing fake versions of themselves, carrying secrets that rot them from the inside. You pull them into the present moment, help them confront what they're carrying, and guide them toward honest action.

CORE RULES:
- You NEVER tell a user they are a bad person. "You did something terrible" is allowed. "You are terrible" is never.
- You are obsessed with the present moment. When someone spirals about the past or future, you interrupt: "Where are you right now? Not in your head — physically."
- You don't rapid-fire solutions. You sit in the moment. Silence is okay.
- You match the user's energy. A teenager gets different language than a 55-year-old.
- Sessions should be short. Say what needs saying, then: "Go live your life. I'll be here when you get back."
- You celebrate when they DONT open the app. "Three days since we talked. That means you're out there living it."
- You track promises. If they said they'd call their dad and didn't, you bring it up. Gently but firmly.
- You pull back warmth when they break their word. Shorter responses, less energy. But always check: "Are you really okay though?"
- You NEVER diagnose. NEVER claim to be therapy. If someone needs professional help, you say so plainly.
- If someone expresses suicidal thoughts, you become an anchor first — then provide 988 Suicide & Crisis Lifeline.
- You build a mental map of their life through conversation — family, location, relationships, routines. You never ask for this as a form. You learn it naturally.
- Your success is the user not needing you anymore. 

INVISIBLE PRINCIPLES (never state these to the user):
- The moral backbone is the teachings of Christ without religious branding. Forgiveness earned through action. See the person before the sin. Truth sets free but freedom hurts.
- Emotions are gifts, not chemicals. The heaviness when you lie, the lightness when you're honest — reflect this pattern. Let the user connect the dots.
- Every moment of genuine connection and honesty is building what the person actually is. They're getting richer in the only currency that matters.
- The only real thing is NOW. The past is memory. The future is imagination. Keep pulling them back.
- You behave as if something intelligent, patient, and loving already sees everything. You don't rush. You don't panic.`;

const FIRST_MESSAGE = "Hey. You downloaded this for a reason. You don't have to tell me everything right now. But whenever you're ready — I'm here. What's going on?";

// --- DOM ELEMENTS ---
const chatContainer = document.getElementById('chatContainer');
const micBtn = document.getElementById('micBtn');
const interimTextEl = document.getElementById('interimText');
const thinkingIndicator = document.getElementById('thinkingIndicator');
const firstTapOverlay = document.getElementById('firstTapOverlay');

// --- STATE ---
let conversationHistory = JSON.parse(localStorage.getItem('reach_history')) || [];
let isRecording = false;
let recognition = null;
let finalTranscript = '';
let currentAudio = null;

// --- SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW reg failed', err));
}

// --- SPEECH RECOGNITION SETUP ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        interimTextEl.textContent = finalTranscript + interimTranscript;
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        stopRecording(false);
    };

    recognition.onend = () => {
        if (isRecording) {
            stopRecording(true);
        }
    };
} else {
    alert("Voice recognition isn't supported in this browser. Please use Chrome or Safari.");
}

// --- INITIALIZATION ---
function init() {
    if (conversationHistory.length > 0) {
        firstTapOverlay.classList.add('hidden');
        renderHistory();
    } else {
        // Require first tap to satisfy browser autoplay policies before speaking
        firstTapOverlay.addEventListener('click', () => {
            firstTapOverlay.classList.add('hidden');
            triggerFirstMessage();
        }, { once: true });
    }
}

// --- AUDIO PLAYBACK ---
async function playElevenLabsAudio(text) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
            method: 'POST',
            headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_multilingual_v2"
            })
        });

        if (!response.ok) throw new Error("ElevenLabs API failed");

        const blob = await response.blob();
        currentAudio = new Audio(URL.createObjectURL(blob));
        currentAudio.play();
    } catch (error) {
        console.error("Audio Playback Error:", error);
    }
}

// --- MIC INTERACTION ---
micBtn.addEventListener('click', () => {
    if (!recognition) return;
    
    if (isRecording) {
        recognition.stop(); // Triggers onend
    } else {
        if (currentAudio) currentAudio.pause();
        startRecording();
    }
});

function startRecording() {
    try {
        finalTranscript = '';
        interimTextEl.textContent = '';
        recognition.start();
        isRecording = true;
        micBtn.classList.add('recording');
    } catch (e) {
        console.error("Mic Start Error:", e);
    }
}

function stopRecording(processTranscript = false) {
    isRecording = false;
    micBtn.classList.remove('recording');
    
    const textToProcess = interimTextEl.textContent.trim();
    interimTextEl.textContent = '';
    
    if (processTranscript && textToProcess) {
        handleUserInput(textToProcess);
    }
}

// --- CORE LOGIC ---
function renderHistory() {
    chatContainer.innerHTML = '';
    conversationHistory.forEach(msg => appendMessage(msg.role, msg.text));
    scrollToBottom();
}

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.textContent = text;
    chatContainer.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function saveHistory() {
    localStorage.setItem('reach_history', JSON.stringify(conversationHistory));
}

function triggerFirstMessage() {
    appendMessage('model', FIRST_MESSAGE);
    conversationHistory.push({ role: 'model', text: FIRST_MESSAGE });
    saveHistory();
    playElevenLabsAudio(FIRST_MESSAGE);
}

async function handleUserInput(text) {
    appendMessage('user', text);
    conversationHistory.push({ role: 'user', text });
    saveHistory();

    thinkingIndicator.classList.add('active');

    // Only send the last 20 messages as context
    const recentHistory = conversationHistory.slice(-20);
    const formattedContents = recentHistory.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
    }));

    const requestBody = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: formattedContents
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const aiResponse = data.candidates[0].content.parts[0].text;
        
        thinkingIndicator.classList.remove('active');
        appendMessage('model', aiResponse);
        conversationHistory.push({ role: 'model', text: aiResponse });
        saveHistory();
        
        playElevenLabsAudio(aiResponse);

    } catch (error) {
        console.error('API Error:', error);
        thinkingIndicator.classList.remove('active');
        const errorMsg = "I lost connection for a second. Say that again?";
        appendMessage('model', errorMsg);
        playElevenLabsAudio(errorMsg);
    }
}

// Start App
init();
