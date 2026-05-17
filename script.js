(function initStarfield() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

  function createStars() {
    stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.2,
      speed: Math.random() * 0.25 + 0.05,
      opacity: Math.random(),
      flicker: Math.random() * 0.02 + 0.003,
    }));
  }

  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.opacity += s.flicker * (Math.random() > 0.5 ? 1 : -1);
      s.opacity = Math.max(0.1, Math.min(0.9, s.opacity));
      s.y += s.speed;
      if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.opacity})`;
      ctx.fill();
    });
    requestAnimationFrame(drawStars);
  }

  resize(); createStars(); drawStars();
  window.addEventListener('resize', () => { resize(); createStars(); });
})();

async function callAI(systemPrompt, userMessage, historyMessages = []) {
  const messages = [...historyMessages, { role: 'user', content: userMessage }];
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: systemPrompt, messages }),
  });
  if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${response.status}`); }
  const data = await response.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function scrollMessages() { const el = document.getElementById('chatMessages'); if (el) el.scrollTop = el.scrollHeight; }
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; }
function scrollToChat() { document.getElementById('ai-chat').scrollIntoView({ behavior: 'smooth' }); }

const CHAT_SYSTEM = `Ты AstroMind — дружелюбный ИИ-наставник по астрофизике. Отвечай на русском языке. Адаптируй уровень сложности под вопрос. Используй эмодзи-маркеры (🌌 🔭 ⚡ 💡) для разделения блоков. Всегда заканчивай интересным фактом или вопросом. Максимум ~350 слов.`;
let chatHistory = [];

function addMessage(text, isUser, isTyping = false) {
  const container = document.getElementById('chatMessages');
  const wrapper = document.createElement('div');
  wrapper.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  if (isTyping) {
    wrapper.id = 'typingIndicator';
    wrapper.className += ' typing-indicator';
    bubble.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
  } else {
    bubble.innerHTML = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
  }
  wrapper.appendChild(bubble);
  container.appendChild(wrapper);
  scrollMessages();
  return wrapper;
}

function showTyping() { addMessage('', false, true); }
function hideTyping() { const el = document.getElementById('typingIndicator'); if (el) el.remove(); }

async function sendMessage() {
  const input = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const text = input.value.trim();
  if (!text) return;
  input.value = ''; input.style.height = 'auto';
  sendBtn.disabled = true; input.disabled = true;
  addMessage(text, true);
  chatHistory.push({ role: 'user', content: text });
  showTyping();
  try {
    const history = chatHistory.slice(0, -1);
    const reply = await callAI(CHAT_SYSTEM, text, history);
    hideTyping(); addMessage(reply, false);
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 12) chatHistory = chatHistory.slice(-12);
  } catch (err) {
    hideTyping(); addMessage(`⚠️ Ошибка: ${err.message}`, false);
    chatHistory.pop();
  } finally {
    sendBtn.disabled = false; input.disabled = false; input.focus();
  }
}

function sendQuick(question) { const input = document.getElementById('userInput'); input.value = question; scrollToChat(); setTimeout(sendMessage, 300); }
function askTopic(topic) { sendQuick(`Объясни подробно тему "${topic}" в астрофизике`); }
function clearChat() {
  chatHistory = [];
  document.getElementById('chatMessages').innerHTML = '';
  addMessage('Чат очищен. Привет снова! 🌌\n\nО чём поговорим сегодня?', false);
}
function handleKey(event) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }

const QUIZ_GEN_SYSTEM = `Ты генератор вопросов для квиза по астрофизике. Отвечай ТОЛЬКО в JSON без markdown: {"question":"...","hint":"..."}. Вопросы на русском языке.`;
const QUIZ_CHECK_SYSTEM = `Ты проверяющий по астрофизике. Оцени ответ ученика. Отвечай на русском в JSON без markdown: {"score":число 0-10,"verdict":"Отлично|Хорошо|Частично верно|Неверно","feedback":"объяснение с правильным ответом"}`;
let currentQuizTopic = 'Чёрные дыры';
let currentQuestion = '';

function setQuizTopic(btn) {
  document.querySelectorAll('.qtopic').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentQuizTopic = btn.dataset.t;
}

async function generateQuiz() {
  const genBtn = document.getElementById('quizGenBtn');
  const quizCard = document.getElementById('quizCard');
  const quizQuestion = document.getElementById('quizQuestion');
  const quizResult = document.getElementById('quizResult');
  const checkBtn = document.getElementById('checkBtn');
  const nextBtn = document.getElementById('nextQuizBtn');
  genBtn.disabled = true; genBtn.textContent = '⏳ Генерирую...';
  quizCard.style.display = 'none'; quizResult.style.display = 'none'; nextBtn.style.display = 'none';
  try {
    const raw = await callAI(QUIZ_GEN_SYSTEM, `Тема: ${currentQuizTopic}. Сгенерируй один вопрос.`);
    const clean = raw.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch { const m = clean.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { question: clean, hint: '' }; }
    currentQuestion = parsed.question;
    quizQuestion.innerHTML = `<strong>${currentQuizTopic}</strong><br/><br/>${parsed.question}${parsed.hint ? `<br/><small style="color:var(--text-dim);font-size:0.8rem;margin-top:8px;display:block">💡 ${parsed.hint}</small>` : ''}`;
    document.getElementById('quizAnswer').value = '';
    checkBtn.disabled = false; checkBtn.textContent = 'Проверить ответ';
    quizCard.style.display = 'block';
  } catch (err) { alert(`Ошибка: ${err.message}`); }
  finally { genBtn.disabled = false; genBtn.textContent = '🎲 Сгенерировать вопрос'; }
}

async function checkAnswer() {
  const checkBtn = document.getElementById('checkBtn');
  const quizResult = document.getElementById('quizResult');
  const nextBtn = document.getElementById('nextQuizBtn');
  const answer = document.getElementById('quizAnswer').value.trim();
  if (!answer) { alert('Напиши свой ответ!'); return; }
  checkBtn.disabled = true; checkBtn.textContent = '⏳ Проверяю...';
  quizResult.style.display = 'none';
  try {
    const raw = await callAI(QUIZ_CHECK_SYSTEM, `Вопрос: ${currentQuestion}\nОтвет ученика: ${answer}`);
    const clean = raw.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch { const m = clean.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { score: '?', verdict: 'Проверено', feedback: clean }; }
    const score = parsed.score ?? '?';
    const scoreColor = score >= 8 ? '#4ade80' : score >= 5 ? '#ffd166' : '#ff6b6b';
    const scoreIcon = score >= 8 ? '🏆' : score >= 5 ? '👍' : '📚';
    quizResult.innerHTML = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;"><span style="font-size:2rem">${scoreIcon}</span><div><div style="font-family:'Orbitron',sans-serif;font-size:1.1rem;font-weight:700;color:${scoreColor}">${parsed.verdict}</div><div style="font-size:0.8rem;color:var(--text-dim)">Оценка: <strong style="color:${scoreColor}">${score}/10</strong></div></div></div><p style="font-size:0.9rem;line-height:1.7">${parsed.feedback.replace(/\n/g,'<br>')}</p>`;
    quizResult.style.display = 'block'; nextBtn.style.display = 'inline-block';
    quizResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) { quizResult.innerHTML = `<p style="color:var(--accent3)">⚠️ ${err.message}</p>`; quizResult.style.display = 'block'; }
  finally { checkBtn.disabled = false; checkBtn.textContent = 'Проверить ответ'; }
}

(function initScrollAnimation() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => { entry.target.style.opacity = '1'; entry.target.style.transform = 'translateY(0)'; }, i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.topic-card').forEach(el => {
    el.style.opacity = '0'; el.style.transform = 'translateY(30px)'; el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
})();