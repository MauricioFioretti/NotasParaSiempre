// ================== CONFIG ==================
const API_URL = "https://script.google.com/macros/s/AKfycbyoo4vmC69r4kJpGgAECswXegWbiYRLYyDVkJuzJfvqCTKKyuLS_kEqORm5Kxa36oDm/exec";

// ================== CONFIG OAUTH (GIS) ==================
const OAUTH_CLIENT_ID = "996065564370-smpb9t1d296p59vpotbqv8fvv3d5v3sh.apps.googleusercontent.com";

// ⚠️ IMPORTANTE:
// Con SOLO openid/email/profile (+userinfo.*) Google aplica una EXCEPCIÓN en "Testing"
// y deja autorizar a cualquier cuenta (no respeta la lista de test users).
// Para que "Testing" respete la lista de test users, pedimos 1 scope adicional.
const OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",

  // Scope adicional (elige uno "liviano" pero que rompa la excepción):
  // Con esto, en modo TESTING, SOLO tus "test users" podrán autorizar.
  "https://www.googleapis.com/auth/drive.metadata.readonly"
].join(" ");


// LocalStorage OAuth
const LS_OAUTH = "notas_oauth_token_v1";       // {access_token, expires_at}
const LS_OAUTH_EMAIL = "notas_oauth_email_v1"; // email hint

// Cache opcional de notas (carga instantánea)
const LS_NOTES_CACHE = "notas_cache_v1";

// ================== HEADER UI ==================
const header = document.querySelector("header");
header.classList.add("app-header"); // (solo estilo)

const seccionTitulo = document.createElement("section");
seccionTitulo.classList = "titulo";
header.appendChild(seccionTitulo);

// fila 1: título
const headerRow1 = document.createElement("div");
headerRow1.className = "header-row header-row-1";
seccionTitulo.appendChild(headerRow1);

const h1 = document.createElement("h1");
h1.innerText = "Notas para siempre";
headerRow1.appendChild(h1);

// fila 2: barra (status + email) + botones
const headerRow2 = document.createElement("div");
headerRow2.className = "header-row header-row-2";
seccionTitulo.appendChild(headerRow2);

// contenedor general
const authBar = document.createElement("div");
authBar.className = "auth-bar";
headerRow2.appendChild(authBar);

// lado izq: status + cuenta
const authLeft = document.createElement("div");
authLeft.className = "auth-left";
authBar.appendChild(authLeft);

const syncPill = document.createElement("div");
syncPill.className = "sync-pill";
syncPill.innerHTML = `<span class="sync-dot"></span><span class="sync-text">Cargando…</span>`;
authLeft.appendChild(syncPill);

const accountPill = document.createElement("div");
accountPill.className = "account-pill";
accountPill.style.display = "none";
authLeft.appendChild(accountPill);

// lado der: acciones
const headerActions = document.createElement("div");
headerActions.className = "header-actions";
authBar.appendChild(headerActions);

const btnConnect = document.createElement("button");
btnConnect.className = "btn-connect";
btnConnect.type = "button";
btnConnect.textContent = "Conectar";
btnConnect.dataset.mode = "connect"; // connect | switch
headerActions.appendChild(btnConnect);

const btnRefresh = document.createElement("button");
btnRefresh.className = "btn-refresh";
btnRefresh.type = "button";
btnRefresh.textContent = "↻";
btnRefresh.title = "Reintentar conexión";
btnRefresh.style.display = "none";
headerActions.appendChild(btnRefresh);

// ================== MAIN UI ==================
const main = document.querySelector("main");

main.classList.add("app-main"); // (solo estilo)

const seccionAgregar = document.createElement("section");
seccionAgregar.classList = "agregarNota";
main.appendChild(seccionAgregar);

const labelTitulo = document.createElement("label");
labelTitulo.innerText = "Título de la nota:";
labelTitulo.htmlFor = "titulo-nota";
seccionAgregar.appendChild(labelTitulo);

const inputTitulo = document.createElement("input");
inputTitulo.type = "text";
inputTitulo.id = "titulo-nota";
inputTitulo.placeholder = "Ej: Mejor fila del cine";
seccionAgregar.appendChild(inputTitulo);

const labelTexto = document.createElement("label");
labelTexto.innerText = "Nota / indicación:";
labelTexto.htmlFor = "texto-nota";
seccionAgregar.appendChild(labelTexto);

const textareaTexto = document.createElement("textarea");
textareaTexto.id = "texto-nota";
textareaTexto.rows = 4;
textareaTexto.placeholder = "Ej: La mejor fila es la K, asientos del medio.";
seccionAgregar.appendChild(textareaTexto);

const buttonAgregar = document.createElement("button");
buttonAgregar.innerText = "Agregar nota";
seccionAgregar.appendChild(buttonAgregar);

const muralNotas = document.createElement("section");
muralNotas.classList = "mural-notas";
main.appendChild(muralNotas);

// ================== ESTADO ==================
let notas = []; // [{titulo, indicacion, timestamp}]
let tokenClient = null;
let oauthAccessToken = "";
let oauthExpiresAt = 0;
let connectInFlight = null;

// ================== HELPERS UI ==================
function setSync(state, text) {
  syncPill.classList.remove("ok", "saving", "offline");
  if (state) syncPill.classList.add(state);
  syncPill.querySelector(".sync-text").textContent = text;
}

function setAccountUI(email) {
  const e = (email || "").toString().trim().toLowerCase();

  if (!e) {
    accountPill.style.display = "none";
    accountPill.textContent = "";
    btnConnect.textContent = "Conectar";
    btnConnect.dataset.mode = "connect";
    return;
  }

  accountPill.style.display = "inline-flex";
  accountPill.textContent = e;
  btnConnect.textContent = "Cambiar cuenta";
  btnConnect.dataset.mode = "switch";
}

function isOnline() {
  return navigator.onLine !== false;
}

function renderNotas() {
  muralNotas.innerHTML = "";

  if (!Array.isArray(notas) || notas.length === 0) {
    const empty = document.createElement("div");
    empty.style.opacity = "0.8";
    empty.style.padding = "10px 2px";
    empty.textContent = "No hay notas todavía.";
    muralNotas.appendChild(empty);
    return;
  }

  notas.forEach((nota, index) => {
    const card = document.createElement("article");
    card.classList.add("nota-card");
    card.classList.add(index % 2 === 0 ? "nota-oscura" : "nota-clara");

    const titulo = document.createElement("h2");
    titulo.innerText = nota.titulo || "";
    card.appendChild(titulo);

    const pTexto = document.createElement("p");
    pTexto.classList.add("nota-texto");
    pTexto.innerText = nota.indicacion || "";
    card.appendChild(pTexto);

    if (nota.timestamp) {
      const fecha = new Date(nota.timestamp);
      const pFecha = document.createElement("p");
      pFecha.classList.add("nota-fecha");
      pFecha.innerText = fecha.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
      card.appendChild(pFecha);
    }

    muralNotas.appendChild(card);
  });
}

// ================== CACHE ==================
function loadCache() {
  try {
    const raw = localStorage.getItem(LS_NOTES_CACHE);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.notas) ? parsed.notas : null;
  } catch {
    return null;
  }
}

function saveCache(arr) {
  try {
    localStorage.setItem(LS_NOTES_CACHE, JSON.stringify({ notas: arr, ts: Date.now() }));
  } catch {}
}

// ================== OAUTH HELPERS ==================
function isTokenValid() {
  return !!oauthAccessToken && Date.now() < (oauthExpiresAt - 10_000);
}

function loadStoredOAuth() {
  try {
    const raw = localStorage.getItem(LS_OAUTH);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed?.access_token || !parsed?.expires_at) return null;
    return { access_token: parsed.access_token, expires_at: Number(parsed.expires_at) };
  } catch {
    return null;
  }
}
function saveStoredOAuth(access_token, expires_at) {
  try { localStorage.setItem(LS_OAUTH, JSON.stringify({ access_token, expires_at })); } catch {}
}
function clearStoredOAuth() {
  try { localStorage.removeItem(LS_OAUTH); } catch {}
}

function loadStoredOAuthEmail() {
  try {
    return String(localStorage.getItem(LS_OAUTH_EMAIL) || "").trim().toLowerCase();
  } catch {
    return "";
  }
}
function saveStoredOAuthEmail(email) {
  try { localStorage.setItem(LS_OAUTH_EMAIL, (email || "").toString()); } catch {}
}
function clearStoredOAuthEmail() {
  try { localStorage.removeItem(LS_OAUTH_EMAIL); } catch {}
}

// ================== DEBUG: EXPIRAR TOKEN + PROBAR RECONEXIÓN ==================
// Uso desde consola:
//   debugExpireTokenAndTestReconnect()                 // intenta reconectar sin popup (silent)
//   debugExpireTokenAndTestReconnect({ interactive:true }) // reconecta con popup (si falla silent)
async function debugExpireTokenAndTestReconnect(opts = {}) {
  const interactive = !!opts.interactive;

  console.log("[DEBUG] Expirando token local (memoria + localStorage)...");

  // 1) "Expirar" el token en memoria
  oauthAccessToken = "";
  oauthExpiresAt = 0;

  // 2) Borrar token persistido (localStorage)
  clearStoredOAuth();

  // 3) (Opcional) NO borramos el email hint por defecto,
  // porque justamente ayuda a que el silent refresh funcione.
  // Si querés probar el peor caso (sin hint), descomentá:
  // clearStoredOAuthEmail();

  console.log("[DEBUG] Token local expirado.");
  console.log("[DEBUG] Intentando reconectar...", { interactive });

  try {
    // Esto intenta renovar token y validar backend.
    // interactive=false => debería intentar "silent" (prompt:"") usando hintEmail si existe.
    // interactive=true  => si falla silent, te abre popup.
    const res = await runConnectFlow({ interactive, prompt: interactive ? "consent" : "" });
    console.log("[DEBUG] runConnectFlow result:", res);

    // Fuerza una llamada para comprobar que ya quedó ok y que list/add funcionan.
    const who = await apiCall("whoami", {}, { allowInteractive: interactive });
    console.log("[DEBUG] whoami:", who);

    const list = await apiCall("list", {}, { allowInteractive: interactive });
    console.log("[DEBUG] list:", list);

    console.log("[DEBUG] ✅ Fin prueba reconexión.");
    return { ok: true, res, who, list };
  } catch (e) {
    console.warn("[DEBUG] ❌ Falló reconexión:", e);
    return { ok: false, error: String(e?.message || e) };
  }
}

function initOAuth() {
  if (!window.google?.accounts?.oauth2?.initTokenClient) {
    throw new Error("GIS no está cargado (falta gsi/client en HTML)");
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: OAUTH_CLIENT_ID,
    scope: OAUTH_SCOPES,
    include_granted_scopes: true,
    use_fedcm_for_prompt: true,
    callback: () => {}
  });
}

// prompt: "" (silent), "consent", "select_account"
function requestAccessToken({ prompt, hint } = {}) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error("OAuth no inicializado"));

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("popup_timeout_or_closed"));
    }, 45_000);

    tokenClient.callback = (resp) => {
      if (done) return;
      done = true;
      clearTimeout(timer);

      if (!resp || resp.error) {
        const err = String(resp?.error || "oauth_error");
        const sub = String(resp?.error_subtype || "");
        const msg = (err + (sub ? `:${sub}` : "")).toLowerCase();

        const e = new Error(err);
        e.isCanceled =
          msg.includes("popup_closed") ||
          msg.includes("popup_closed_by_user") ||
          msg.includes("access_denied") ||
          msg.includes("user_cancel") ||
          msg.includes("interaction_required");
        return reject(e);
      }

      const accessToken = resp.access_token;
      const expiresIn = Number(resp.expires_in || 3600);
      const expiresAt = Date.now() + (expiresIn * 1000);

      oauthAccessToken = accessToken;
      oauthExpiresAt = expiresAt;
      saveStoredOAuth(accessToken, expiresAt);

      resolve({ access_token: accessToken, expires_at: expiresAt });
    };

    const req = {};
    if (prompt !== undefined) req.prompt = prompt;
    if (hint && String(hint).includes("@")) req.hint = hint;

    try {
      tokenClient.requestAccessToken(req);
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

// allowInteractive=false => NO popup
async function ensureOAuthToken(allowInteractive = false, interactivePrompt = "consent") {
  // 1) token en memoria
  if (isTokenValid()) return oauthAccessToken;

  // 2) token guardado válido
  const stored = loadStoredOAuth();
  if (stored?.access_token && stored?.expires_at && Date.now() < (stored.expires_at - 10_000)) {
    oauthAccessToken = stored.access_token;
    oauthExpiresAt = Number(stored.expires_at);
    return oauthAccessToken;
  }

  const hintEmail = (loadStoredOAuthEmail() || "").trim().toLowerCase();

  // si NO es interactivo y NO hay hint => NO llamar GIS (evita loops)
  if (!allowInteractive && !hintEmail) throw new Error("TOKEN_NEEDS_INTERACTIVE");

  // 3) Silent real
  try {
    await requestAccessToken({ prompt: "", hint: hintEmail || undefined });
    if (isTokenValid()) return oauthAccessToken;
  } catch (e) {
    if (!allowInteractive) throw new Error("TOKEN_NEEDS_INTERACTIVE");
  }

  // 4) Interactivo
  await requestAccessToken({ prompt: interactivePrompt ?? "consent", hint: hintEmail || undefined });

  if (!isTokenValid()) throw new Error("TOKEN_NEEDS_INTERACTIVE");
  return oauthAccessToken;
}

// ================== API CLIENT (POST text/plain) ==================
async function apiPost_(payload) {
  let r, text;

  try {
    r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload || {}),
      cache: "no-store",
      redirect: "follow"
    });
  } catch (e) {
    return { ok: false, error: "network_error", detail: String(e?.message || e) };
  }

  try {
    text = await r.text();
  } catch (e) {
    return { ok: false, error: "read_error", status: r.status, detail: String(e?.message || e) };
  }

  if (!r.ok) {
    return { ok: false, error: "http_error", status: r.status, detail: (text || "").slice(0, 800) };
  }

  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "non_json", status: r.status, detail: (text || "").slice(0, 800) };
  }
}

async function apiCall(mode, payload = {}, opts = {}) {
  const allowInteractive = !!opts.allowInteractive;

  const token = await ensureOAuthToken(allowInteractive, opts.interactivePrompt || "consent");
  const body = { mode, access_token: token, ...(payload || {}) };

  let data = await apiPost_(body);

  // si venció / falta auth, reintenta UNA vez con popup (si lo permitimos)
  if (!data?.ok && (data?.error === "auth_required" || data?.error === "wrong_audience")) {
    if (!allowInteractive) return data;
    const token2 = await ensureOAuthToken(true, "consent");
    body.access_token = token2;
    data = await apiPost_(body);
  }

  return data || { ok: false, error: "empty_response" };
}

async function verifyBackendAccessOrThrow(allowInteractive) {
  const data = await apiCall("whoami", {}, { allowInteractive });
  if (!data?.ok) {
    const msg = (data?.error || "no_access") + (data?.detail ? ` | ${data.detail}` : "");
    throw new Error(msg);
  }
  return data;
}

// ================== CARGAR / AGREGAR ==================
async function cargarNotasDesdeAPI() {
  if (!isOnline()) {
    setSync("offline", "Sin conexión — usando cache");
    const cached = loadCache();
    if (cached) {
      notas = cached;
      renderNotas();
    }
    return;
  }

  // token silencioso
  try {
    await ensureOAuthToken(false);
  } catch (e) {
    setSync("offline", "Necesita Conectar");
    btnRefresh.style.display = "inline-block";
    return;
  }

  if (!isTokenValid()) {
    setSync("offline", "Necesita Conectar");
    btnRefresh.style.display = "inline-block";
    return;
  }

  setSync("saving", "Cargando…");
  const resp = await apiCall("list", {}, { allowInteractive: false });
  if (!resp?.ok) {
    setSync("offline", "No se pudo cargar — usando cache");
    btnRefresh.style.display = "inline-block";
    const cached = loadCache();
    if (cached) {
      notas = cached;
      renderNotas();
    }
    return;
  }

  notas = Array.isArray(resp?.notas) ? resp.notas : [];
  saveCache(notas);
  renderNotas();
  setSync("ok", "Listo ✅");
  btnRefresh.style.display = "none";
}

async function agregarNotaAPI(titulo, texto) {
  const tituloLimpio = (titulo || "").trim();
  const textoLimpio = (texto || "").trim();
  if (!tituloLimpio || !textoLimpio) return;

  if (!isOnline()) {
    setSync("offline", "Sin conexión — no se puede guardar");
    return;
  }

  // token silencioso
  try {
    await ensureOAuthToken(false);
  } catch (e) {
    setSync("offline", "Necesita Conectar");
    btnRefresh.style.display = "inline-block";
    return;
  }

  if (!isTokenValid()) {
    setSync("offline", "Necesita Conectar");
    btnRefresh.style.display = "inline-block";
    return;
  }

  setSync("saving", "Guardando…");
  const resp = await apiCall(
    "add",
    { titulo: tituloLimpio, indicacion: textoLimpio },
    { allowInteractive: false }
  );

  if (!resp?.ok) {
    setSync("offline", "No se pudo guardar");
    btnRefresh.style.display = "inline-block";
    return;
  }

  // recarga rápida
  await cargarNotasDesdeAPI();
}

// ================== CONECTAR (auto + manual) ==================
async function runConnectFlow({ interactive, prompt } = { interactive: false, prompt: "consent" }) {
  if (connectInFlight) return connectInFlight;

  connectInFlight = (async () => {
    try {
      setSync("saving", interactive ? "Conectando…" : "Reconectando…");

      try {
        await ensureOAuthToken(!!interactive, prompt || "consent");
      } catch (e) {
        if (e?.isCanceled) {
          if (isTokenValid()) setSync("ok", "Listo ✅");
          else {
            setSync("offline", "Necesita Conectar");
            btnRefresh.style.display = "inline-block";
          }
          return { ok: false, canceled: true };
        }
        throw e;
      }

      const who = await verifyBackendAccessOrThrow(!!interactive);
      const email = (who?.email || "").toString().toLowerCase().trim();
      if (email) saveStoredOAuthEmail(email);
      setAccountUI(email);

      btnRefresh.style.display = "none";
      await cargarNotasDesdeAPI();
      return { ok: true };
    } catch (e) {
      const msg = String(e?.message || e || "");
      if (msg === "TOKEN_NEEDS_INTERACTIVE") {
        setSync("offline", "Necesita Conectar");
        btnRefresh.style.display = "inline-block";
        return { ok: false, needsInteractive: true };
      }
      setSync("offline", "Necesita Conectar");
      btnRefresh.style.display = "inline-block";
      return { ok: false, error: msg };
    } finally {
      connectInFlight = null;
    }
  })();

  return connectInFlight;
}

async function reconnectAndRefresh() {
  return await runConnectFlow({ interactive: false, prompt: "" });
}

// ================== EVENTOS ==================
buttonAgregar.addEventListener("click", async () => {
  await agregarNotaAPI(inputTitulo.value, textareaTexto.value);
  inputTitulo.value = "";
  textareaTexto.value = "";
  inputTitulo.focus();
});

inputTitulo.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    textareaTexto.focus();
  }
});

btnConnect.addEventListener("click", async () => {
  // modo switch
  if (btnConnect.dataset.mode === "switch") {
    const prevStored = loadStoredOAuth();
    const prevEmail = loadStoredOAuthEmail();
    const prevRuntimeToken = oauthAccessToken;
    const prevRuntimeExp = oauthExpiresAt;

    clearStoredOAuth();
    clearStoredOAuthEmail();
    oauthAccessToken = "";
    oauthExpiresAt = 0;

    const res = await runConnectFlow({ interactive: true, prompt: "select_account" });

    if (res?.canceled) {
      if (prevStored?.access_token && prevStored?.expires_at) {
        saveStoredOAuth(prevStored.access_token, prevStored.expires_at);
      }
      if (prevEmail) saveStoredOAuthEmail(prevEmail);
      oauthAccessToken = prevRuntimeToken || "";
      oauthExpiresAt = prevRuntimeExp || 0;
      setAccountUI(prevEmail || "");
      if (isTokenValid()) setSync("ok", "Listo ✅");
      else {
        setSync("offline", "Necesita Conectar");
        btnRefresh.style.display = "inline-block";
      }
      return;
    }
    return;
  }

  // connect normal
  await runConnectFlow({ interactive: true, prompt: "consent" });
});

btnRefresh.addEventListener("click", async () => {
  await reconnectAndRefresh();
});

window.addEventListener("online", () => {
  reconnectAndRefresh();
});

window.addEventListener("offline", () => {
  setSync("offline", "Sin conexión");
});

// auto-refresh token silencioso
setInterval(async () => {
  try {
    if (document.visibilityState !== "visible") return;
    if (connectInFlight) return;
    if (!oauthAccessToken) return;

    if (Date.now() < (oauthExpiresAt - 120_000)) return; // faltan >2 min
    await ensureOAuthToken(false);

    if (isTokenValid() && syncPill.querySelector(".sync-text")?.textContent?.includes("Necesita Conectar")) {
      await reconnectAndRefresh();
    }
  } catch {}
}, 20_000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (connectInFlight) return;

  if (syncPill.querySelector(".sync-text")?.textContent?.includes("Necesita Conectar")) {
    reconnectAndRefresh();
  }
});

// ================== INIT ==================
window.addEventListener("load", async () => {
  inputTitulo.focus();

    // DEBUG: para ejecutar desde consola sin vueltas
  window.debugExpireTokenAndTestReconnect = debugExpireTokenAndTestReconnect;

  // 1) render instantáneo desde cache
  const cached = loadCache();
  if (cached) {
    notas = cached;
    renderNotas();
  }

  // 2) OAuth init + restaurar sesión
  try {
    initOAuth();

    const stored = loadStoredOAuth();
    if (stored?.access_token && Date.now() < (stored.expires_at - 10_000)) {
      oauthAccessToken = stored.access_token;
      oauthExpiresAt = stored.expires_at;
    }
    setAccountUI(loadStoredOAuthEmail());
  } catch {
    // si GIS no cargó, se verá al tocar "Conectar"
  }

  // 3) auto-connect silencioso si hay pistas
  if (!isOnline()) {
    setSync("offline", "Sin conexión");
    btnRefresh.style.display = "none";
    return;
  }

  const emailHint = loadStoredOAuthEmail();
  const stored = loadStoredOAuth();

  if (emailHint || (stored?.access_token && stored?.expires_at)) {
    await reconnectAndRefresh(); // sin popup
  } else {
    setSync("offline", "Necesita Conectar");
    btnRefresh.style.display = "inline-block";
  }
});
