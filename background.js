let isRunning = false
let isPaused = false
let currentDelay = 10000

let activeTabId = null

let progressState = {
  lvl: null,
  feitas: 0,
  total: 0
}

function embaralhar(array) {
  let m = array.length, t, i

  while (m) {
    i = Math.floor(Math.random() * m--)
    t = array[m]
    array[m] = array[i]
    array[i] = t
  }

  return array
}

function safeSendMessage(message) {
  chrome.runtime.sendMessage(message, () => {
    if (chrome.runtime.lastError) {}
  })
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action?.startsWith("START_LVL")) {

    if (isRunning) return

    isRunning = true
    isPaused = false

    const lvl = parseInt(request.action.replace("START_LVL", ""))

    currentDelay = request.config.delayMs

    executarFluxo(request.config, lvl, "https://www.bing.com/search?q=")
  }

  if (request.action === "PAUSE") {
    isPaused = true
  }

  if (request.action === "RESUME") {
    isPaused = false
  }

  if (request.action === "CANCEL") {

    isRunning = false
    isPaused = false

    if (activeTabId) {
      chrome.tabs.remove(activeTabId)
      activeTabId = null
    }

  }

  if (request.action === "UPDATE_DELAY") {
    currentDelay = request.delay
  }

  if (request.action === "GET_PROGRESS") {
    sendResponse(progressState)
  }

  return true
})

async function waitIfPaused() {

  while (isPaused && isRunning) {
    await new Promise(r => setTimeout(r, 300))
  }

}

async function waitDelay() {

  let elapsed = 0

  while (elapsed < currentDelay && isRunning) {

    await waitIfPaused()

    await new Promise(r => setTimeout(r, 200))

    elapsed += 200
  }

}

function enviarProgresso(feitas, total, lvl) {

  progressState = { feitas, total, lvl }

  safeSendMessage({
    action: "UPDATE_PROGRESS",
    feitas,
    total,
    lvl
  })

}

async function realizarBusca(termo, mobile, baseUrl) {
  const url = baseUrl + encodeURIComponent(termo);

  try {
    // 1. Gerencia a aba (Cria ou Atualiza)
    if (!activeTabId) {
      const tab = await chrome.tabs.create({ url, active: mobile }); // Mobile precisa ser active:true
      activeTabId = tab.id;
    } else {
      try {
        await chrome.tabs.update(activeTabId, { url, active: mobile });
      } catch (e) {
        // Se a aba foi fechada, cria uma nova
        const tab = await chrome.tabs.create({ url, active: mobile });
        activeTabId = tab.id;
      }
    }

    // 2. Lógica Mobile (Debugger)
    if (mobile) {
      try {
        await chrome.debugger.attach({ tabId: activeTabId }, "1.3");
        
        await chrome.debugger.sendCommand(
          { tabId: activeTabId },
          "Network.setUserAgentOverride",
          { userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36 BingSap/1.0" }
        );

        await chrome.debugger.sendCommand(
          { tabId: activeTabId },
          "Emulation.setDeviceMetricsOverride",
          { width: 360, height: 740, deviceScaleFactor: 3, mobile: true }
        );

        // ESPERA o tempo de pesquisa ANTES de desconectar o debugger
        await waitDelay();

        await chrome.debugger.detach({ tabId: activeTabId });
      } catch (e) {
        console.error("Erro no Debugger:", e);
        // Se falhar o debugger, tenta apenas esperar
        await waitDelay();
      }
    } else {
      // Busca Desktop normal
      await waitDelay();
    }

  } catch (err) {
    console.error("Erro fatal na busca:", err);
    activeTabId = null; // Reseta para tentar recuperar na próxima
  }
}

async function executarFluxo(config, lvl, baseUrl) {

  const { web = 0, mobile = 0, pesquisas } = config

  let feitas = 0

  const total = (parseInt(web) || 0) + (parseInt(mobile) || 0)

  const bancoDados = embaralhar([...pesquisas])

  progressState = { feitas: 0, total, lvl }

  for (let i = 0; i < web; i++) {

    if (!isRunning) break

    await waitIfPaused()

    const termo =
      bancoDados[i % bancoDados.length] +
      " " +
      Math.random().toString(36).substring(7, 10)

    await realizarBusca(termo, false, baseUrl)

    feitas++

    enviarProgresso(feitas, total, lvl)

  }

  for (let i = 0; i < mobile; i++) {

    if (!isRunning) break

    await waitIfPaused()

    const index =
      (i + (parseInt(web) || 0)) % bancoDados.length

    const termo =
      bancoDados[index] +
      " " +
      Math.random().toString(36).substring(7, 10)

    await realizarBusca(termo, true, baseUrl)

    feitas++

    enviarProgresso(feitas, total, lvl)

  }

  isRunning = false

  progressState = {
    lvl: null,
    feitas: 0,
    total: 0
  }

  safeSendMessage({
    action: "FINISHED",
    lvl
  })

}