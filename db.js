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
