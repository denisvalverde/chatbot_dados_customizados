/* SPA leve da plataforma — consome exclusivamente a API real (sem mocks). */
"use strict";

const API = "/api/v1";
let token = sessionStorage.getItem("token") || "";
let userEmail = sessionStorage.getItem("email") || "";

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(API + path, { ...options, headers });
  if (response.status === 401) { logout(); throw new Error("Sessão expirada"); }
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail);
    throw new Error(detail || `HTTP ${response.status}`);
  }
  return body;
}

/* ---------------- autenticação ---------------- */
function showLogin() { $("#login-view").classList.remove("hidden"); $("#app-view").classList.add("hidden"); }
function showApp() {
  $("#login-view").classList.add("hidden"); $("#app-view").classList.remove("hidden");
  $("#user-info").textContent = userEmail;
  loadDashboard();
}
function logout() { token = ""; sessionStorage.clear(); showLogin(); }

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = $("#login-error");
  errorEl.classList.add("hidden");
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: $("#login-email").value, password: $("#login-password").value }),
    });
    token = data.access_token; userEmail = data.email;
    sessionStorage.setItem("token", token); sessionStorage.setItem("email", userEmail);
    showApp();
  } catch (error) {
    errorEl.textContent = error.message; errorEl.classList.remove("hidden");
  }
});
$("#logout").addEventListener("click", logout);

/* ---------------- navegação ---------------- */
document.querySelectorAll("header nav button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("header nav button").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
    $(`#page-${button.dataset.page}`).classList.remove("hidden");
    ({ dashboard: loadDashboard, tickets: loadTickets, knowledge: loadKnowledge, ml: loadMl }[button.dataset.page] || (() => {}))();
  });
});

/* ---------------- dashboard ---------------- */
function bars(container, data) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  container.innerHTML = entries.length
    ? entries.map(([key, value]) =>
        `<div class="bar-row"><span class="label">${esc(key) || "—"}</span>
         <div class="bar" style="width:${(value / max) * 100}%"></div><span>${value}</span></div>`).join("")
    : "<p class='confidence'>Sem dados ainda.</p>";
}

async function loadDashboard() {
  try {
    const stats = await api("/tickets/stats");
    $("#dash-cards").innerHTML = `
      <div class="stat"><b>${stats.total}</b><span>chamados</span></div>
      <div class="stat"><b>${(stats.taxa_resolucao * 100).toFixed(0)}%</b><span>taxa de resolução</span></div>
      <div class="stat"><b>${(stats.confianca_media_analises * 100).toFixed(0)}%</b><span>confiança média das análises</span></div>
      <div class="stat"><b>${(stats.taxa_aceitacao_feedback * 100).toFixed(0)}%</b><span>aceitação de feedback</span></div>`;
    bars($("#dash-categories"), stats.por_categoria);
    bars($("#dash-severities"), stats.por_severidade);
  } catch (error) { console.error(error); }
}

/* ---------------- nova análise ---------------- */
$("#analyze-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const resultEl = $("#analyze-result");
  resultEl.classList.remove("hidden");
  resultEl.innerHTML = "<div class='card'>Analisando…</div>";
  try {
    const evidences = [];
    if ($("#an-evidence").value.trim()) {
      evidences.push({ type: $("#an-evidence-type").value, content: $("#an-evidence").value });
    }
    let ticketId = null;
    if ($("#an-create-ticket").checked) {
      const ticket = await api("/tickets", {
        method: "POST",
        body: JSON.stringify({
          external_id: $("#an-external").value,
          title: $("#an-title").value,
          description: $("#an-description").value,
          customer: $("#an-customer").value,
          evidences,
        }),
      });
      ticketId = ticket.id;
    }
    const analysis = await api("/analyze", {
      method: "POST",
      body: JSON.stringify({
        ticket_id: ticketId,
        title: $("#an-title").value,
        description: $("#an-description").value,
        evidences: ticketId ? [] : evidences,
      }),
    });
    renderAnalysis(resultEl, analysis, ticketId);
  } catch (error) {
    resultEl.innerHTML = `<div class="card"><p class="error">${esc(error.message)}</p></div>`;
  }
});

function list(items, empty = "Nenhum.") {
  return items?.length ? `<ul class="clean">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p class="confidence">${empty}</p>`;
}

function renderAnalysis(el, a, ticketId) {
  const c = a.classificacao;
  const commands = (a.comandos_diagnostico?.comandos || []).map((cmd) => `
    <details><summary>${esc(cmd.objetivo)} <span class="badge">${esc(cmd.risco)}</span></summary>
      <pre>${esc(cmd.comando)}</pre>
      <p class="confidence">Interpretação: ${esc(cmd.interpretacao)}</p></details>`).join("");
  el.innerHTML = `
  <div class="card">
    <h3>Resultado ${ticketId ? `(chamado #${ticketId})` : ""} — análise #${a.analysis_id}</h3>
    <p>${esc(a.resumo_executivo)}</p>
    <p class="confidence">Confiança global: <b>${(a.confianca_global * 100).toFixed(0)}%</b>
      ${a.necessita_escalonamento ? ` · <span class="badge alta">escalonar → ${esc(a.equipe_sugerida)}</span>` : ""}</p>
    <div class="section-title">Classificação</div>
    <p><span class="badge">${esc(c.categoria_principal)}</span> <span class="badge">${esc(c.subcategoria)}</span>
       <span class="badge ${esc(c.severidade)}">${esc(c.severidade)}</span>
       <span class="badge">equipe: ${esc(c.equipe_recomendada)}</span>
       <span class="confidence">confiança ${(c.confianca * 100).toFixed(0)}%</span></p>
    <p class="confidence">${esc(c.justificativa)}</p>
    <div class="grid-2">
      <div><div class="section-title">Fatos confirmados</div>${list(a.fatos_confirmados, "Nenhum — sem evidência objetiva anexada.")}</div>
      <div><div class="section-title">Sintomas (relato)</div>${list(a.sintomas)}</div>
    </div>
    <div class="section-title">Hipóteses (não confirmadas)</div>
    ${a.hipoteses.map((h) => `<div class="hypothesis"><b>${esc(h.descricao)}</b>
        <span class="confidence"> · confiança ${(h.confianca * 100).toFixed(0)}%</span><br>
        <span class="confidence">Coleta recomendada: ${esc(h.coleta_recomendada)}</span></div>`).join("") || "<p class='confidence'>Nenhuma.</p>"}
    <div class="grid-2">
      <div><div class="section-title">Informações ausentes</div>${list(a.informacoes_ausentes)}</div>
      <div><div class="section-title">Riscos</div>${list(a.riscos)}</div>
    </div>
    <div class="section-title">Ações recomendadas</div>${list(a.acoes_recomendadas)}
    <div class="section-title">Comandos de diagnóstico (somente leitura)</div>${commands}
    <div class="section-title">Feedback</div>
    <div class="actions">
      <button class="btn" onclick="sendFeedback(${a.analysis_id}, true)">👍 Útil</button>
      <button class="btn" onclick="sendFeedback(${a.analysis_id}, false)">👎 Não útil</button>
      <span id="fb-msg-${a.analysis_id}" class="ok hidden">Registrado, obrigado!</span>
    </div>
  </div>`;
}

window.sendFeedback = async (analysisId, accepted) => {
  try {
    await api("/feedback", {
      method: "POST",
      body: JSON.stringify({ analysis_id: analysisId, rating: accepted ? 5 : 2, accepted }),
    });
    $(`#fb-msg-${analysisId}`).classList.remove("hidden");
  } catch (error) { alert(error.message); }
};

/* ---------------- chamados ---------------- */
async function loadTickets() {
  const data = await api("/tickets?limit=100");
  $("#tickets-table tbody").innerHTML = data.items.map((t) => `
    <tr><td>${t.id}</td><td>${esc(t.title)}</td><td><span class="badge">${esc(t.category)}</span></td>
    <td><span class="badge ${esc(t.severity)}">${esc(t.severity)}</span></td>
    <td>${esc(t.assigned_team)}</td><td>${esc(t.status)}</td>
    <td>${new Date(t.created_at).toLocaleString("pt-BR")}</td></tr>`).join("")
    || "<tr><td colspan='7'>Nenhum chamado.</td></tr>";
}

/* ---------------- base de conhecimento ---------------- */
$("#kb-search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = await api(`/knowledge/search?q=${encodeURIComponent($("#kb-query").value)}&limit=5`);
  $("#kb-results").innerHTML = data.results.map((r) => `
    <div class="kb-hit"><b>${esc(r.title)}</b>
      <span class="badge">${esc(r.document_type)}</span>
      <span class="confidence">score ${(r.score * 100).toFixed(0)}%</span><br>${esc(r.content.slice(0, 220))}…</div>`).join("")
    || "<p class='confidence'>Nada encontrado.</p>";
});

$("#kb-add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const msg = $("#kb-add-msg");
  try {
    await api("/knowledge/documents", {
      method: "POST",
      body: JSON.stringify({
        title: $("#kb-title").value,
        content: $("#kb-content").value,
        document_type: $("#kb-type").value,
        category: $("#kb-category").value,
        approved: $("#kb-approved").checked,
      }),
    });
    msg.textContent = "Documento ingerido com embedding."; msg.className = "ok";
    loadKnowledge();
  } catch (error) { msg.textContent = error.message; msg.className = "error"; }
  msg.classList.remove("hidden");
});

async function loadKnowledge() {
  const data = await api("/knowledge/documents?limit=100");
  $("#kb-table tbody").innerHTML = data.items.map((d) => `
    <tr><td>${d.id}</td><td>${esc(d.title)}</td><td>${esc(d.document_type)}</td>
    <td>${esc(d.category)}</td><td>${d.approved ? "✔" : "—"}</td></tr>`).join("")
    || "<tr><td colspan='5'>Base vazia.</td></tr>";
}

/* ---------------- machine learning ---------------- */
async function loadMl() {
  const active = await api("/models/active");
  $("#ml-active").innerHTML = active.neural
    ? `<p>Rede neural <b>ativa</b> (treinada em ${esc(active.treinado_em?.slice(0, 19) || "?")}).</p>
       <p class="confidence">${active.exemplos} exemplos (${active.exemplos_sinteticos} sintéticos)
       ${active.apenas_sintetico ? "<br><b>Atenção:</b> treinada só com dados sintéticos — baseline determinístico continua ponderado na fusão." : ""}</p>`
    : `<p>Sem rede treinada — classificação usa o <b>baseline determinístico</b> + similaridade.</p>`;
  try {
    const metrics = await api("/models/evaluate", { method: "POST" });
    $("#ml-metrics").textContent = JSON.stringify({
      categoria: metrics.categoria, severidade: metrics.severidade, equipe: metrics.equipe,
      tecnologias_multilabel_f1_micro: metrics.tecnologias_multilabel_f1_micro,
      synthetic_ratio: metrics.synthetic_ratio, is_production_ready: metrics.is_production_ready,
    }, null, 2);
  } catch { $("#ml-metrics").textContent = "Nenhum treinamento registrado."; }
  const models = await api("/models");
  $("#ml-table tbody").innerHTML = models.map((m) => `
    <tr><td>${m.id}</td><td>${esc(m.name)}</td><td>${esc(m.status)}</td>
    <td>${new Date(m.created_at).toLocaleString("pt-BR")}</td>
    <td>${m.metrics?.is_production_ready ? "sim" : "não (sintético)"}</td></tr>`).join("")
    || "<tr><td colspan='5'>Nenhuma versão registrada.</td></tr>";
}

$("#ml-train").addEventListener("click", async () => {
  const msg = $("#ml-train-msg");
  msg.textContent = "Treinando…"; msg.className = ""; msg.classList.remove("hidden");
  try {
    const result = await api("/models/train", { method: "POST", body: JSON.stringify({ epochs: 20 }) });
    msg.textContent = `Treino concluído (versão ${result.model_version_id}). ${result.aviso || ""}`;
    msg.className = "ok";
    loadMl();
  } catch (error) { msg.textContent = error.message; msg.className = "error"; }
});

/* ---------------- boot ---------------- */
if (token) showApp(); else showLogin();
