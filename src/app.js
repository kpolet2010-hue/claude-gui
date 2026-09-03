const output = document.getElementById('output');
const input = document.getElementById('prompt');
const button = document.getElementById('send');
const presetButtons = document.querySelectorAll('.preset-btn:not(.nav-btn)');
const statusText = document.getElementById('statusText');
const statusDot = document.querySelector('.status-dot');

let currentAssistantBubble = null;

window.claudeAPI.onStream((data) => {
  if (!currentAssistantBubble) {
    currentAssistantBubble = createBubble('assistant', '');
  }
  currentAssistantBubble.querySelector('.bubble-text').textContent += data;
  output.scrollTop = output.scrollHeight;
});

function createBubble(role, text) {
  const wrapper = document.createElement('div');
  wrapper.className = `bubble-row ${role}`;

  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;

  const label = document.createElement('div');
  label.className = 'bubble-label';
  label.textContent = role === 'user' ? 'Du' : 'Claude';

  const textEl = document.createElement('div');
  textEl.className = 'bubble-text';
  textEl.textContent = text;

  bubble.appendChild(label);
  bubble.appendChild(textEl);
  wrapper.appendChild(bubble);
  output.appendChild(wrapper);
  output.scrollTop = output.scrollHeight;

  return bubble;
}

function setBusy(busy) {
  statusText.textContent = busy ? 'Läuft...' : 'Bereit';
  statusDot.classList.toggle('busy', busy);
  button.disabled = busy;
}

async function runPrompt(prompt) {
  createBubble('user', prompt);
  currentAssistantBubble = null;

  setBusy(true);
  await window.claudeAPI.runClaude(prompt);
  setBusy(false);
  currentAssistantBubble = null;
}

button.addEventListener('click', () => {
  const prompt = input.value;
  if (!prompt.trim()) return;
  input.value = '';
  runPrompt(prompt);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') button.click();
});

presetButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    let prompt = btn.dataset.prompt;

    if (prompt === 'PLACEHOLDER_TOPIC') {
      const topic = window.prompt('Welches Thema soll erweitert werden?');
      if (!topic) return;
      prompt = `Research ${topic}. Find good sources yourself rather than asking me. Create or expand topic files in /wiki/ covering this, written clearly with code examples where relevant. Link related topics using [[topic-name]] format. Update index.md if new topics are added. Log what was added to log.md. Keep this efficient — avoid excessive tool calls or token usage.`;
    }

    if (prompt === 'PLACEHOLDER_SEARCH') {
      const query = window.prompt('Wonach suchst du?');
      if (!query) return;
      prompt = `Search /wiki/ and /raw-sources/ for information relevant to: ${query}. If you find a clear answer there, use it and cite which file it came from. Only if nothing relevant is found, search the web for an answer. Keep the answer concise.`;
    }

    runPrompt(prompt);
  });
});

const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    navButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    views.forEach((v) => (v.style.display = 'none'));
    document.getElementById(btn.dataset.view).style.display = 'flex';

    if (btn.dataset.view === 'usage-view') {
      loadUsage();
    }
  });
});

const refreshUsageBtn = document.getElementById('refreshUsage');
const usageRaw = document.getElementById('usage-raw');
const sessionBar = document.getElementById('sessionBar');
const sessionValue = document.getElementById('sessionValue');
const weeklyBar = document.getElementById('weeklyBar');
const weeklyValue = document.getElementById('weeklyValue');
const resetValue = document.getElementById('resetValue');

async function loadUsage() {
  usageRaw.textContent = 'Lade...';
  const raw = await window.claudeAPI.getUsage();
  usageRaw.textContent = raw || 'Keine Daten erhalten.';

  const percentMatches = raw.match(/(\d{1,3})\s*%/g);

  if (percentMatches && percentMatches.length >= 1) {
    const p1 = parseInt(percentMatches[0]);
    sessionBar.style.width = p1 + '%';
    sessionValue.textContent = p1 + '% genutzt';
  } else {
    sessionValue.textContent = 'Siehe Rohdaten unten';
  }

  if (percentMatches && percentMatches.length >= 2) {
    const p2 = parseInt(percentMatches[1]);
    weeklyBar.style.width = p2 + '%';
    weeklyValue.textContent = p2 + '% genutzt';
  } else {
    weeklyValue.textContent = 'Siehe Rohdaten unten';
  }

  const resetMatch = raw.match(/reset[s]?\s*(in|at)?\s*[:\-]?\s*(.+)/i);
  resetValue.textContent = resetMatch ? resetMatch[0].slice(0, 60) : 'Siehe Rohdaten unten';
}

refreshUsageBtn.addEventListener('click', loadUsage);

navButtons.forEach((btn) => {
  if (btn.dataset.view === 'home-view') {
    btn.addEventListener('click', drawGlowChart);
  }
});

async function drawGlowChart() {
  const promptStats = await window.claudeAPI.getPromptStats();
  const gitStats = await window.claudeAPI.getGitStats();

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const promptValues = days.map((d) => promptStats[d] || 0);
  const gitValues = days.map((d) => gitStats[d] || 0);

  const allValues = [...promptValues, ...gitValues];
  const max = Math.max(...allValues, 1); 

  const width = 600;
  const height = 220;
  const padding = 20;
  const stepX = (width - padding * 2) / (days.length - 1);

  function toPoints(values) {
    return values.map((v, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (v / max) * (height - padding * 2);
      return { x, y };
    });
  }

  function toPath(points) {
    return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  }

  const promptPoints = toPoints(promptValues);
  const promptLine = toPath(promptPoints);
  const promptArea =
    promptLine +
    ` L ${promptPoints[promptPoints.length - 1].x} ${height - padding} L ${promptPoints[0].x} ${height - padding} Z`;

  document.getElementById('linePath').setAttribute('d', promptLine);
  document.getElementById('areaPath').setAttribute('d', promptArea);

  const dotsGroup = document.getElementById('dots');
  dotsGroup.innerHTML = '';
  promptPoints.forEach((p) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', 4);
    dotsGroup.appendChild(circle);
  });

  const gitPoints = toPoints(gitValues);
  const gitLine = toPath(gitPoints);

  let gitPathEl = document.getElementById('gitLinePath');
  if (!gitPathEl) {
    gitPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    gitPathEl.setAttribute('id', 'gitLinePath');
    gitPathEl.setAttribute('fill', 'none');
    gitPathEl.setAttribute('stroke', '#3ecf8e');
    gitPathEl.setAttribute('stroke-width', '2');
    gitPathEl.setAttribute('stroke-dasharray', '5,4');
    document.getElementById('glowChart').appendChild(gitPathEl);
  }
  gitPathEl.setAttribute('d', gitLine);

  const labelsEl = document.getElementById('graph-labels');
  const dayLabels = days.map((d) => d.slice(5)); // "MM-DD"
  labelsEl.innerHTML = dayLabels.map((d) => `<span>${d}</span>`).join('');
}

drawGlowChart();

const homeSessionValue = document.getElementById('homeSessionValue');
const homeWeeklyValue = document.getElementById('homeWeeklyValue');

async function loadHomeStats() {
  const raw = await window.claudeAPI.getUsage();
  const percentMatches = raw.match(/(\d{1,3})\s*%/g);

  homeSessionValue.textContent = percentMatches && percentMatches[0] ? percentMatches[0] : '–';
  homeWeeklyValue.textContent = percentMatches && percentMatches[1] ? percentMatches[1] : '–';
}

loadHomeStats();

const vaultWikiList = document.getElementById('vaultWikiList');
const vaultSourcesList = document.getElementById('vaultSourcesList');
const vaultWikiCount = document.getElementById('vaultWikiCount');
const vaultSourcesCount = document.getElementById('vaultSourcesCount');

function formatRelativeDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

function renderVaultList(container, items, isWiki) {
  container.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'vault-empty';
    empty.textContent = 'Keine Dateien gefunden.';
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'vault-row';

    const name = document.createElement('span');
    name.className = 'vault-row-name';
    name.textContent = isWiki ? item.name.replace(/\.md$/, '').replace(/[-_]/g, ' ') : item.name;

    const date = document.createElement('span');
    date.className = 'vault-row-date';
    date.textContent = formatRelativeDate(item.mtime);

    row.appendChild(name);
    row.appendChild(date);
    container.appendChild(row);
  });
}

async function loadVault() {
  const data = await window.claudeAPI.getVault();
  vaultWikiCount.textContent = data.wiki.length;
  vaultSourcesCount.textContent = data.sources.length;
  renderVaultList(vaultWikiList, data.wiki, true);
  renderVaultList(vaultSourcesList, data.sources, false);
}

navButtons.forEach((btn) => {
  if (btn.dataset.view === 'vault-view') {
    btn.addEventListener('click', loadVault);
  }
});

const sessionsList = document.getElementById('sessions-list');
const sessionsDetailEmpty = document.getElementById('sessions-detail-empty');
const sessionsDetailMessages = document.getElementById('sessions-detail-messages');

function formatSessionDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

async function loadSessions() {
  const sessions = await window.claudeAPI.listSessions();
  sessionsList.innerHTML = '';

  sessionsDetailEmpty.style.display = 'flex';
  sessionsDetailEmpty.textContent = 'Wähle einen Chat aus der Liste.';
  sessionsDetailMessages.style.display = 'none';
  sessionsDetailMessages.innerHTML = '';

  if (!sessions.length) {
    const empty = document.createElement('div');
    empty.className = 'vault-empty';
    empty.textContent = 'Keine Chats gefunden.';
    sessionsList.appendChild(empty);
    return;
  }

  sessions.forEach((session) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'session-row';

    const title = document.createElement('div');
    title.className = 'session-row-title';
    title.textContent = session.title;

    const date = document.createElement('div');
    date.className = 'session-row-date';
    date.textContent = formatSessionDate(session.mtime);

    row.appendChild(title);
    row.appendChild(date);
    row.addEventListener('click', () => openSession(session.id, row));
    sessionsList.appendChild(row);
  });
}

async function openSession(id, rowEl) {
  document.querySelectorAll('.session-row.active').forEach((el) => el.classList.remove('active'));
  if (rowEl) rowEl.classList.add('active');

  sessionsDetailEmpty.style.display = 'flex';
  sessionsDetailEmpty.textContent = 'Lädt...';
  sessionsDetailMessages.style.display = 'none';

  const messages = await window.claudeAPI.getSession(id);

  if (!messages.length) {
    sessionsDetailEmpty.textContent = 'Keine Textinhalte in diesem Chat.';
    return;
  }

  sessionsDetailEmpty.style.display = 'none';
  sessionsDetailMessages.style.display = 'block';
  sessionsDetailMessages.innerHTML = '';

  messages.forEach((msg) => {
    const wrapper = document.createElement('div');
    wrapper.className = `bubble-row ${msg.role}`;

    const bubble = document.createElement('div');
    bubble.className = `bubble ${msg.role}`;

    const label = document.createElement('div');
    label.className = 'bubble-label';
    label.textContent = msg.role === 'user' ? 'Du' : 'Claude';

    const text = document.createElement('div');
    text.className = 'bubble-text';
    text.textContent = msg.text;

    bubble.appendChild(label);
    bubble.appendChild(text);
    wrapper.appendChild(bubble);
    sessionsDetailMessages.appendChild(wrapper);
  });
}

navButtons.forEach((btn) => {
  if (btn.dataset.view === 'sessions-view') {
    btn.addEventListener('click', loadSessions);
  }
});