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

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const micBtn = document.getElementById('micBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const installAppBtn = document.getElementById('installAppBtn');

// State
let conversationHistory = JSON.parse(localStorage.getItem('reach_history')) || [];
let isRecording = false;
let recognition = null;
let deferredPrompt;

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW reg failed', err));
}

// PWA Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installAppBtn.style.display = 'block';
});

installAppBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') installAppBtn.style.display = 'none';
        deferredPrompt = null;
    }
});

// Setup Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
            handleUserInput(transcript);
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        stopRecording();
    };

    recognition.onend = () => {
        stopRecording();
    };
} else {
    alert("Voice recognition isn't supported in this browser. Please use Chrome or Safari.");
}

// Initialization
function init() {
    const apiKey = localStorage.getItem('reach_apiKey');
    if (!apiKey) {
        settingsModal.classList.add('active');
    } else {
        renderHistory();
        if (conversationHistory.length === 0) {
            triggerFirstMessage();
        }
    }
}

// Settings handlers
settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = localStorage.getItem('reach_apiKey') || '';
    settingsModal.classList.add('active');
});

saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('reach_apiKey', key);
        settingsModal.classList.remove('active');
        renderHistory();
        
        // Browsers require a user gesture to start speech synthesis. 
        // Saving the API key counts as that gesture.
        if (conversationHistory.length === 0) {
            triggerFirstMessage();
        }
    }
});

// Mic interaction
micBtn.addEventListener('click', () => {
    if (!recognition) return;
    
    if (isRecording) {
        recognition.stop();
    } else {
        // Stop any current speech before listening
        window.speechSynthesis.cancel();
        startRecording();
    }
});

function startRecording() {
    try {
        recognition.start();
        isRecording = true;
        micBtn.classList.add('recording');
    } catch (e) {
        console.error(e);
    }
}

function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
}

// Core Logic
function renderHistory() {
    chatContainer.innerHTML = '';
    conversationHistory.forEach(msg => appendMessage(msg.role, msg.text, false));
    scrollToBottom();
}

function appendMessage(role, text, animate = true) {
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

function speakText(text) {
    if (!window.speechSynthesis) return;
    
    window.speechSynthesis.cancel(); // clear queue
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Slightly slower, more intentional pacing
    utterance.pitch = 0.9;
    
    // Attempt to pick an english natural sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Natural') || v.name.includes('Premium')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
}

function triggerFirstMessage() {
    appendMessage('model', FIRST_MESSAGE);
    conversationHistory.push({ role: 'model', text: FIRST_MESSAGE });
    saveHistory();
    speakText(FIRST_MESSAGE);
}

async function handleUserInput(text) {
    appendMessage('user', text);
    conversationHistory.push({ role: 'user', text });
    saveHistory();

    const apiKey = localStorage.getItem('reach_apiKey');
    if (!apiKey) {
        settingsModal.classList.add('active');
        return;
    }

    // Format history for Gemini API
    const formattedContents = conversationHistory.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
    }));

    const requestBody = {
        system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: formattedContents
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);

        const aiResponse = data.candidates[0].content.parts[0].text;
        
        appendMessage('model', aiResponse);
        conversationHistory.push({ role: 'model', text: aiResponse });
        saveHistory();
        speakText(aiResponse);

    } catch (error) {
        console.error('API Error:', error);
        appendMessage('model', "I lost connection for a second. Can you say that again?");
    }
}

// Ensure voices are loaded for the first synth call
window.speechSynthesis.onvoiceschanged = () => {};

// Start App
init();
