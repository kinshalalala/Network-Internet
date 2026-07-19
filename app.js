const state = {
  section: 'lab',
  destination: 'lan',
  port: '8333',
  simRuns: 0,
  visited: new Set(['lab']),
  terminalDone: new Set(),
  quizAnswers: {},
  quizScore: 0,
  sound: true,
  running: false
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function softBeep(frequency = 520, duration = 0.06) {
  if (!state.sound) return;
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch (_) { /* audio is a progressive enhancement */ }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function updateProgress() {
  let progress = state.visited.size * 12;
  if (state.simRuns) progress += 12;
  progress += Math.min(state.terminalDone.size, 6) * 3;
  if (Object.keys(state.quizAnswers).length === 6) progress += 10;
  if ($('#completionCard').classList.contains('visible')) progress = 100;
  progress = Math.min(100, progress);
  $('#progressBar').style.width = `${progress}%`;
  $('#progressLabel').textContent = `${progress}%`;
  $('#progressHint').textContent = progress === 100
    ? 'Journey complete — excellent work!'
    : state.simRuns ? 'Keep exploring each lesson.' : 'Start by sending your first packet.';
}

function navigate(section) {
  if (!document.getElementById(`section-${section}`)) return;
  state.section = section;
  state.visited.add(section);
  $$('.content-section').forEach(item => item.classList.toggle('active', item.id === `section-${section}`));
  $$('.nav-item').forEach((item, index) => {
    const isActive = item.dataset.section === section;
    item.classList.toggle('active', isActive);
    item.classList.toggle('completed', !isActive && state.visited.has(item.dataset.section));
  });
  $('#breadcrumbCurrent').textContent = $(`#section-${section}`).dataset.title;
  $('#sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateProgress();
}

$$('.nav-item').forEach(button => button.addEventListener('click', () => navigate(button.dataset.section)));
$$('.continue-button').forEach(button => button.addEventListener('click', () => navigate(button.dataset.next)));
$('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#soundToggle').addEventListener('click', event => {
  state.sound = !state.sound;
  event.currentTarget.classList.toggle('muted', !state.sound);
  showToast(state.sound ? 'Sound cues on' : 'Sound cues off');
});

function selectChoice(container, button, key, value) {
  $$('button', container).forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  state[key] = value;
  softBeep(420, .04);
}

$('#destinationChoices').addEventListener('click', event => {
  const button = event.target.closest('[data-destination]');
  if (!button || state.running) return;
  selectChoice($('#destinationChoices'), button, 'destination', button.dataset.destination);
  const messages = {
    lan: ['LOCAL NETWORK', 'This address lives on your Wi-Fi.'],
    localhost: ['LOOPBACK', 'This address points back to Alice’s laptop.'],
    internet: ['DOMAIN NAME', 'DNS must translate this name first.']
  };
  const [label, message] = messages[state.destination];
  $('#stageCallout').className = 'stage-callout';
  $('#stageCallout').innerHTML = `<span>${label}</span><strong>${message}</strong>`;
});

$('#portChoices').addEventListener('click', event => {
  const button = event.target.closest('[data-port]');
  if (!button || state.running) return;
  selectChoice($('#portChoices'), button, 'port', button.dataset.port);
});

function setJourneyStep(index, status, title, subtitle) {
  const step = $$('.journey-step')[index];
  step.className = `journey-step ${status}`;
  if (title) $('strong', step).textContent = title;
  if (subtitle) $('small', step).textContent = subtitle;
  if (status === 'active') softBeep(500 + index * 80, .05);
}

function resetJourney() {
  $$('.journey-step').forEach((step, index) => {
    step.className = 'journey-step';
    const labels = [
      ['Address', 'Where is it going?'], ['Route', 'Which path?'],
      ['Firewall', 'Is it allowed?'], ['Service', 'Which application?']
    ][index];
    $('strong', step).textContent = labels[0];
    $('small', step).textContent = labels[1];
  });
  $('#packet').removeAttribute('style');
  $('#packetLabel').removeAttribute('style');
  $('#stageCallout').className = 'stage-callout';
}

async function animatePacket(points) {
  const packet = $('#packet');
  const label = $('#packetLabel');
  packet.style.display = 'block';
  label.style.display = 'block';
  for (const point of points) {
    packet.style.transition = `left ${point.time || 650}ms ease, top ${point.time || 650}ms ease, bottom ${point.time || 650}ms ease`;
    label.style.transition = packet.style.transition;
    Object.entries(point.pos).forEach(([key, value]) => {
      packet.style[key] = value;
      label.style[key] = key === 'left' ? `calc(${value} + 28px)` : value;
    });
    await wait(point.time || 650);
  }
}

async function runSimulation() {
  if (state.running) return;
  state.running = true;
  $('#sendPacket').disabled = true;
  resetJourney();
  $('#eventTray').classList.add('visible');
  $('#journeyTitle').textContent = 'Inspecting destination…';

  const destinationData = {
    lan: { address: '192.168.1.30', route: 'Local Wi-Fi', final: { left: '80%', bottom: '95px' } },
    localhost: { address: '127.0.0.1', route: 'Loopback', final: { left: '16%', bottom: '95px' } },
    internet: { address: 'bitcoin.org → 138.68.248.245', route: 'Via router + NAT', final: { left: '49%', top: '46px' } }
  }[state.destination];

  setJourneyStep(0, 'active', state.destination === 'internet' ? 'DNS lookup' : 'Address found', destinationData.address);
  $('#stageCallout').innerHTML = `<span>STEP 1 · ADDRESS</span><strong>${state.destination === 'internet' ? 'DNS translates the name into an IP.' : `Destination: ${destinationData.address}`}</strong>`;
  await wait(800);
  setJourneyStep(0, 'done', 'Address found', destinationData.address);

  setJourneyStep(1, 'active', 'Route chosen', destinationData.route);
  $('#journeyTitle').textContent = `Sending to ${destinationData.address}:${state.port}`;
  if (state.destination === 'localhost') {
    $('#stageCallout').innerHTML = '<span>STEP 2 · LOOPBACK</span><strong>No router needed. The packet stays here.</strong>';
    await animatePacket([{ pos: { left: '20%', bottom: '126px' }, time: 450 }, { pos: { left: '16%', bottom: '95px' }, time: 450 }]);
  } else if (state.destination === 'lan') {
    $('#stageCallout').innerHTML = '<span>STEP 2 · LOCAL ROUTE</span><strong>The devices share the same local network.</strong>';
    await animatePacket([{ pos: { left: '48%', bottom: '185px' }, time: 700 }, { pos: destinationData.final, time: 700 }]);
  } else {
    $('#stageCallout').innerHTML = '<span>STEP 2 · DEFAULT GATEWAY</span><strong>The router uses NAT and forwards it outward.</strong>';
    await animatePacket([{ pos: { left: '49%', bottom: '185px' }, time: 700 }, { pos: destinationData.final, time: 700 }]);
  }
  setJourneyStep(1, 'done', 'Route chosen', destinationData.route);

  setJourneyStep(2, 'active', 'Firewall check', 'Reading the rules');
  const rpcBlocked = state.port === '8332' && state.destination !== 'localhost';
  const mismatchBlocked = state.port === '443' && state.destination === 'lan';
  await wait(750);

  if (rpcBlocked || mismatchBlocked) {
    setJourneyStep(2, 'blocked', 'Blocked', rpcBlocked ? 'RPC is private' : 'No HTTPS service');
    $('#stageCallout').className = 'stage-callout blocked';
    $('#stageCallout').innerHTML = `<span>CONNECTION BLOCKED</span><strong>${rpcBlocked ? 'Port 8332 should not accept outside connections.' : 'The node is not serving a website on port 443.'}</strong>`;
    $('#journeyTitle').textContent = 'The security rule protected the node';
    softBeep(180, .12);
  } else {
    setJourneyStep(2, 'done', 'Allowed', state.destination === 'localhost' ? 'Local access' : `Port ${state.port} open`);
    setJourneyStep(3, 'active', `Port ${state.port}`, state.port === '8333' ? 'Bitcoin P2P' : state.port === '8332' ? 'Bitcoin RPC' : 'HTTPS');
    await wait(650);
    setJourneyStep(3, 'done', 'Delivered', 'Application received it');
    $('#stageCallout').className = 'stage-callout success';
    $('#stageCallout').innerHTML = `<span>PACKET DELIVERED</span><strong>IP found the device. Port ${state.port} found the app.</strong>`;
    $('#journeyTitle').textContent = 'Connection complete!';
    softBeep(720, .08);
  }

  state.running = false;
  state.simRuns += 1;
  $('#sendPacket').disabled = false;
  updateProgress();
}

$('#sendPacket').addEventListener('click', runSimulation);
$('#resetSim').addEventListener('click', () => {
  if (state.running) return;
  resetJourney();
  $('#eventTray').classList.remove('visible');
  $('#stageCallout').innerHTML = '<span>READY?</span><strong>Choose a destination below.</strong>';
});

const tips = {
  router: '<strong>The classroom router</strong>It connects the private network to the internet. At home it often also runs DHCP, NAT, and firewall rules.',
  node: '<strong>The Bitcoin node</strong>Port 8333 talks to peer nodes. Port 8332 is RPC control access and should normally stay private.'
};
$$('.info-hotspot').forEach(button => button.addEventListener('click', event => {
  event.stopPropagation();
  const card = $('#tooltipCard');
  const box = button.getBoundingClientRect();
  card.innerHTML = tips[button.dataset.tip];
  card.style.left = `${Math.min(window.innerWidth - 260, Math.max(12, box.left - 105))}px`;
  card.style.top = `${Math.min(window.innerHeight - 130, box.bottom + 8)}px`;
  card.classList.toggle('visible');
}));
document.addEventListener('click', event => {
  if (!event.target.closest('.info-hotspot')) $('#tooltipCard').classList.remove('visible');
});

const addressContent = {
  local: {
    number: '01', title: 'Localhost stays at home',
    text: '<strong>127.0.0.1</strong> always means the device you are currently using. Pinging it tests your computer’s network software—not your Wi-Fi or internet connection.',
    command: 'ping 127.0.0.1'
  },
  private: {
    number: '02', title: 'Private addresses work inside the neighborhood',
    text: '<strong>192.168.1.25</strong> identifies Alice’s laptop on this Wi-Fi. Other local devices may reach it, but the public internet normally cannot.',
    command: 'ping 192.168.1.25'
  },
  public: {
    number: '03', title: 'One public address can represent many devices',
    text: '<strong>203.0.113.50</strong> is how this entire classroom network appears online. The router uses NAT to remember which local device started each connection.',
    command: 'curl ifconfig.me'
  }
};

$$('.address-card').forEach(card => card.addEventListener('click', () => {
  $$('.address-card').forEach(item => item.classList.remove('selected'));
  card.classList.add('selected');
  const content = addressContent[card.dataset.address];
  $('#addressExplain').innerHTML = `<span class="panel-number">${content.number}</span><div><h3>${content.title}</h3><p>${content.text}</p></div><code>${content.command}</code>`;
  softBeep(430, .04);
}));

const helpers = {
  dhcp: {
    count: 'HELPER 1 OF 5', title: 'DHCP says, “Welcome—here are your settings.”',
    text: 'When your device joins Wi-Fi, DHCP automatically supplies an IP address, subnet mask, default gateway, and DNS server.',
    remember: 'You usually don’t choose your phone’s IP address. DHCP does.', icon: 'i-router', label: 'AUTOMATIC SETUP', code: 'Join Wi-Fi → receive settings'
  },
  dns: {
    count: 'HELPER 2 OF 5', title: 'DNS turns a memorable name into a number.',
    text: 'Computers connect to IP addresses, not words. DNS looks up a name such as bitcoin.org and returns the IP address to contact.',
    remember: 'If 1.1.1.1 works but example.com does not, DNS may be the problem.', icon: 'i-dns', label: 'NAME LOOKUP', code: 'bitcoin.org → 138.68.248.245'
  },
  nat: {
    count: 'HELPER 3 OF 5', title: 'NAT lets a whole classroom share one public IP.',
    text: 'The router rewrites outgoing packet details and keeps a temporary table of local addresses and ports so replies reach the correct device.',
    remember: 'NAT maps private address + port combinations to the shared public connection.', icon: 'i-route', label: 'ADDRESS TRANSLATION', code: '192.168.1.25:51514 → 203.0.113.50:62001'
  },
  firewall: {
    count: 'HELPER 4 OF 5', title: 'The firewall checks every connection against the rules.',
    text: 'It can allow Bitcoin peer traffic on port 8333 while blocking sensitive RPC control traffic on port 8332.',
    remember: 'A listening service still cannot be reached when a firewall blocks the path.', icon: 'i-shield', label: 'SECURITY CHECK', code: '8333 ALLOW · 8332 BLOCK'
  },
  ports: {
    count: 'HELPER 5 OF 5', title: 'Ports deliver the packet to the right application.',
    text: 'A single computer can run many services. The IP address finds the computer; the logical port number identifies the intended service.',
    remember: 'A port is a logical number, not a physical socket on the computer.', icon: 'i-server', label: 'SERVICE SELECTOR', code: '192.168.1.30:8333'
  }
};

$$('.helper-tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.helper-tab').forEach(item => item.classList.remove('selected'));
  tab.classList.add('selected');
  const data = helpers[tab.dataset.helper];
  const detail = $('#helperDetail');
  detail.innerHTML = `
    <div class="helper-illustration simple-visual">
      <div class="simple-diagram">
        <svg><use href="#${data.icon}"></use></svg>
        <strong>${data.label}</strong>
        <code>${data.code}</code>
        <div class="simple-flow"><span>REQUEST</span><i>→</i><span>${tab.dataset.helper.toUpperCase()}</span><i>→</i><span>RESULT</span></div>
      </div>
    </div>
    <div class="helper-copy"><span class="helper-count">${data.count}</span><h3>${data.title}</h3><p>${data.text}</p><div class="remember"><svg><use href="#i-bulb"></use></svg><p><strong>Remember</strong>${data.remember}</p></div></div>`;
  softBeep(450, .04);
}));

const commandData = {
  'help': {
    output: 'Available commands:\n  ipconfig\n  ip addr\n  curl ifconfig.me\n  ping 127.0.0.1\n  ping 192.168.1.1\n  ping 1.1.1.1\n  nslookup example.com\n  traceroute example.com\n  clear',
    tip: 'Choose any mission to practice a network diagnostic.'
  },
  'ipconfig': {
    output: 'Wireless LAN adapter Wi-Fi:\n\n   IPv4 Address . . . . . : <span class="highlight">192.168.1.25</span>\n   Subnet Mask  . . . . . : 255.255.255.0\n   Default Gateway  . . . : <span class="highlight">192.168.1.1</span>',
    tip: 'The private IP identifies this laptop on the LAN. The gateway is the router.', mission: 0
  },
  'ip addr': {
    output: '2: wlan0: &lt;UP,LOWER_UP&gt;\n    inet <span class="highlight">192.168.1.25/24</span> brd 192.168.1.255 scope global wlan0',
    tip: 'On Linux, ip addr shows interface addresses.', mission: 0
  },
  'curl ifconfig.me': {
    output: '<span class="highlight">203.0.113.50</span>',
    tip: 'A public-IP service sees the router’s shared internet address, not the laptop’s private address.'
  },
  'ping 127.0.0.1': {
    output: 'PING 127.0.0.1: 56 data bytes\n64 bytes from 127.0.0.1: time=0.031 ms\n64 bytes from 127.0.0.1: time=0.028 ms\n\n2 packets transmitted, 2 received, 0% packet loss',
    tip: 'Success only proves the laptop’s own networking works. It does not test Wi-Fi.', mission: 1
  },
  'ping 192.168.1.1': {
    output: 'PING 192.168.1.1: 56 data bytes\n64 bytes from 192.168.1.1: time=2.14 ms\n64 bytes from 192.168.1.1: time=1.89 ms\n\n2 packets transmitted, 2 received, 0% packet loss',
    tip: 'The laptop can reach its router. If the internet fails next, look beyond the LAN.', mission: 2
  },
  'ping 1.1.1.1': {
    output: 'PING 1.1.1.1: 56 data bytes\n64 bytes from 1.1.1.1: time=18.4 ms\n64 bytes from 1.1.1.1: time=17.9 ms\n\n2 packets transmitted, 2 received, 0% packet loss',
    tip: 'The internet path works without using a domain name. Next, test DNS.', mission: 3
  },
  'nslookup example.com': {
    output: 'Server:  192.168.1.1\nAddress: 192.168.1.1#53\n\nNon-authoritative answer:\nName:    example.com\nAddress: <span class="highlight">93.184.216.34</span>',
    tip: 'DNS successfully translated example.com into an IP address.', mission: 4
  },
  'traceroute example.com': {
    output: 'traceroute to example.com (93.184.216.34), 30 hops max\n 1  <span class="highlight">192.168.1.1</span>    1.8 ms   classroom router\n 2  100.64.0.1       8.4 ms   ISP network\n 3  * * *                      no reply\n 4  93.184.216.34   24.1 ms   destination',
    tip: 'Each line is a router hop. A missing reply (*) does not always mean the path is broken.', mission: 5
  },
  'tracert example.com': {
    output: 'Tracing route to example.com [93.184.216.34]\n  1     2 ms     1 ms     2 ms  <span class="highlight">192.168.1.1</span>\n  2     9 ms     8 ms     8 ms  100.64.0.1\n  3     *        *        *     Request timed out.\n  4    24 ms    25 ms    24 ms  93.184.216.34',
    tip: 'tracert is the Windows form of traceroute.', mission: 5
  }
};

function runCommand(rawCommand) {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!command) return;
  if (command === 'clear') {
    $('#terminalHistory').innerHTML = '';
    return;
  }
  const data = commandData[command];
  const entry = document.createElement('div');
  entry.className = 'terminal-entry';
  entry.innerHTML = `<span class="prompt">student@laptop:~$</span> <span class="command">${escapeHtml(command)}</span><span class="output">${data ? data.output : `command not found: ${escapeHtml(command)}\nType 'help' to see the available commands.`}</span>`;
  $('#terminalHistory').appendChild(entry);
  if (data) {
    $('#terminalTip').innerHTML = `<svg><use href="#i-bulb"></use></svg><p><strong>What this tells you</strong>${data.tip}</p>`;
    if (Number.isInteger(data.mission)) {
      state.terminalDone.add(data.mission);
      const missions = $$('.mission');
      missions[data.mission].classList.add('completed');
      missions.forEach(item => item.classList.remove('active'));
      const next = missions[Math.min(data.mission + 1, missions.length - 1)];
      if (next) next.classList.add('active');
      updateProgress();
      softBeep(650, .05);
    }
  }
  $('#terminalScreen').scrollTop = $('#terminalScreen').scrollHeight;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

$('#terminalForm').addEventListener('submit', event => {
  event.preventDefault();
  runCommand($('#terminalInput').value);
  $('#terminalInput').value = '';
});
$$('.mission').forEach(mission => mission.addEventListener('click', () => {
  $$('.mission').forEach(item => item.classList.remove('active'));
  mission.classList.add('active');
  $('#terminalInput').value = mission.dataset.command;
  $('#terminalInput').focus();
}));
$('#terminalScreen').addEventListener('click', () => $('#terminalInput').focus());

$$('.quiz-question').forEach((question, questionIndex) => {
  $$('.answer-options button', question).forEach(button => button.addEventListener('click', () => {
    if (question.classList.contains('graded')) return;
    $$('.answer-options button', question).forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
    state.quizAnswers[questionIndex] = button.dataset.value;
    $('#checkAnswers').disabled = Object.keys(state.quizAnswers).length < 6;
    updateProgress();
    softBeep(430, .04);
  }));
});

$('#checkAnswers').addEventListener('click', () => {
  let score = 0;
  $$('.quiz-question').forEach((question, index) => {
    const correct = state.quizAnswers[index] === question.dataset.answer;
    score += correct ? 1 : 0;
    question.classList.add('graded', correct ? 'correct' : 'wrong');
    $('.answer-feedback', question).textContent = correct ? '✓ Correct — nice work.' : `Not quite. The answer is ${question.dataset.answer}.`;
    if (!correct) $(`[data-value="${CSS.escape(question.dataset.answer)}"]`, question)?.classList.add('actual-answer');
  });
  state.quizScore = score;
  $('#scoreValue').textContent = score;
  $('#scoreRing').style.background = `conic-gradient(var(--orange) ${score / 6 * 360}deg, #dde1d9 0deg)`;
  $('#checkAnswers').textContent = score === 6 ? 'PERFECT SCORE!' : `${score} OF 6 CORRECT`;
  $('#checkAnswers').disabled = true;
  $('#completionCard').classList.add('visible');
  updateProgress();
  softBeep(score === 6 ? 800 : 620, .12);
  setTimeout(() => $('#completionCard').scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
});

$('#restartLesson').addEventListener('click', () => {
  state.visited = new Set(['lab']);
  state.terminalDone.clear();
  state.quizAnswers = {};
  state.quizScore = 0;
  state.simRuns = 0;
  $$('.mission').forEach((item, index) => {
    item.classList.remove('completed', 'active');
    if (index === 0) item.classList.add('active');
  });
  $$('.quiz-question').forEach(question => {
    question.classList.remove('graded', 'correct', 'wrong');
    $$('.answer-options button', question).forEach(button => button.classList.remove('selected', 'actual-answer'));
    $('.answer-feedback', question).textContent = '';
  });
  $('#scoreValue').textContent = '0';
  $('#scoreRing').style.background = 'conic-gradient(var(--orange) 0deg, #dde1d9 0deg)';
  $('#checkAnswers').textContent = 'CHECK MY ANSWERS';
  $('#checkAnswers').disabled = true;
  $('#completionCard').classList.remove('visible');
  navigate('lab');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    $('#sidebar').classList.remove('open');
    $('#tooltipCard').classList.remove('visible');
  }
});

updateProgress();
