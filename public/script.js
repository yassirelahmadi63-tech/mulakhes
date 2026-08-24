"use strict";

const $ = (id) => document.getElementById(id);

const els = {
  authScreen: $("authScreen"),
  tabLogin: $("tabLogin"),
  tabRegister: $("tabRegister"),
  nameRow: $("nameRow"),
  authName: $("authName"),
  authEmail: $("authEmail"),
  authPassword: $("authPassword"),
  authMsg: $("authMsg"),
  authSubmitBtn: $("authSubmitBtn"),
  googleSection: $("googleSection"),
  googleBtn: $("googleBtn"),
  app: $("app"),
  userName: $("userName"),
  subChip: $("subChip"),
  logoutBtn: $("logoutBtn"),
  userNameM: $("userNameM"),
  subChipM: $("subChipM"),
  logoutBtnM: $("logoutBtnM"),
  navBtns: document.querySelectorAll(".nav-btn"),
  adminOnlyBtns: document.querySelectorAll(".admin-only"),
  navLibCount: $("navLibCount"),

  lessonText: $("lessonText"),
  wordCount: $("wordCount"),
  fileInput: $("fileInput"),
  clearBtn: $("clearBtn"),
  lengthOptions: $("lengthOptions"),
  bulletsMode: $("bulletsMode"),
  summarizeBtn: $("summarizeBtn"),
  statusMsg: $("statusMsg"),
  resultCard: $("resultCard"),
  summaryOutput: $("summaryOutput"),
  saveBtn: $("saveBtn"),
  saveBar: $("saveBar"),
  saveTitleInput: $("saveTitleInput"),
  saveConfirmBtn: $("saveConfirmBtn"),
  saveCancelBtn: $("saveCancelBtn"),
  copyBtn: $("copyBtn"),
  downloadBtn: $("downloadBtn"),

  libCount: $("libCount"),
  libraryEmpty: $("libraryEmpty"),
  libList: $("libList"),
  navLibCount: $("navLibCount"),

  myQuota: $("myQuota"),
  plansGrid: $("plansGrid"),
  myRequests: $("myRequests"),
  myRequestsEmpty: $("myRequestsEmpty"),

  adminCard: $("adminCard"),
  statUsers: $("statUsers"),
  statSubs: $("statSubs"),
  statLessons: $("statLessons"),
  adminRequests: $("adminRequests"),
  reqEmpty: $("reqEmpty"),
  plansList: $("plansList"),
  planName: $("planName"),
  planDays: $("planDays"),
  planSummaries: $("planSummaries"),
  planModel: $("planModel"),
  planPrice: $("planPrice"),
  addPlanBtn: $("addPlanBtn"),
  adminUsersBody: $("adminUsersBody"),
};

let token = localStorage.getItem("token") || "";
let currentUser = null;
let summaryLength = "medium";
let lastSummary = "";
let modelLabels = {};
let adminPlans = [];
let mySub = null;

/* رابط الخادم: فارغ = نفس المصدر (الويب)، أو رابط محفوظ (تطبيق الأندرويد) */
const API_BASE = (localStorage.getItem("server_url") || "").replace(/\/+$/, "");
if (!API_BASE && location.protocol === "https:" && location.hostname === "localhost" && window.Capacitor) {
  /* داخل APK بدون رابط محفوظ — سيظهر شاشة الإعداد عبر index-apk */
}

/* ---------- API ---------- */

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  let body = {};
  try { body = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && path !== "/login" && path !== "/register") logout();
    const err = new Error(body.error || `خطأ ${res.status}`);
    err.code = body.code;
    throw err;
  }
  return body;
}

/* ---------- التنقل بين الصفحات ---------- */

function showPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  $(`page-${name}`).classList.add("active");
  els.navBtns.forEach((b) => b.classList.toggle("active", b.dataset.page === name));
  if (name === "library") loadLibrary();
  if (name === "plans") loadPlansPage();
  if (name === "admin") loadAdmin();
}

els.navBtns.forEach((btn) =>
  btn.addEventListener("click", () => showPage(btn.dataset.page))
);

/* ---------- شاشة الدخول ---------- */

let authMode = "login";

function setAuthMode(mode) {
  authMode = mode;
  els.tabLogin.classList.toggle("active", mode === "login");
  els.tabRegister.classList.toggle("active", mode === "register");
  els.nameRow.hidden = mode !== "register";
  els.authSubmitBtn.textContent = mode === "login" ? "دخول" : "إنشاء الحساب";
  hideAuthMsg();
}

els.tabLogin.addEventListener("click", () => setAuthMode("login"));
els.tabRegister.addEventListener("click", () => setAuthMode("register"));

function showAuthMsg(message, type) {
  els.authMsg.className = `status ${type}`;
  els.authMsg.textContent = message;
}
function hideAuthMsg() { els.authMsg.className = "status hidden"; }

els.authSubmitBtn.addEventListener("click", async () => {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) return showAuthMsg("الرجاء إدخال البريد وكلمة المرور.", "error");
  if (authMode === "register" && password.length < 6)
    return showAuthMsg("كلمة المرور يجب أن تكون 6 أحرف على الأقل.", "error");

  els.authSubmitBtn.disabled = true;
  showAuthMsg(authMode === "login" ? "جارٍ تسجيل الدخول..." : "جارٍ إنشاء الحساب...", "loading");
  try {
    const body =
      authMode === "login"
        ? await api("/login", { method: "POST", body: JSON.stringify({ email, password }) })
        : await api("/register", { method: "POST", body: JSON.stringify({ email, password, name: els.authName.value.trim() }) });
    token = body.token;
    localStorage.setItem("token", token);
    enterApp(body.user, body.subscription);
  } catch (err) {
    showAuthMsg(err.message, "error");
  } finally {
    els.authSubmitBtn.disabled = false;
  }
});

els.authPassword.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.authSubmitBtn.click();
});

/* ---------- جوجل ---------- */

async function initGoogleSignIn() {
  try {
    const cfg = await fetch(`${API_BASE}/api/auth/google-config`).then((r) => r.json());
    if (!cfg.client_id) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    google.accounts.id.initialize({
      client_id: cfg.client_id,
      callback: async (response) => {
        showAuthMsg("جارٍ التحقق...", "loading");
        try {
          const body = await api("/auth/google", {
            method: "POST",
            body: JSON.stringify({ credential: response.credential }),
          });
          token = body.token;
          localStorage.setItem("token", token);
          enterApp(body.user, body.subscription);
        } catch (err) {
          showAuthMsg(err.message, "error");
        }
      },
    });
    google.accounts.id.renderButton(els.googleBtn, {
      theme: "outline", size: "large", shape: "pill", text: "continue_with", locale: "ar", width: 300,
    });
    els.googleSection.classList.remove("hidden");
  } catch {}
}

/* ---------- الدخول والخروج ---------- */

function renderSubChip(sub) {
  mySub = sub;
  const chips = [els.subChip, els.subChipM];
  chips.forEach((chip) => {
    if (!chip) return;
    if (sub.active) {
      const left = sub.remaining === "∞" ? "غير محدود" : `متبقي ${sub.remaining}`;
      chip.textContent = `⭐ ${sub.plan_name} • ${left}`;
      chip.className = "sub-chip sub-active";
    } else {
      chip.textContent = `مجاني • متبقي ${sub.remaining}`;
      chip.className = "sub-chip sub-free";
    }
  });
  if (els.myQuota) {
    els.myQuota.textContent = sub.active
      ? `اشتراكك: ${sub.plan_name}`
      : `المتبقي مجاناً: ${sub.remaining}`;
  }
}

function enterApp(user, subscription) {
  currentUser = user;
  const displayName = user.name ? `👤 ${user.name}` : `👤 ${user.email.split("@")[0]}`;
  els.userName.textContent = displayName;
  if (els.userNameM) els.userNameM.textContent = displayName;
  if (subscription) renderSubChip(subscription);
  els.authScreen.classList.add("hidden");
  els.app.classList.remove("hidden");
  els.adminOnlyBtns.forEach((b) => b.classList.toggle("hidden", user.role !== "admin"));
  loadLibrary();
  showPage("summarize");
}

function logout() {
  token = ""; currentUser = ""; localStorage.removeItem("token");
  lastSummary = "";
  els.app.classList.add("hidden");
  els.adminCard.classList.add("hidden");
  els.resultCard.classList.add("hidden");
  els.saveBar.classList.add("hidden");
  hideStatus();
  els.lessonText.value = "";
  els.wordCount.textContent = "0 كلمة";
  els.libList.innerHTML = "";
  els.libraryEmpty.classList.remove("hidden");
  els.libCount.textContent = "0 درس";
  els.authScreen.classList.remove("hidden");
}

els.logoutBtn.addEventListener("click", logout);
if (els.logoutBtnM) els.logoutBtnM.addEventListener("click", logout);

/* داخل تطبيق الأندرويد: جوجل لا يعمل — أخفِ الزر ونبّه المستخدم */
if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
  document.body.classList.add("native-app");
}

(async function init() {
  if (!token) {
    els.authScreen.classList.remove("hidden");
    initGoogleSignIn();
    return;
  }
  try {
    const me = await api("/me");
    enterApp(me.user, me.subscription);
    initGoogleSignIn();
  } catch {
    logout();
    initGoogleSignIn();
  }
})();

/* ---------- عدّاد + ملفات ---------- */

function countWords(text) { return text.trim() ? text.trim().split(/\s+/).length : 0; }

els.lessonText.addEventListener("input", () => {
  els.wordCount.textContent = `${countWords(els.lessonText.value)} كلمة`;
});

els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    els.lessonText.value = reader.result;
    els.wordCount.textContent = `${countWords(els.lessonText.value)} كلمة`;
    showStatus(`تم تحميل "${file.name}" ✓`, "success");
  };
  reader.onerror = () => showStatus("تعذر قراءة الملف.", "error");
  reader.readAsText(file, "utf-8");
  els.fileInput.value = "";
});

els.clearBtn.addEventListener("click", () => {
  els.lessonText.value = "";
  els.wordCount.textContent = "0 كلمة";
  els.resultCard.classList.add("hidden");
  hideStatus();
});

els.lengthOptions.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    els.lengthOptions.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    summaryLength = btn.dataset.length;
  });
});

/* ---------- رسائل ---------- */

function showStatus(message, type, loading = false) {
  els.statusMsg.className = `status ${type}`;
  els.statusMsg.innerHTML = message + (loading ? ' <span class="spinner"></span>' : "");
}
function hideStatus() { els.statusMsg.className = "status hidden"; els.statusMsg.innerHTML = ""; }

/* ---------- التلخيص ---------- */

els.summarizeBtn.addEventListener("click", async () => {
  const text = els.lessonText.value.trim();
  if (!text) return showStatus("الرجاء لصق نص الدرس أولاً.", "error");
  els.summarizeBtn.disabled = true;
  showStatus("جارٍ تلخيص الدرس...", "loading", true);
  try {
    const data = await api("/summarize", {
      method: "POST",
      body: JSON.stringify({ text, length: summaryLength, bullets: els.bulletsMode.checked }),
    });
    lastSummary = data.summary;
    renderSummary(lastSummary);
    els.saveBar.classList.add("hidden");
    if (data.subscription) renderSubChip(data.subscription);
    showStatus(`تم بنجاح ✓ 🤖 ${data.model_used || ""}`, "success");
  } catch (err) {
    if (err.code === "QUOTA") {
      showStatus(`⭐ ${err.message} — انتقل لصفحة "💳 الباقات"`, "error");
      showPage("plans");
    } else {
      showStatus(err.message, "error");
    }
  } finally {
    els.summarizeBtn.disabled = false;
  }
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderSummary(markdown) {
  const html = [];
  let inList = false;
  const inline = (s) =>
    escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { if (inList) { html.push("</ul>"); inList = false; } html.push(`<h3>${inline(h[1])}</h3>`); continue; }
    const li = line.match(/^\s*([-*•]|\d+[.)])\s+(.*)$/);
    if (li) { if (!inList) { html.push("<ul>"); inList = true; } html.push(`<li>${inline(li[2])}</li>`); continue; }
    if (inList) { html.push("</ul>"); inList = false; }
    if (line.trim()) html.push(`<p>${inline(line)}</p>`);
  }
  if (inList) html.push("</ul>");
  els.summaryOutput.innerHTML = html.join("");
  els.resultCard.classList.remove("hidden");
}

/* ---------- المكتبة ---------- */

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ar", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function suggestTitle(text) {
  const firstLine = text.trim().split("\n")[0].replace(/^#+\s*/, "").trim();
  return firstLine.slice(0, 60) || `ملخص ${formatDate(new Date().toISOString())}`;
}

els.saveBtn.addEventListener("click", () => {
  if (!lastSummary) return;
  els.saveTitleInput.value = suggestTitle(els.lessonText.value || lastSummary);
  els.saveBar.classList.remove("hidden");
  els.saveTitleInput.focus();
});
els.saveCancelBtn.addEventListener("click", () => els.saveBar.classList.add("hidden"));
els.saveTitleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") els.saveConfirmBtn.click(); });

els.saveConfirmBtn.addEventListener("click", async () => {
  if (!lastSummary) return;
  const title = els.saveTitleInput.value.trim() || suggestTitle(lastSummary);
  try {
    await api("/library", {
      method: "POST",
      body: JSON.stringify({ title, summary: lastSummary, lesson: els.lessonText.value.trim(), words: countWords(els.lessonText.value) }),
    });
    els.saveBar.classList.add("hidden");
    showStatus(`تم حفظ "${title}" ✓`, "success");
    loadLibrary();
  } catch (err) { showStatus(err.message, "error"); }
});

async function loadLibrary() {
  try {
    const data = await api("/library");
    renderLibrary(data.items);
  } catch {}
}

function renderLibrary(items) {
  els.libCount.textContent = `${items.length} درس`;
  els.libraryEmpty.classList.toggle("hidden", items.length > 0);
  els.navLibCount.textContent = items.length;
  els.navLibCount.classList.toggle("hidden", items.length === 0);
  els.libList.innerHTML = items
    .map((it) => `
      <li class="lib-item" data-id="${it.id}">
        <div class="lib-info">
          <span class="lib-title">${escapeHtml(it.title)}</span>
          <span class="lib-meta">${formatDate(it.date)} • ${it.words} كلمة</span>
        </div>
        <div class="lib-actions">
          <button type="button" data-action="view">👁️ عرض</button>
          <button type="button" data-action="download" title="تنزيل">⬇️</button>
          <button type="button" data-action="delete" title="حذف">🗑️</button>
        </div>
      </li>`)
    .join("");
}

els.libList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.closest(".lib-item").dataset.id;
  try {
    if (btn.dataset.action === "view") {
      const data = await api(`/library/${id}`);
      lastSummary = data.item.summary;
      renderSummary(lastSummary);
      showPage("summarize");
    } else if (btn.dataset.action === "download") {
      const data = await api(`/library/${id}`);
      downloadText(data.item.title + ".txt", data.item.summary);
    } else if (btn.dataset.action === "delete") {
      await api(`/library/${id}`, { method: "DELETE" });
      loadLibrary();
    }
  } catch (err) { showStatus(err.message, "error"); }
});

/* ---------- الباقات (للمستخدم) ---------- */

async function loadPlansPage() {
  try {
    const [plansRes, reqsRes] = await Promise.all([api("/plans"), api("/requests")]);
    renderPlansGrid(plansRes.plans);
    renderMyRequests(reqsRes.requests);
  } catch (err) { showStatus(err.message, "error"); }
}

function renderPlansGrid(plans) {
  els.plansGrid.innerHTML = plans
    .map((p) => {
      const isCurrent = mySub?.active && mySub?.plan_id === p.id;
      return `
      <div class="plan-card ${isCurrent ? "current" : ""}">
        <span class="plan-name">${escapeHtml(p.name)}</span>
        <span class="plan-price">${escapeHtml(p.price || "0")} <small style="font-size:.85rem;color:var(--muted)">${p.price ? "د.م" : ""}</small></span>
        <span class="plan-ai">🤖 ذكاء ${modelStrength(p.model)}</span>
        <span class="plan-feat">⏳ ${p.days} يوم</span>
        <span class="plan-feat">${p.summaries === -1 ? "♾️ ملخصات غير محدودة" : `📝 ${p.summaries} ملخص`}</span>
        <button class="btn btn-primary" type="button" data-request-plan="${p.id}">${isCurrent ? "تجديد / تمديد" : "طلب اشتراك"}</button>
      </div>`;
    })
    .join("");
}

function modelStrength(model) {
  const map = {
    "allam-2-7b": "ضعيف",
    "openai/gpt-oss-20b": "متوسط",
    "qwen/qwen3.6-27b": "قوي",
    "openai/gpt-oss-120b": "الأقوى",
  };
  return map[model] || model || "متوسط";
}

els.plansGrid.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-request-plan]");
  if (!btn) return;
  try {
    await api("/requests", {
      method: "POST",
      body: JSON.stringify({ plan_id: Number(btn.dataset.requestPlan) }),
    });
    showStatusOnPlans("تم إرسال طلبك ✓ سيراجعه المدير قريباً");
    loadPlansPage();
  } catch (err) { showStatusOnPlans(err.message); }
});

function showStatusOnPlans(msg) {
  const intro = document.querySelector(".plans-intro");
  intro.textContent = msg;
  setTimeout(() => (intro.textContent = "كل باقة أقوى ذكاءً من سابقتها. اختر باقة وأرسل طلبك، وسيراجعها المدير."), 4000);
}

function renderMyRequests(requests) {
  els.myRequestsEmpty.classList.toggle("hidden", requests.length > 0);
  els.myRequests.innerHTML = requests
    .map((r) => {
      const cls = r.status === "pending" ? "" : r.status === "approved" ? "role-admin" : "";
      const label = r.status === "pending" ? "⏳ قيد المراجعة" : r.status === "approved" ? "✓ تم القبول" : "✗ مرفوض";
      return `
      <li class="lib-item">
        <div class="lib-info">
          <span class="lib-title">💳 ${escapeHtml(r.plan_name)}</span>
          <span class="lib-meta">${formatDate(r.date)}</span>
        </div>
        <span class="role-tag ${cls}">${label}</span>
      </li>`;
    })
    .join("");
}

/* ---------- الإدارة ---------- */

async function loadAdmin() {
  try {
    const stats = await api("/admin/stats");
    els.statUsers.textContent = stats.users;
    els.statLessons.textContent = stats.lessons;
    els.statSubs.textContent = stats.activeSubs;

    const plansRes = await api("/admin/plans");
    adminPlans = plansRes.plans;
    const modelsRes = await api("/admin/models");
    modelLabels = Object.fromEntries(modelsRes.models.map((m) => [m.id, m.label]));
    els.planModel.innerHTML =
      `<option value="">— اختر الموديل —</option>` +
      modelsRes.models.map((m) => `<option value="${m.id}">${m.id} (${m.label})</option>`).join("");
    renderAdminPlans();

    const [usersRes, reqsRes] = await Promise.all([api("/admin/users"), api("/admin/requests")]);
    renderAdminUsers(usersRes.users);
    renderAdminRequests(reqsRes.requests);
  } catch (err) {
    if (err.message !== "هذه الصفحة للمدير فقط") showStatus(err.message, "error");
  }
}

function renderAdminPlans() {
  els.plansList.innerHTML = adminPlans
    .map((p) => `
      <li class="lib-item">
        <div class="lib-info">
          <span class="lib-title">💳 ${escapeHtml(p.name)}${p.price ? ` — ${escapeHtml(p.price)}` : ""}</span>
          <span class="lib-meta">${p.days} يوم • ${p.summaries === -1 ? "∞ ملخص" : `${p.summaries} ملخص`} • 🤖 ${escapeHtml(p.model || "")}</span>
        </div>
        <button type="button" class="btn-logout" data-plan-id="${p.id}">حذف</button>
      </li>`)
    .join("");
}

els.plansList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-plan-id]");
  if (!btn) return;
  if (!confirm("حذف هذه الخطة؟")) return;
  try { await api(`/admin/plans/${btn.dataset.planId}`, { method: "DELETE" }); loadAdmin(); }
  catch (err) { showStatus(err.message, "error"); }
});

els.addPlanBtn.addEventListener("click", async () => {
  const name = els.planName.value.trim();
  if (!name || !els.planDays.value) return showStatus("أدخل اسم الخطة وعدد الأيام.", "error");
  try {
    await api("/admin/plans", {
      method: "POST",
      body: JSON.stringify({
        name, days: Number(els.planDays.value),
        summaries: els.planSummaries.value === "" ? -1 : Number(els.planSummaries.value),
        price: els.planPrice.value.trim(), model: els.planModel.value,
      }),
    });
    els.planName.value = els.planDays.value = els.planSummaries.value = els.planPrice.value = "";
    loadAdmin();
  } catch (err) { showStatus(err.message, "error"); }
});

function subLabel(s) {
  if (!s.active) return '<span class="role-tag">مجاني</span>';
  const left = s.remaining === "∞" ? "∞" : s.remaining;
  return `<span class="role-tag role-admin">⭐ ${escapeHtml(s.plan_name)} — ${left}</span>`;
}

function renderAdminUsers(users) {
  const options = adminPlans.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${p.days}ي)</option>`).join("");
  els.adminUsersBody.innerHTML = users
    .map((u) => `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.name || "—")}</td>
        <td dir="ltr">${escapeHtml(u.email)}</td>
        <td><span class="role-tag ${u.role === "admin" ? "role-admin" : ""}">${u.role === "admin" ? "مدير" : "مستخدم"}</span></td>
        <td>${subLabel(u.subscription)}</td>
        <td class="sub-manage">
          <select data-role="plan-select">${options}</select>
          <button type="button" data-admin-action="subscribe" data-id="${u.id}">✓</button>
          <button type="button" data-admin-action="unsubscribe" data-id="${u.id}">✗</button>
        </td>
        <td class="admin-actions">
          <button type="button" data-admin-action="toggle-role" data-id="${u.id}" title="تبديل الدور">🔁</button>
          <button type="button" data-admin-action="delete-user" data-id="${u.id}" title="حذف">🗑️</button>
        </td>
      </tr>`)
    .join("");
}

function renderAdminRequests(requests) {
  els.reqEmpty.classList.toggle("hidden", requests.length > 0);
  els.adminRequests.innerHTML = requests
    .map((r) => `
      <li class="lib-item" data-req-id="${r.id}">
        <div class="lib-info">
          <span class="lib-title">💳 ${escapeHtml(r.plan_name)} — ${escapeHtml(r.user_email)}</span>
          <span class="lib-meta">${formatDate(r.date)}</span>
        </div>
        <div class="lib-actions">
          <button type="button" data-req-action="approve">✓ قبول</button>
          <button type="button" data-req-action="reject">✗ رفض</button>
        </div>
      </li>`)
    .join("");
}

document.addEventListener("click", async (e) => {
  const reqBtn = e.target.closest("button[data-req-action]");
  if (reqBtn) {
    const id = reqBtn.closest(".lib-item").dataset.reqId;
    try {
      await api(`/admin/requests/${id}/${reqBtn.dataset.reqAction}`, { method: "POST" });
      loadAdmin();
    } catch (err) { showStatus(err.message, "error"); }
    return;
  }

  const btn = e.target.closest("button[data-admin-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  try {
    if (btn.dataset.adminAction === "delete-user") {
      if (!confirm("حذف هذا المستخدم وكل ملخصاته؟")) return;
      await api(`/admin/users/${id}`, { method: "DELETE" });
    } else if (btn.dataset.adminAction === "toggle-role") {
      await api(`/admin/users/${id}/role`, { method: "PATCH" });
    } else if (btn.dataset.adminAction === "subscribe") {
      const select = btn.closest("tr").querySelector('select[data-role="plan-select"]');
      await api(`/admin/users/${id}/subscribe`, { method: "POST", body: JSON.stringify({ plan_id: Number(select.value) }) });
    } else if (btn.dataset.adminAction === "unsubscribe") {
      await api(`/admin/users/${id}/unsubscribe`, { method: "POST" });
    }
    loadAdmin();
  } catch (err) { showStatus(err.message, "error"); }
});

/* ---------- نسخ/تنزيل + PWA ---------- */

function downloadText(filename, content) {
  const blob = new Blob(["\ufeff" + content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

els.copyBtn.addEventListener("click", async () => {
  if (!lastSummary) return;
  try { await navigator.clipboard.writeText(lastSummary); els.copyBtn.textContent = "✓ تم"; }
  catch { els.copyBtn.textContent = "✗ خطأ"; }
  setTimeout(() => (els.copyBtn.textContent = "📋 نسخ"), 1800);
});

els.downloadBtn.addEventListener("click", () => {
  if (lastSummary) downloadText(`ملخص-${new Date().toISOString().slice(0, 10)}.txt`, lastSummary);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
