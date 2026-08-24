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
  quizLibList: $("quizLibList"),
  quizLibEmpty: $("quizLibEmpty"),
  quizPlayCard: $("quizPlayCard"),
  quizPicker: $("quizPicker"),
  quizPlayTitle: $("quizPlayTitle"),
  quizPlayArea: $("quizPlayArea"),
  quizPrintBtn: $("quizPrintBtn"),
  quizExitBtn: $("quizExitBtn"),
  fcLibList: $("fcLibList"),
  fcLibEmpty: $("fcLibEmpty"),
  fcPicker: $("fcPicker"),
  fcPlayCard: $("fcPlayCard"),
  fcPlayTitle: $("fcPlayTitle"),
  fcPlayArea: $("fcPlayArea"),
  fcExitBtn: $("fcExitBtn"),
  libFilters: $("libFilters"),
  saveSubjectInput: $("saveSubjectInput"),
  saveBtn: $("saveBtn"),
  saveBar: $("saveBar"),
  saveTitleInput: $("saveTitleInput"),
  saveConfirmBtn: $("saveConfirmBtn"),
  saveCancelBtn: $("saveCancelBtn"),
  copyBtn: $("copyBtn"),
  downloadBtn: $("downloadBtn"),
  shareBtn: $("shareBtn"),

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
  planQuizzes: $("planQuizzes"),
  planModel: $("planModel"),
  planPrice: $("planPrice"),
  addPlanBtn: $("addPlanBtn"),
  adminUsersBody: $("adminUsersBody"),
  exportCsvBtn: $("exportCsvBtn"),
  adminLibList: $("adminLibList"),
  adminLibHint: $("adminLibHint"),
  announcementAdmin: $("announcementAdmin"),
  saveAnnBtn: $("saveAnnBtn"),
  clearAnnBtn: $("clearAnnBtn"),
  announcementBar: $("announcementBar"),
  paymentNoteAdmin: $("paymentNoteAdmin"),
  savePaymentBtn: $("savePaymentBtn"),
  paymentBox: $("paymentBox"),
  paymentNote: $("paymentNote"),
};

let token = localStorage.getItem("token") || "";
let currentUser = null;
let summaryLength = "medium";
let lastSummary = "";
let lastQuiz = null;
let currentLibFilter = "";
let modelLabels = {};
let adminPlans = [];
let mySub = null;
let lastAdminUsers = [];

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
  if (name === "quiz") loadQuizPage();
  if (name === "flash") loadFlashPage();
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
  loadAnnouncement();
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

function mdToHtml(markdown) {
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
  return html.join("");
}

function renderSummary(markdown) {
  els.summaryOutput.innerHTML = mdToHtml(markdown);
  els.resultCard.classList.remove("hidden");
}

/* ---------- الاختبار الذاتي (يظهر في صفحة الاختبارات) ---------- */

let quizSourceText = "";
let quizSourceTitle = "";

async function generateQuizIntoPage(text, title) {
  quizSourceText = text;
  quizSourceTitle = title;
  els.quizPicker.classList.add("hidden");
  els.quizPlayCard.classList.remove("hidden");
  els.quizPrintBtn.classList.add("hidden");
  document.body.classList.remove("print-exam");
  els.quizPlayTitle.textContent = `⚡ اختبار سريع: ${title}`;
  els.quizPlayArea.innerHTML = '<p class="library-empty">جارٍ إنشاء الأسئلة... <span class="spinner"></span></p>';
  try {
    const data = await api("/quiz", {
      method: "POST",
      body: JSON.stringify({ text, count: 5 }),
    });
    if (data.subscription) renderSubChip(data.subscription);
    quizPageItem = null;
    renderQuiz(data.questions, els.quizPlayArea);
  } catch (err) {
    if (err.code === "QUOTA_LOCKED" || err.code === "QUOTA") {
      els.quizPlayArea.innerHTML = `
        <div class="quiz-locked">
          <div class="lock-icon">🔒</div>
          <p>${escapeHtml(err.message)}</p>
          <button class="btn btn-primary" type="button" onclick="showPage('plans')">💳 عرض الباقات</button>
        </div>`;
    } else {
      els.quizPlayArea.innerHTML = `<p class="status error">${escapeHtml(err.message)}</p>`;
    }
  }
}

function renderQuiz(questions, target) {
  lastQuiz = questions;
  target = target || els.summaryOutput;
  const html = [
    '<div class="quiz-wrap">',
    '<div class="quiz-head">🧪 اختبار ذاتي — أجب على جميع الأسئلة</div>',
  ];
  questions.forEach((q, qi) => {
    html.push(`<div class="quiz-q" data-qi="${qi}">`);
    html.push(`<div class="quiz-qtitle">${qi + 1}. ${escapeHtml(q.q)}</div>`);
    html.push('<div class="quiz-opts">');
    (q.options || []).forEach((opt, oi) => {
      html.push(`<button type="button" class="quiz-opt" data-qi="${qi}" data-oi="${oi}">${escapeHtml(opt)}</button>`);
    });
    html.push("</div>");
    html.push(`<div class="quiz-explain hidden" data-explain="${qi}"></div>`);
    html.push("</div>");
  });
  html.push('<div id="quizScore" class="quiz-score hidden"></div>');
  html.push('<div class="quiz-actions"><button type="button" class="btn btn-ghost" id="quizBackBtn">↩️ رجوع للملخص</button> <button type="button" class="btn btn-primary" id="quizRegenBtn">🔄 أسئلة أخرى</button></div>');
  html.push("</div>");
  target.innerHTML = html.join("");
  if (target === els.summaryOutput) {
    els.resultCard.classList.remove("hidden");
    els.resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

document.addEventListener("click", (e) => {
  const regen = e.target.id === "quizRegenBtn";
  const back = e.target.id === "quizBackBtn";
  if (!regen && !back) return;

  if (regen) generateQuizIntoPage(quizSourceText, quizSourceTitle);
  else if (back) {
    els.quizPlayCard.classList.add("hidden");
    els.quizPicker.classList.remove("hidden");
    els.quizPrintBtn.classList.add("hidden");
    document.body.classList.remove("print-exam");
    loadQuizPage();
  }
});

document.addEventListener("click", (e) => {
  const opt = e.target.closest(".quiz-opt");
  if (!opt || !lastQuiz) return;
  const qi = Number(opt.dataset.qi);
  const oi = Number(opt.dataset.oi);
  const qEl = opt.closest(".quiz-q");
  if (qEl.dataset.done === "1") return;
  qEl.dataset.done = "1";
  const correct = Number(lastQuiz[qi]?.answer);
  qEl.querySelectorAll(".quiz-opt").forEach((b) => {
    const idx = Number(b.dataset.oi);
    if (idx === correct) b.classList.add("correct");
    else if (idx === oi) b.classList.add("wrong");
    b.disabled = true;
  });
  const exp = qEl.querySelector(".quiz-explain");
  if (lastQuiz[qi]?.explain) {
    exp.textContent = "💡 " + lastQuiz[qi].explain;
    exp.classList.remove("hidden");
  }
  const wrap = opt.closest(".quiz-wrap");
  const total = wrap.querySelectorAll(".quiz-q").length;
  const done = wrap.querySelectorAll('.quiz-q[data-done="1"]').length;
  const correctCount = wrap.querySelectorAll(".quiz-q .quiz-opt.correct").length;
  const scoreEl = wrap.querySelector("#quizScore");
  if (done === total && scoreEl) {
    scoreEl.classList.remove("hidden");
    scoreEl.innerHTML = `🏁 نتيجتك: <b>${correctCount} / ${total}</b> ${
      correctCount === total ? "— ممتاز! 🎉" : correctCount >= total / 2 ? "— جيد، راجع الأخطاء 💪" : "— تحتاج مراجعة الدرس 📖"
    }`;
    scoreEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});

/* ---------- صفحة الاختبارات ---------- */

let quizPageItem = null;

async function loadQuizPage() {
  els.quizPicker.classList.remove("hidden");
  els.quizPlayCard.classList.add("hidden");
  els.quizPrintBtn.classList.add("hidden");
  document.body.classList.remove("print-exam");
  try {
    const data = await api("/library");
    window._libItems = data.items;
    const usable = data.items.filter((it) => it.lesson);
    els.quizLibEmpty.classList.toggle("hidden", usable.length > 0);
    els.quizLibList.innerHTML = usable
      .map((it) => `
        <li class="lib-item">
          <div class="lib-info">
            <span class="lib-title">${escapeHtml(it.title)}</span>
            <span class="lib-meta">${it.subject ? `<span class="subject-tag">📘 ${escapeHtml(it.subject)}</span> • ` : ""}${it.words} كلمة</span>
          </div>
          <div class="lib-actions">
            <button type="button" class="quiz-mode" data-id="${it.id}" data-mode="quick">⚡ اختبار</button>
            <button type="button" class="quiz-mode" data-id="${it.id}" data-mode="cards">🃏 بطاقات</button>
            <button type="button" class="quiz-mode" data-id="${it.id}" data-mode="plan">📅 خطة</button>
            <button type="button" class="quiz-mode" data-id="${it.id}" data-mode="exam">📄 امتحان</button>
          </div>
        </li>`)
      .join("");
  } catch {}
}

els.quizLibList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button.quiz-mode");
  if (!btn) return;
  const item = (window._libItems || []).find((it) => String(it.id) === btn.dataset.id);
  if (!item) return;
  await startQuizPage(item, btn.dataset.mode);
});

els.quizExitBtn.addEventListener("click", () => {
  els.quizPlayCard.classList.add("hidden");
  els.quizPicker.classList.remove("hidden");
  els.quizPrintBtn.classList.add("hidden");
  document.body.classList.remove("print-exam");
});

els.quizPrintBtn.addEventListener("click", () => window.print());

async function startQuizPage(item, mode) {
  quizPageItem = item;
  if (mode === "quick") {
    await generateQuizIntoPage(item.lesson, item.title);
    quizPageItem = item;
    return;
  }
  if (mode === "cards") {
    await startFlashcards(item);
    return;
  }
  if (mode === "plan") {
    await askStudyPlan(item);
    return;
  }
  els.quizPicker.classList.add("hidden");
  els.quizPlayCard.classList.remove("hidden");
  els.quizPrintBtn.classList.remove("hidden");
  document.body.classList.remove("print-exam");
  els.quizPlayTitle.textContent = `📄 امتحان كامل: ${item.title}`;
  els.quizPlayArea.innerHTML = '<p class="library-empty">جارٍ إنشاء الامتحان... <span class="spinner"></span></p>';

  try {
    const data = await api("/quiz", {
      method: "POST",
      body: JSON.stringify({ text: item.lesson, count: 15 }),
    });
    if (data.subscription) renderSubChip(data.subscription);
    renderExamPaper(data.questions, item);
  } catch (err) {
    renderStudyToolError(err);
  }
}

function renderStudyToolError(err, area) {
  const target = area || els.quizPlayArea;
  if (err.code === "QUOTA_LOCKED" || err.code === "QUOTA") {
    target.innerHTML = `
      <div class="quiz-locked">
        <div class="lock-icon">🔒</div>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-primary" type="button" onclick="showPage('plans')">💳 عرض الباقات</button>
      </div>`;
  } else {
    target.innerHTML = `<p class="status error">${escapeHtml(err.message)}</p>`;
  }
}

/* ---------- صفحة بطاقات الحفظ ---------- */

let fcUI = null;

async function loadFlashPage() {
  fcUI = null;
  els.fcPicker.classList.remove("hidden");
  els.fcPlayCard.classList.add("hidden");
  try {
    const data = await api("/library");
    const usable = data.items.filter((it) => it.lesson);
    els.fcLibEmpty.classList.toggle("hidden", usable.length > 0);
    els.fcLibList.innerHTML = usable
      .map((it) => `
        <li class="lib-item">
          <div class="lib-info">
            <span class="lib-title">${escapeHtml(it.title)}</span>
            <span class="lib-meta">${it.subject ? `<span class="subject-tag">📘 ${escapeHtml(it.subject)}</span> • ` : ""}${it.words} كلمة</span>
          </div>
          <div class="lib-actions">
            <button type="button" class="fc-mode" data-id="${it.id}">🃏 إنشاء بطاقات</button>
          </div>
        </li>`)
      .join("");
  } catch {}
}

els.fcLibList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button.fc-mode");
  if (!btn) return;
  const item = (window._libItems || []).find((it) => String(it.id) === btn.dataset.id);
  if (!item) return;
  await startFlashcards(item, {
    area: els.fcPlayArea, title: els.fcPlayTitle,
    picker: els.fcPicker, play: els.fcPlayCard, exit: els.fcExitBtn,
  });
});

els.fcExitBtn.addEventListener("click", () => {
  els.fcPlayCard.classList.add("hidden");
  els.fcPicker.classList.remove("hidden");
  loadFlashPage();
});

async function startFlashcards(item, ui) {
  fcUI = ui || {
    area: els.quizPlayArea, title: els.quizPlayTitle,
    picker: els.quizPicker, play: els.quizPlayCard, exit: els.quizExitBtn,
  };
  fcUI.picker.classList.add("hidden");
  fcUI.play.classList.remove("hidden");
  fcUI.title.textContent = `🃏 بطاقات الحفظ: ${item.title}`;
  fcUI.area.innerHTML = '<p class="library-empty">جارٍ إنشاء البطاقات... <span class="spinner"></span></p>';
  try {
    const data = await api("/flashcards", {
      method: "POST",
      body: JSON.stringify({ text: item.lesson }),
    });
    if (data.subscription) renderSubChip(data.subscription);
    renderFlashcards(data.cards, item.title);
  } catch (err) {
    renderStudyToolError(err, fcUI.area);
  }
}

function renderFlashcards(cards) {
  const cardsHtml = cards
    .map(
      (c, i) => `
      <div class="fc-card" data-fc="${i}">
        <div class="fc-inner">
          <div class="fc-front"><small>سؤال ${i + 1}</small><p>${escapeHtml(c.front)}</p><span>اضغط لكشف الجواب</span></div>
          <div class="fc-back"><small>الجواب</small><p>${escapeHtml(c.back)}</p></div>
        </div>
      </div>`
    )
    .join("");
  fcUI.area.innerHTML = `
    <div class="fc-wrap">
      <div class="quiz-head">🃏 اضغط على كل بطاقة لقلبها واحفظ</div>
      <div class="fc-grid">${cardsHtml}</div>
      <div class="quiz-actions">
        <button type="button" class="btn btn-ghost" id="fcBackBtn">↩️ دروس أخرى</button>
        <button type="button" class="btn btn-primary" id="fcRegenBtn">🔄 بطاقات أخرى</button>
      </div>
    </div>`;
}

document.addEventListener("click", (e) => {
  const card = e.target.closest(".fc-card");
  if (card) { card.classList.toggle("flipped"); return; }
  if (e.target.id === "fcBackBtn" && fcUI) { fcUI.exit.click(); return; }
  if (e.target.id === "fcRegenBtn" && quizPageItem) { startFlashcards(quizPageItem, fcUI); }
});

/* ---------- خطة المذاكرة ---------- */

async function askStudyPlan(item) {
  els.quizPicker.classList.add("hidden");
  els.quizPlayCard.classList.remove("hidden");
  els.quizPrintBtn.classList.add("hidden");
  document.body.classList.remove("print-exam");
  els.quizPlayTitle.textContent = `📅 خطة مذاكرة: ${item.title}`;
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  els.quizPlayArea.innerHTML = `
    <div class="plan-ask">
      <div class="quiz-head">📅 متى موعد امتحانك في هذه المادة؟</div>
      <input type="date" id="examDateInput" value="${week}" min="${today}">
      <button type="button" class="btn btn-primary btn-lg" id="planGoBtn">أنشئ خطة المذاكرة</button>
    </div>`;
  document.getElementById("planGoBtn").addEventListener("click", async () => {
    const examDate = document.getElementById("examDateInput").value;
    els.quizPlayArea.innerHTML = '<p class="library-empty">جارٍ إعداد خطة المذاكرة... <span class="spinner"></span></p>';
    try {
      const data = await api("/studyplan", {
        method: "POST",
        body: JSON.stringify({ text: item.lesson, exam_date: examDate }),
      });
      if (data.subscription) renderSubChip(data.subscription);
      els.quizPlayArea.innerHTML = `
        <div class="summary-output">${mdToHtml(data.plan)}</div>
        <div class="quiz-actions">
          <button type="button" class="btn btn-ghost" id="planBackBtn">↩️ دروس أخرى</button>
          <button type="button" class="btn btn-primary" id="planPrintBtn">🖨️ طباعة الخطة</button>
        </div>`;
      document.body.classList.add("print-exam");
      document.getElementById("planBackBtn").addEventListener("click", () => {
        document.body.classList.remove("print-exam");
        els.quizExitBtn.click();
      });
      document.getElementById("planPrintBtn").addEventListener("click", () => window.print());
    } catch (err) {
      renderStudyToolError(err);
    }
  });
}

function renderExamPaper(questions, item) {
  const letters = ["أ", "ب", "ج", "د"];
  const rows = questions
    .map((q, i) => {
      const opts = (q.options || [])
        .map((o, oi) => `<li>${escapeHtml(o)}</li>`)
        .join("");
      return `<li class="exam-q"><div class="exam-qtext">${i + 1}. ${escapeHtml(q.q)} <span class="exam-pts">(${2} ن)</span></div><ol type="A" class="exam-opts">${opts}</ol></li>`;
    })
    .join("");
  const key = questions.map((q, i) => `<li>${i + 1} - ${letters[Number(q.answer)] || "?"}</li>`).join("");
  els.quizPlayArea.innerHTML = `
    <div class="exam-paper">
      <div class="exam-header">
        <div class="exam-topline"><span>المادة: ${escapeHtml(item.subject || "............")}</span><span>المدة: ساعة واحدة</span></div>
        <h2 class="exam-title">امتحان: ${escapeHtml(item.title)}</h2>
        <div class="exam-meta">الاسم: .............................. اللقب: .............................. القسم: ..............</div>
      </div>
      <ol class="exam-questions">${rows}</ol>
      <div class="exam-key">
        <h3>🔑 مفاتيح الأجوبة (للمصحح)</h3>
        <ol class="exam-key-list">${key}</ol>
      </div>
    </div>`;
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
  els.saveSubjectInput.value = localStorage.getItem("last_subject") || "";
  els.saveBar.classList.remove("hidden");
  els.saveTitleInput.focus();
});
els.saveCancelBtn.addEventListener("click", () => els.saveBar.classList.add("hidden"));
els.saveTitleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") els.saveConfirmBtn.click(); });

els.saveConfirmBtn.addEventListener("click", async () => {
  if (!lastSummary) return;
  const title = els.saveTitleInput.value.trim() || suggestTitle(lastSummary);
  const subject = els.saveSubjectInput.value.trim();
  try {
    await api("/library", {
      method: "POST",
      body: JSON.stringify({ title, summary: lastSummary, lesson: els.lessonText.value.trim(), words: countWords(els.lessonText.value), subject }),
    });
    if (subject) localStorage.setItem("last_subject", subject);
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
  window._libItems = items;
  els.libCount.textContent = `${items.length} درس`;
  els.libraryEmpty.classList.toggle("hidden", items.length > 0);
  els.navLibCount.textContent = items.length;
  els.navLibCount.classList.toggle("hidden", items.length === 0);

  const subjects = [...new Set(items.map((it) => it.subject).filter(Boolean))];
  els.libFilters.classList.toggle("hidden", subjects.length === 0);
  if (!subjects.includes(currentLibFilter)) currentLibFilter = "";
  els.libFilters.innerHTML =
    `<button type="button" class="chip ${currentLibFilter === "" ? "active" : ""}" data-subject="">الكل (${items.length})</button>` +
    subjects
      .map((s) => {
        const n = items.filter((it) => it.subject === s).length;
        return `<button type="button" class="chip ${currentLibFilter === s ? "active" : ""}" data-subject="${escapeHtml(s)}">${escapeHtml(s)} (${n})</button>`;
      })
      .join("");

  const visible = currentLibFilter ? items.filter((it) => it.subject === currentLibFilter) : items;
  els.libList.innerHTML = visible
    .map((it) => `
      <li class="lib-item" data-id="${it.id}">
        <div class="lib-info">
          <span class="lib-title">${escapeHtml(it.title)}</span>
          <span class="lib-meta">${it.subject ? `<span class="subject-tag">📘 ${escapeHtml(it.subject)}</span> • ` : ""}${formatDate(it.date)} • ${it.words} كلمة</span>
        </div>
        <div class="lib-actions">
          <button type="button" data-action="view" title="عرض">👁️</button>
          <button type="button" data-action="quiz" title="اختبر نفسك">🧪</button>
          <button type="button" data-action="share" title="مشاركة">🔗</button>
          <button type="button" data-action="download" title="تنزيل">⬇️</button>
          <button type="button" data-action="delete" title="حذف">🗑️</button>
        </div>
      </li>`)
    .join("");
}

els.libFilters.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  currentLibFilter = chip.dataset.subject || "";
  renderLibrary(window._libItems || []);
});

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
    } else if (btn.dataset.action === "quiz") {
      const item = (window._libItems || []).find((it) => String(it.id) === id);
      if (!item) return;
      if (!item.lesson) {
        showStatus("لا يوجد نص أصلي لهذا الدرس لإنشاء الأسئلة.", "error");
        return;
      }
      showPage("quiz");
      await startQuizPage(item, "quick");
    } else if (btn.dataset.action === "share") {
      const data = await api(`/library/${id}`);
      await shareSummary(data.item.title, data.item.summary, data.item.subject);
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
    const [plansRes, reqsRes, payRes] = await Promise.all([
      api("/plans"),
      api("/requests"),
      api("/payment-info"),
    ]);
    renderPlansGrid(plansRes.plans);
    renderMyRequests(reqsRes.requests);
    if (payRes.note) {
      els.paymentNote.textContent = payRes.note;
      els.paymentBox.classList.remove("hidden");
    }
  } catch (err) { showStatus(err.message, "error"); }
}

function renderPlansGrid(plans) {
  const maxPrice = Math.max(...plans.map((p) => Number(p.price) || 0), 0);
  els.plansGrid.innerHTML = plans
    .map((p) => {
      const isCurrent = mySub?.active && mySub?.plan_id === p.id;
      const featured = (Number(p.price) || 0) === maxPrice && maxPrice > 0;
      const qLine =
        Number(p.quizzes) === 0
          ? "<li>🔒 بدون اختبارات</li>"
          : Number(p.quizzes) === -1
            ? "<li>🧪 اختبارات غير محدودة</li>"
            : `<li>🧪 ${p.quizzes} اختبارات</li>`;
      return `
      <div class="plan-card ${featured ? "featured" : ""} ${isCurrent ? "current" : ""}">
        ${featured ? '<span class="plan-badge">⭐ الأفضل قيمة</span>' : ""}
        ${isCurrent ? '<span class="plan-badge current-badge">✓ باقتك الحالية</span>' : ""}
        <span class="plan-name">${escapeHtml(p.name)}</span>
        <div class="plan-price">${escapeHtml(p.price || "0")}<small> د.م</small></div>
        <span class="plan-ai">🤖 ذكاء اصطناعي ${modelStrength(p.model)}</span>
        <ul class="plan-feats">
          <li>⏳ صلاحية ${p.days} يوم</li>
          <li>${p.summaries === -1 ? "♾️ ملخصات غير محدودة" : `📝 حتى ${p.summaries} ملخص`}</li>
          ${qLine}
          <li>✓ حفظ في مكتبتك الخاصة</li>
        </ul>
        <button class="btn ${featured ? "btn-primary" : "btn-ghost"} plan-cta" type="button" data-request-plan="${p.id}">${isCurrent ? "تجديد / تمديد" : "طلب اشتراك"}</button>
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

    const [usersRes, reqsRes, payRes] = await Promise.all([
      api("/admin/users"),
      api("/admin/requests"),
      api("/payment-info"),
    ]);
    els.paymentNoteAdmin.value = payRes.note || "";
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
          <span class="lib-meta">${p.days} يوم • ${p.summaries === -1 ? "∞ ملخص" : `${p.summaries} ملخص`} • ${Number(p.quizzes) === 0 ? "🔒 اختبارات" : Number(p.quizzes) === -1 ? "∞ اختبارات" : `${p.quizzes} اختبارات`} • 🤖 ${escapeHtml(p.model || "")}</span>
        </div>
        <div class="lib-actions">
          <button type="button" data-edit-plan="${p.id}" title="تعديل">✏️ تعديل</button>
          <button type="button" class="btn-logout" data-plan-id="${p.id}">حذف</button>
        </div>
      </li>`)
    .join("");
}

els.plansList.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("button[data-edit-plan]");
  if (editBtn) { startEditPlan(editBtn.dataset.editPlan); return; }
  const btn = e.target.closest("button[data-plan-id]");
  if (!btn) return;
  if (!confirm("حذف هذه الخطة؟")) return;
  try { await api(`/admin/plans/${btn.dataset.planId}`, { method: "DELETE" }); resetPlanForm(); loadAdmin(); }
  catch (err) { showStatus(err.message, "error"); }
});

/* ---------- الوضع الليلي ---------- */

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
  document.querySelectorAll(".theme-toggle").forEach((b) => {
    b.textContent = t === "dark" ? "☀️ نهاري" : "🌙 ليلي";
  });
}
applyTheme(localStorage.getItem("theme") || "light");
document.addEventListener("click", (e) => {
  if (e.target.closest(".theme-toggle")) {
    applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  }
});

/* ---------- تعديل الخطط ---------- */

let editingPlanId = null;

function startEditPlan(id) {
  const p = adminPlans.find((x) => String(x.id) === String(id));
  if (!p) return;
  editingPlanId = p.id;
  els.planName.value = p.name;
  els.planDays.value = p.days;
  els.planSummaries.value = Number(p.summaries) === -1 ? "" : p.summaries;
  els.planQuizzes.value = p.quizzes === undefined || Number(p.quizzes) === -1 ? "" : p.quizzes;
  els.planModel.value = p.model || "";
  els.planPrice.value = p.price || "";
  els.addPlanBtn.textContent = "💾 حفظ التعديلات";
  els.addPlanBtn.scrollIntoView({ behavior: "smooth", block: "center" });
  els.planName.focus();
}

function resetPlanForm() {
  editingPlanId = null;
  els.planName.value = els.planDays.value = els.planSummaries.value = els.planQuizzes.value = els.planPrice.value = "";
  els.addPlanBtn.textContent = "إضافة";
}

els.addPlanBtn.addEventListener("click", async () => {
  const name = els.planName.value.trim();
  if (!name || !els.planDays.value) return showStatus("أدخل اسم الخطة وعدد الأيام.", "error");
  const payload = {
    name, days: Number(els.planDays.value),
    summaries: els.planSummaries.value === "" ? -1 : Number(els.planSummaries.value),
    quizzes: els.planQuizzes.value === "" ? -1 : Number(els.planQuizzes.value),
    price: els.planPrice.value.trim(), model: els.planModel.value,
  };
  try {
    if (editingPlanId) {
      await api(`/admin/plans/${editingPlanId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/admin/plans", { method: "POST", body: JSON.stringify(payload) });
    }
    resetPlanForm();
    loadAdmin();
  } catch (err) { showStatus(err.message, "error"); }
});

/* ---------- الوضع الليلي نهاية ---------- */

els.savePaymentBtn.addEventListener("click", async () => {
  try {
    await api("/admin/payment-info", {
      method: "POST",
      body: JSON.stringify({ note: els.paymentNoteAdmin.value }),
    });
    els.savePaymentBtn.textContent = "✓ تم الحفظ";
    setTimeout(() => (els.savePaymentBtn.textContent = "حفظ التعليمات"), 2000);
  } catch (err) { showStatus(err.message, "error"); }
});

function subLabel(s) {
  if (!s.active) return '<span class="role-tag">مجاني</span>';
  const left = s.remaining === "∞" ? "∞" : s.remaining;
  return `<span class="role-tag role-admin">⭐ ${escapeHtml(s.plan_name)} — ${left}</span>`;
}

function renderAdminUsers(users) {
  lastAdminUsers = users;
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
          <button type="button" data-admin-action="view-lib" data-id="${u.id}" title="مكتبته">📚</button>
          <button type="button" data-admin-action="reset-free" data-id="${u.id}" title="تصفير الحصة">♻️</button>
          <button type="button" data-admin-action="set-password" data-id="${u.id}" title="كلمة مرور جديدة">🔑</button>
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
    } else if (btn.dataset.adminAction === "view-lib") {
      const u = (lastAdminUsers || []).find((x) => String(x.id) === id);
      const data = await api(`/admin/users/${id}/library`);
      els.adminLibList.innerHTML = data.items
        .map((it) => `
          <li class="lib-item">
            <div class="lib-info">
              <span class="lib-title">${escapeHtml(it.title)}</span>
              <span class="lib-meta">${it.subject ? escapeHtml(it.subject) + " • " : ""}${formatDate(it.date)} • ${it.words} كلمة</span>
            </div>
          </li>`)
        .join("");
      const empty = !data.items.length;
      els.adminLibHint.textContent = empty
        ? `لا توجد دروس في مكتبة ${u ? u.email : "هذا المستخدم"}.`
        : `📚 دروس ${u ? u.email : ""}:`;
      els.adminLibHint.classList.toggle("hidden", !empty);
    } else if (btn.dataset.adminAction === "reset-free") {
      if (!confirm("تصفير حصة هذا المستخدم (الملخصات والاختبارات)؟")) return;
      await api(`/admin/users/${id}/reset-free`, { method: "POST" });
    } else if (btn.dataset.adminAction === "set-password") {
      const np = prompt("كلمة المرور الجديدة للمستخدم (6 أحرف على الأقل):");
      if (!np) return;
      await api(`/admin/users/${id}/password`, { method: "POST", body: JSON.stringify({ password: np }) });
      showStatus("✓ تم تغيير كلمة المرور", "success");
    }
    loadAdmin();
  } catch (err) { showStatus(err.message, "error"); }
});

/* ---------- تصدير CSV + الإعلان ---------- */

els.exportCsvBtn.addEventListener("click", () => {
  if (!lastAdminUsers || !lastAdminUsers.length) return;
  const rows = [["id", "name", "email", "role", "plan", "expires", "lessons"]];
  lastAdminUsers.forEach((u) => {
    rows.push([
      u.id, u.name || "", u.email, u.role || "user",
      u.subscription?.active ? u.subscription.plan_name : "free",
      u.subscription?.expires || "", u.lessons,
    ]);
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadText("mulakhes-users.csv", csv);
});

els.saveAnnBtn.addEventListener("click", async () => {
  try {
    await api("/admin/announcement", { method: "POST", body: JSON.stringify({ text: els.announcementAdmin.value }) });
    els.saveAnnBtn.textContent = "✓ نُشر";
    setTimeout(() => (els.saveAnnBtn.textContent = "نشر الإعلان"), 2000);
    loadAnnouncement();
  } catch (err) { showStatus(err.message, "error"); }
});

els.clearAnnBtn.addEventListener("click", async () => {
  try {
    await api("/admin/announcement", { method: "POST", body: JSON.stringify({ text: "" }) });
    els.announcementAdmin.value = "";
    loadAnnouncement();
  } catch (err) { showStatus(err.message, "error"); }
});

async function loadAnnouncement() {
  try {
    const data = await fetch("/api/announcement").then((r) => r.json());
    if (data.text) {
      els.announcementBar.textContent = "📢 " + data.text;
      els.announcementBar.classList.remove("hidden");
    } else {
      els.announcementBar.classList.add("hidden");
    }
    if (currentUser?.role === "admin" && els.announcementAdmin && els.announcementAdmin.value === "") {
      api("/admin/announcement").then((a) => (els.announcementAdmin.value = a.text || "")).catch(() => {});
    }
  } catch {}
}

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

/* ---------- مشاركة الملخص ---------- */

async function shareSummary(title, summary, subject) {
  try {
    const data = await api("/share", {
      method: "POST",
      body: JSON.stringify({ title, summary, subject }),
    });
    const link = `${location.origin}/s/${data.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "ملخص: " + title, text: "شاهد هذا الملخص:", url: link });
      } else {
        await navigator.clipboard.writeText(link);
        showStatus("✓ تم نسخ رابط المشاركة — أرسله لصديقك", "success");
      }
    } catch {
      showStatus("رابط المشاركة: " + link, "success");
    }
  } catch (err) {
    showStatus(err.message, "error");
  }
}

els.shareBtn.addEventListener("click", () => {
  if (!lastSummary) return;
  shareSummary(suggestTitle(els.lessonText.value || lastSummary), lastSummary, els.saveSubjectInput.value.trim());
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
