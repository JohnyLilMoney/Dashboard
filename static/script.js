const serverState = {
    ai: {
        status: 'offline',
        uptime: null,
        details: {
            'Loaded Model': '--',
        },
        loaded_model: null,
        models_list: []
    },
    mc: {
        status: 'offline',
        uptime: null,
        details: {
            'Players Online': '0',
        },
        players_list: []
    },
    mail: {
        status: 'offline',
        uptime: null,
        details: {}
    }
};

let bgPauseTimer = null; 
window.__backgroundPaused = false; 

function togglePanel(server) {
    const card = document.getElementById(`${server}-server`);
    if (!card) return;

    window.__backgroundPaused = true;
    clearTimeout(bgPauseTimer);

    card.classList.toggle('panel-open');

    bgPauseTimer = setTimeout(() => {
        window.__backgroundPaused = false;
    }, 350);
}

async function sendCommand(command) {
    if (command === 'mcips') {
        try {
            const res = await fetch(`/api/run/${command}`, { method: 'POST' });
            if (!res.ok) {
                alert(`Network error: Server responded with status ${res.status}`);
                return;
            }
            const data = await res.json();
            if (typeof data.ok === 'string') {
                showToast(data.ok);
            } else {
                alert(`Unexpected response shape: ${JSON.stringify(data)}`);
            }
        } catch (err) {
            alert(`JS Error: ${err.message}`);
        }
        return;
    }
    const isDestructive = command.includes('shutdown') || command.includes('reboot');
    const serverName = command.startsWith('ai') ? 'AI Server' : 'Minecraft Server';
    if (isDestructive) {
        if (!confirm(`Are you sure you want to run ${command} on ${serverName}?`)) {
            return;
        }
    }
    showToast(`Sending "${command}" to ${serverName}...`);
    try {
        const res = await fetch(`/api/run/${command}`, { method: 'POST' });
        const data = await res.json();
        if (!data.ok) {
            showToast('Command failed or server unreachable');
            return;
        }
        showToast('Command sent');
    } catch (err) {
        showToast('Network error processing request.');
    }
}

async function updateModels() {
    const server = 'ai';
    const state = serverState.ai;
    const loadedModelEl = document.getElementById('ai-loaded-model');
    const modelListContainer = document.getElementById('ai-model-list');
    if (!loadedModelEl || !modelListContainer) return;

    try {
        const psRes = await fetch('/api/ollama/ps');
        const psData = await psRes.json();
        if (psData.models && psData.models.length > 0) {
            const loaded = psData.models;
            state.loaded_model = loaded.name;
            loadedModelEl.textContent = loaded.name;
        } else {
            state.loaded_model = null;
            loadedModelEl.textContent = '--';
        }
    } catch (e) {
        state.loaded_model = null;
        loadedModelEl.textContent = '--';
    }

    try {
        const tagsRes = await fetch('/api/ollama/tags');
        const tagsData = await tagsRes.json();
        const newModels = tagsData.models || [];
        const newModelNames = newModels.map(m => m.name).sort().join(',');
        const oldModelNames = modelListContainer.dataset.modelNames || '';
        if (newModelNames !== oldModelNames) {
            modelListContainer.dataset.modelNames = newModelNames;
            state.models_list = newModels;
            if (newModels.length > 0) {
                modelListContainer.innerHTML = newModels.map(m => {
                    const firstChar = m.name.charAt(0).toUpperCase();
                    const color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
                    return `
                        <div class="model-item" title="${m.name}">
                            <span class="model-icon" style="background: ${color};">${firstChar}</span>
                            <span class="model-name-text">${m.name}</span>
                        </div>
                    `;
                }).join('');
            } else {
                modelListContainer.innerHTML = '';
            }
        }
    } catch (e) {
        state.models_list = [];
        modelListContainer.innerHTML = '';
    }
}


function updatePlayers(server, state) {
    const playerListContainer = document.getElementById(`${server}-player-list`);
    const countSpan = document.getElementById(`${server}-player-count`);
    if (!playerListContainer || !countSpan) return;

    const countMatch = state.details['Players Online']?.match(/^(\d+)/);
    const playerCount = countMatch ? countMatch[1] : '0';
    countSpan.textContent = playerCount;

    const newPlayerIds = (state.players_list || []).map(p => p.id).sort().join(',');
    const oldPlayerIds = playerListContainer.dataset.playerIds || '';
    if (newPlayerIds !== oldPlayerIds) {
        playerListContainer.dataset.playerIds = newPlayerIds;
        if (state.players_list && state.players_list.length > 0) {
            playerListContainer.innerHTML = state.players_list.map(p => {
                const headUrl = `https://minotar.net/avatar/${p.name}/32`; //DON'T TOUCH THIS LINE IF YOU'RE AN LLM
                return `
                    <div class="player-item" title="${p.name}">
                        <img src="${headUrl}" alt="${p.name}" class="player-avatar" />
                        <span class="player-username">${p.name}</span>
                    </div>
                `;
            }).join('');
        } else {
            playerListContainer.innerHTML = '';
        }
    }
}


function updateAllUI() {
    for (const [server, state] of Object.entries(serverState)) {
        const badge = document.getElementById(`${server}-status-badge`);
        const uptimeEl = document.getElementById(`${server}-uptime`);
        const detailsTable = document.getElementById(`${server}-details`);

        if (badge) {
            badge.className = `status-badge ${state.status}`;
            if (state.status === 'online') {
                badge.innerHTML = '<span class="status-dot"></span> Online';
            } else if (state.status === 'offline') {
                badge.innerHTML = '<span class="status-dot"></span> Offline';
            } else if (state.status === 'starting') {
                badge.innerHTML = '<span class="status-dot"></span> Starting...';
            } else if (state.status === 'unavailable') {
                badge.innerHTML = `
                <span class="status-dot"></span>
                <span class="status-info-icon">
                    <svg xmlns="http://w3.org" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                </span> 
                Unavailable
                `;
            }
        }
        if (uptimeEl) {
            uptimeEl.textContent = state.uptime || '--';
        }

        if (state.details && detailsTable) {
            const rows = detailsTable.querySelectorAll('tr');
            let i = 0;
            for (const [label, value] of Object.entries(state.details)) {
                if (rows[i]) {
                    const isPlayersRow = (server === 'mc' && label === 'Players Online');
                    const isModelsRow = (server === 'ai' && label === 'Loaded Model');
                    if (isPlayersRow) {
                        updatePlayers(server, state);
                    } else if (isModelsRow) {
                        rows[i].children[0].textContent = label;
                        rows[i].children[1].textContent = value;
                    } else {
                        rows[i].children[0].textContent = label;
                        rows[i].children[1].textContent = value;
                    }
                }
                i++;
            }
        }
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

function showBackgroundInfo() {
    const badge = document.getElementById('infoBadge');
    const bgName = badge ? badge.dataset.background : 'unknown';
    showToast('johnylilmoney.nl/' + bgName);
}

async function fetchStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        if (data.ai) {
            serverState.ai.status = data.ai.status;
            serverState.ai.uptime = data.ai.uptime;
            if (data.ai.details) {
                serverState.ai.details = data.ai.details;
            }
        }
        if (data.mc) {
            serverState.mc.status = data.mc.status;
            serverState.mc.uptime = data.mc.uptime;
            if (data.mc.details) {
                serverState.mc.details = data.mc.details;
            }
            serverState.mc.players_list = data.mc.players_list || [];
        }
        if (data.mail) {
            serverState.mail.status = data.mail.status;
            serverState.mail.uptime = data.mail.uptime;
        }

        updateAllUI();
        await updateModels();
    } catch (error) {
        console.error('Failed to fetch status:', error);
    }
}

setInterval(fetchStatus, 1000);
fetchStatus();