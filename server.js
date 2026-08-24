require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { data, save } = require("./db");

const app = express();

/* السماح لتطبيق الأندرويد (Capacitor) بالوصول للـ API */
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  if (
    origin.endsWith("localhost") ||
    origin.includes("capacitor") ||
    origin.includes("trycloudflare.com") ||
    origin.includes("localhost:")
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "2mb" }));

/* ---------- ثوابت ---------- */
const PORT = process.env.PORT || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "openai/gpt-oss-120b";
const FREE_MONTHLY_LIMIT = Number(process.env.FREE_MONTHLY_LIMIT || 3);
const FREE_MODEL = process.env.FREE_MODEL || "openai/gpt-oss-20b";
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "663689193163-sgsvr9n8undigoregmecok0qvkuia3cp.apps.googleusercontent.com").trim();

/* قائمة الموديلات المتاحة مرتبة من الأضعف للأقوى */
const AVAILABLE_MODELS = [
  { id: "allam-2-7b", label: "ضعيف — سريع جداً" },
  { id: "openai/gpt-oss-20b", label: "متوسط" },
  { id: "qwen/qwen3.6-27b", label: "جيد" },
  { id: "openai/gpt-oss-120b", label: "الأقوى" },
];

if (!GROQ_API_KEY) {
  console.warn("⚠ GROQ_API_KEY غير موجود في ملف .env — التلخيص لن يعمل");
}

/* ---------- أدوات مساعدة ---------- */

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role || "user" };
}

function ensureFields(u) {
  let dirty = false;
  if (!("subscription" in u)) { u.subscription = null; dirty = true; }
  if (!("free_usage" in u)) { u.free_usage = {}; dirty = true; }
  if (!("sub_used" in u)) { u.sub_used = 0; dirty = true; }
  if (dirty) save();
  return u;
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function subscriptionInfo(u) {
  ensureFields(u);
  const sub = u.subscription;
  const active = !!(sub && new Date(sub.expires) > new Date());
  if (active) {
    const remaining =
      sub.summaries === -1 ? "∞" : Math.max(0, sub.summaries - u.sub_used);
    return {
      active: true,
      plan_id: sub.plan_id,
      plan_name: sub.plan_name,
      expires: sub.expires,
      remaining,
      model: sub.model || null,
    };
  }
  return {
    active: false,
    plan_name: null,
    expires: null,
    remaining: Math.max(0, FREE_MONTHLY_LIMIT - (u.free_usage[monthKey()] || 0)),
  };
}

/* ---------- المصادقة ---------- */

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    const user = data.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(401).json({ error: "الحساب غير موجود" });
    req.userRow = ensureFields(user);
    next();
  } catch {
    res.status(401).json({ error: "انتهت الجلسة، سجّل الدخول من جديد" });
  }
}

function authAdmin(req, res, next) {
  auth(req, res, () => {
    if ((req.userRow.role || "user") !== "admin")
      return res.status(403).json({ error: "هذه الصفحة للمدير فقط" });
    next();
  });
}

function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "30d" });
}

/* ---------- تسجيل الدخول / الحسابات ---------- */

app.post("/api/register", async (req, res) => {
  const { password, name } = req.body || {};
  const email = String(req.body?.email || "").toLowerCase().trim();
  if (!email || !password)
    return res.status(400).json({ error: "البريد وكلمة المرور مطلوبان" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
  if (password.length < 6)
    return res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });

  if (data.users.some((u) => u.email === email))
    return res.status(409).json({ error: "هذا البريد مسجل مسبقاً" });

  const user = {
    id: data.nextUserId++,
    email,
    password_hash: await bcrypt.hash(password, 10),
    name: (name || "").trim(),
    role: "user",
    subscription: null,
    free_usage: {},
    sub_used: 0,
    created_at: new Date().toISOString(),
  };
  data.users.push(user);
  save();

  res.json({
    token: signToken(user.id),
    user: publicUser(user),
    subscription: subscriptionInfo(user),
  });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = data.users.find(
    (u) => u.email === (email || "").toLowerCase().trim()
  );
  if (!user || !(await bcrypt.compare(password || "", user.password_hash)))
    return res.status(401).json({ error: "البريد أو كلمة المرور غير صحيحة" });

  res.json({
    token: signToken(user.id),
    user: publicUser(user),
    subscription: subscriptionInfo(user),
  });
});

app.get("/api/me", auth, (req, res) => {
  res.json({
    user: publicUser(req.userRow),
    subscription: subscriptionInfo(req.userRow),
  });
});

/* ---------- تسجيل الدخول عبر جوجل ---------- */

app.get("/api/auth/google-config", (req, res) => {
  res.json({ client_id: GOOGLE_CLIENT_ID || null });
});

app.post("/api/auth/google", async (req, res) => {
  const credential = req.body?.credential;
  if (!credential)
    return res.status(400).json({ error: "بيانات جوجل مفقودة" });
  if (!GOOGLE_CLIENT_ID)
    return res.status(500).json({ error: "تسجيل جوجل غير مفعّل على الخادم" });

  try {
    /* التحقق من صحة توكن جوجل مباشرة من خوادمهم */
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!r.ok)
      return res.status(401).json({ error: "فشل التحقق من حساب جوجل" });

    const info = await r.json();
    if (info.aud !== GOOGLE_CLIENT_ID)
      return res.status(401).json({ error: "معرّف التطبيق غير مطابق" });
    if (info.email_verified !== "true" && info.email_verified !== true)
      return res.status(401).json({ error: "بريد جوجل غير موثّق" });

    const email = String(info.email).toLowerCase().trim();
    let user = data.users.find((u) => u.email === email);
    if (!user) {
      user = {
        id: data.nextUserId++,
        email,
        password_hash: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10),
        name: info.name || "",
        role: "user",
        subscription: null,
        free_usage: {},
        sub_used: 0,
        provider: "google",
        created_at: new Date().toISOString(),
      };
      data.users.push(user);
      save();
    }

    res.json({
      token: signToken(user.id),
      user: publicUser(user),
      subscription: subscriptionInfo(user),
    });
  } catch (e) {
    console.error("Google auth error:", e);
    res.status(500).json({ error: "خطأ في تسجيل الدخول عبر جوجل" });
  }
});

/* ---------- التلخيص مع مراقبة الاشتراك ---------- */

app.post("/api/summarize", auth, async (req, res) => {
  const u = req.userRow;
  const info = subscriptionInfo(u);

  if (info.active && info.remaining !== "∞" && info.remaining <= 0)
    return res.status(402).json({
      error: `انتهت حصة ملخصات اشتراك "${info.plan_name}". تواصل مع المدير للتجديد.`,
      code: "QUOTA",
    });

  if (!info.active && info.remaining <= 0)
    return res.status(402).json({
      error: `انتهت حصتك المجانية (${FREE_MONTHLY_LIMIT} ملخصات شهرياً). اشترك للمتابعة!`,
      code: "QUOTA",
    });

  const { text, length = "medium", bullets = true } = req.body || {};
  if (!text || !text.trim())
    return res.status(400).json({ error: "نص الدرس مطلوب" });
  if (text.length > 60000)
    return res.status(400).json({ error: "النص طويل جداً (الحد 60 ألف حرف)" });
  if (!GROQ_API_KEY)
    return res.status(500).json({ error: "الخادم غير مهيأ: مفقود GROQ_API_KEY" });

  /* الموديل حسب الخطة: مجاني = ضعيف، وكل خطة أقوى */
  const info2 = subscriptionInfo(u);
  const usedModel =
    info2.active
      ? u.subscription.model || DEFAULT_MODEL
      : FREE_MODEL;

  const lengths = {
    short: "ملخص قصير جداً لا يتجاوز 5 نقاط أساسية",
    medium: "ملخص متوسط من 8 إلى 12 نقطة",
    detailed: "ملخص مفصل وشامل يغطي كل الأفكار المهمة",
  };
  const style = bullets
    ? `اكتب ${lengths[length] || lengths.medium} على شكل نقاط مرتبة، استخدم العناوين الغامقة عند الحاجة.`
    : `اكتب ${lengths[length] || lengths.medium} على شكل فقرات منظمة مع عناوين غامقة للأقسام الرئيسية.`;

  try {
    const r = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: usedModel,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "أنت مساعد متخصص في تلخيص الدروس التعليمية باللغة العربية. " +
              "أنتج ملخصات دقيقة ومنظمة وسهلة المراجعة قبل الاختبارات. " +
              "احتفظ بالمصطلحات العلمية المهمة كما هي. استخدم تنسيق ماركداون بسيط (**غامق** للعناوين). " +
              style,
          },
          { role: "user", content: `لخّص الدرس التالي:\n\n${text}` },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("Groq error:", r.status, errText.slice(0, 500));
      return res
        .status(502)
        .json({ error: `تعذر الاتصال بخدمة الذكاء الاصطناعي (${r.status})` });
    }

    const result = await r.json();
    let content = result.choices?.[0]?.message?.content?.trim() || "";
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!content)
      return res.status(502).json({ error: "لم يصل رد صالح من الخدمة" });

    /* خصم من الحصة بعد النجاح فقط */
    if (info.active && info.remaining !== "∞") {
      u.sub_used++;
      save();
    } else if (!info.active) {
      const mk = monthKey();
      u.free_usage[mk] = (u.free_usage[mk] || 0) + 1;
      save();
    }

    res.json({
      summary: content,
      model_used: usedModel,
      subscription: subscriptionInfo(u),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "حدث خطأ أثناء التلخيص، حاول مجدداً" });
  }
});

/* ---------- المكتبة لكل مستخدم ---------- */

app.get("/api/library", auth, (req, res) => {
  const items = data.library
    .filter((it) => it.user_id === req.user.id)
    .map(({ id, title, words, date }) => ({ id, title, words, date }))
    .reverse();
  res.json({ items });
});

app.post("/api/library", auth, (req, res) => {
  const { title, summary, lesson, words } = req.body || {};
  if (!summary) return res.status(400).json({ error: "الملخص مطلوب" });
  const item = {
    id: data.nextLibId++,
    user_id: req.user.id,
    title: title || "بدون عنوان",
    summary,
    lesson: lesson || "",
    words: Number(words) || 0,
    date: new Date().toISOString(),
  };
  data.library.push(item);
  save();
  res.json({ id: item.id });
});

app.get("/api/library/:id", auth, (req, res) => {
  const item = data.library.find(
    (it) => String(it.id) === req.params.id && it.user_id === req.user.id
  );
  if (!item) return res.status(404).json({ error: "العنصر غير موجود" });
  res.json({ item });
});

app.delete("/api/library/:id", auth, (req, res) => {
  const idx = data.library.findIndex(
    (it) => String(it.id) === req.params.id && it.user_id === req.user.id
  );
  if (idx === -1) return res.status(404).json({ error: "العنصر غير موجود" });
  data.library.splice(idx, 1);
  save();
  res.json({ ok: true });
});

/* ---------- الباقات وطلبات الاشتراك (للمستخدم) ---------- */

app.get("/api/plans", auth, (req, res) => {
  res.json({
    plans: data.plans.map(({ id, name, days, summaries, price, model }) => ({
      id, name, days, summaries, price, model,
    })),
  });
});

app.post("/api/requests", auth, (req, res) => {
  const plan = data.plans.find((p) => p.id === Number(req.body?.plan_id));
  if (!plan) return res.status(404).json({ error: "الخطة غير موجودة" });
  const dup = data.requests.find(
    (r) => r.user_id === req.user.id && r.status === "pending"
  );
  if (dup)
    return res.status(409).json({ error: "لديك طلب معلق بالفعل، انتظر مراجعة المدير" });
  data.requests.push({
    id: data.nextRequestId++,
    user_id: req.user.id,
    plan_id: plan.id,
    plan_name: plan.name,
    status: "pending",
    date: new Date().toISOString(),
  });
  save();
  res.json({ ok: true });
});

app.get("/api/requests", auth, (req, res) => {
  res.json({
    requests: data.requests
      .filter((r) => r.user_id === req.user.id)
      .sort((a, b) => b.id - a.id),
  });
});

/* ---------- إدارة الطلبات (للمدير) ---------- */

app.get("/api/admin/requests", authAdmin, (req, res) => {
  const pending = data.requests
    .filter((r) => r.status === "pending")
    .sort((a, b) => b.id - a.id)
    .map((r) => {
      const u = data.users.find((x) => x.id === r.user_id);
      return { ...r, user_email: u ? u.email : "محذوف" };
    });
  res.json({ requests: pending });
});

app.post("/api/admin/requests/:id/approve", authAdmin, (req, res) => {
  const request = data.requests.find((r) => r.id === Number(req.params.id));
  if (!request) return res.status(404).json({ error: "الطلب غير موجود" });
  const plan = data.plans.find((p) => p.id === request.plan_id);
  const target = data.users.find((u) => u.id === request.user_id);
  if (!plan || !target)
    return res.status(404).json({ error: "الخطة أو المستخدم غير موجود" });

  ensureFields(target);
  const now = new Date();
  const base =
    target.subscription && new Date(target.subscription.expires) > now
      ? new Date(target.subscription.expires)
      : now;
  const expires = new Date(base);
  expires.setDate(expires.getDate() + plan.days);
  target.subscription = {
    plan_id: plan.id,
    plan_name: plan.name,
    days: plan.days,
    summaries: plan.summaries,
    model: plan.model || DEFAULT_MODEL,
    starts: now.toISOString(),
    expires: expires.toISOString(),
  };
  target.sub_used = 0;
  request.status = "approved";
  save();
  res.json({ ok: true });
});

app.post("/api/admin/requests/:id/reject", authAdmin, (req, res) => {
  const request = data.requests.find((r) => r.id === Number(req.params.id));
  if (!request) return res.status(404).json({ error: "الطلب غير موجود" });
  request.status = "rejected";
  save();
  res.json({ ok: true });
});

/* ---------- إدارة الخطط والاشتراكات (للمدير) ---------- */

app.get("/api/admin/plans", authAdmin, (req, res) => res.json({ plans: data.plans }));

app.get("/api/admin/models", authAdmin, (req, res) =>
  res.json({ models: AVAILABLE_MODELS, free_model: FREE_MODEL })
);

app.post("/api/admin/plans", authAdmin, (req, res) => {
  const { name, days, summaries, price, model } = req.body || {};
  if (!name || !days)
    return res.status(400).json({ error: "اسم الخطة ومدتها مطلوبان" });
  const plan = {
    id: data.nextPlanId++,
    name: String(name).trim(),
    days: Math.max(1, Number(days) || 30),
    summaries: summaries === undefined ? -1 : Number(summaries),
    price: String(price ?? "").trim(),
    model: model && AVAILABLE_MODELS.some((m) => m.id === model)
      ? model
      : "openai/gpt-oss-20b",
  };
  data.plans.push(plan);
  save();
  res.json({ plan });
});

app.delete("/api/admin/plans/:id", authAdmin, (req, res) => {
  const idx = data.plans.findIndex((p) => String(p.id) === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "الخطة غير موجودة" });
  data.plans.splice(idx, 1);
  save();
  res.json({ ok: true });
});

app.post("/api/admin/users/:id/subscribe", authAdmin, (req, res) => {
  const target = data.users.find((x) => x.id === Number(req.params.id));
  if (!target) return res.status(404).json({ error: "المستخدم غير موجود" });
  const plan = data.plans.find((p) => p.id === Number(req.body?.plan_id));
  if (!plan) return res.status(404).json({ error: "الخطة غير موجودة" });

  ensureFields(target);
  const now = new Date();
  /* إذا كان مشتركاً بخطة نشطة نمدد من تاريخ الانتهاء، وإلا نبدأ الآن */
  const base =
    target.subscription && new Date(target.subscription.expires) > now
      ? new Date(target.subscription.expires)
      : now;
  const expires = new Date(base);
  expires.setDate(expires.getDate() + plan.days);

  target.subscription = {
    plan_id: plan.id,
    plan_name: plan.name,
    days: plan.days,
    summaries: plan.summaries,
    model: plan.model || DEFAULT_MODEL,
    starts: now.toISOString(),
    expires: expires.toISOString(),
  };
  target.sub_used = 0;
  save();
  res.json({ subscription: subscriptionInfo(target) });
});

app.post("/api/admin/users/:id/unsubscribe", authAdmin, (req, res) => {
  const target = data.users.find((x) => x.id === Number(req.params.id));
  if (!target) return res.status(404).json({ error: "المستخدم غير موجود" });
  ensureFields(target);
  target.subscription = null;
  target.sub_used = 0;
  save();
  res.json({ ok: true });
});

app.get("/api/admin/stats", authAdmin, (req, res) => {
  const activeSubs = data.users.filter(
    (u) =>
      u.subscription &&
      ensureFields(u) &&
      new Date(u.subscription.expires) > new Date()
  ).length;
  res.json({ users: data.users.length, lessons: data.library.length, activeSubs });
});

app.get("/api/admin/users", authAdmin, (req, res) => {
  const users = [...data.users]
    .sort((a, b) => b.id - a.id)
    .map((u) => ({
      ...publicUser(u),
      created_at: u.created_at,
      lessons: data.library.filter((it) => it.user_id === u.id).length,
      subscription: subscriptionInfo(u),
    }));
  res.json({ users });
});

app.delete("/api/admin/users/:id", authAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id)
    return res.status(400).json({ error: "لا يمكنك حذف حسابك بنفسك" });
  const idx = data.users.findIndex((u) => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "المستخدم غير موجود" });
  data.users.splice(idx, 1);
  data.library = data.library.filter((it) => it.user_id !== id);
  save();
  res.json({ ok: true });
});

app.patch("/api/admin/users/:id/role", authAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id)
    return res.status(400).json({ error: "لا يمكنك تغيير دورك بنفسك" });
  const user = data.users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
  user.role = user.role === "admin" ? "user" : "admin";
  save();
  res.json({ role: user.role });
});

/* ---------- الملفات الثابتة ---------- */
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`✓ الخادم يعمل: http://localhost:${PORT}`);
});
