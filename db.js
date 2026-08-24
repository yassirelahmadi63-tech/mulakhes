const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_FILE = path.join(__dirname, "data.json");

let data = {
  users: [],
  library: [],
  plans: [],
  requests: [],
  nextUserId: 1,
  nextLibId: 1,
  nextPlanId: 1,
  nextRequestId: 1,
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = Object.assign(data, JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
  } catch {
    console.error("تعذرت قراءة data.json، سيتم إنشاء ملف جديد.");
  }
}

/* خطط افتراضية عند أول تشغيل — كل خطة أغلى = موديل أقوى */
if (!data.plans.length) {
  data.plans = [
    { id: data.nextPlanId++, name: "تجريبي", days: 7, summaries: 20, price: "0", model: "openai/gpt-oss-20b" },
    { id: data.nextPlanId++, name: "شهري", days: 30, summaries: -1, price: "15", model: "qwen/qwen3.6-27b" },
    { id: data.nextPlanId++, name: "سنوي", days: 365, summaries: -1, price: "100", model: "openai/gpt-oss-120b" },
  ];
}

/* ترحيل: الخطط القديمة بدون موديل */
let plansMigrated = false;
const MODEL_BY_NAME = {
  "سنوي": "openai/gpt-oss-120b",
  "شهري": "qwen/qwen3.6-27b",
  "تجريبي": "openai/gpt-oss-20b",
};
data.plans.forEach((p) => {
  if (!p.model) {
    p.model =
      MODEL_BY_NAME[p.name] ||
      (p.days >= 365 ? "openai/gpt-oss-120b" : "openai/gpt-oss-20b");
    plansMigrated = true;
  }
});
if (plansMigrated) save();

function save() {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, DATA_FILE);
  scheduleGitHubSync();
}

/* ---------- مزامنة البيانات مع GitHub (حتى لا تضيع على الاستضافة المجانية) ---------- */

const GH_TOKEN = process.env.GITHUB_TOKEN || "";
const GH_REPO = process.env.GITHUB_REPO || "";
let syncTimer = null;
let syncing = false;

function scheduleGitHubSync() {
  if (!GH_TOKEN || !GH_REPO) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(syncToGitHub, 10000);
}

async function syncToGitHub() {
  if (syncing) { scheduleGitHubSync(); return; }
  syncing = true;
  try {
    const content = fs.readFileSync(DATA_FILE);
    const b64 = content.toString("base64");
    const headers = {
      Authorization: `Bearer ${GH_TOKEN}`,
      "User-Agent": "mulakhes",
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    };
    const apiUrl = `https://api.github.com/repos/${GH_REPO}/contents/data.json`;
    const res = await fetch(apiUrl, { headers });
    const json = await res.json();
    const body = {
      message: "sync data.json",
      content: b64,
      sha: json.sha,
      branch: "main",
    };
    const put = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    if (!put.ok) console.error("GitHub sync failed:", put.status);
    else console.log("✓ data.json synced to GitHub");
  } catch (e) {
    console.error("GitHub sync error:", e.message);
  } finally {
    syncing = false;
  }
}

/* إنشاء حساب المدير تلقائياً عند التشغيل */
function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;
  let admin = data.users.find((u) => u.email === email);
  if (!admin) {
    admin = {
      id: data.nextUserId++,
      email,
      password_hash: bcrypt.hashSync(password, 10),
      name: "المدير",
      role: "admin",
      created_at: new Date().toISOString(),
      subscription: null,
      free_usage: {},
      sub_used: 0,
    };
    data.users.push(admin);
    save();
    console.log(`✓ تم إنشاء حساب المدير: ${email}`);
  } else if (admin.role !== "admin") {
    admin.role = "admin";
    save();
  }
}
ensureAdmin();

module.exports = { data, save };
