const ALLOWED_ORIGINS = [
  // دامنه‌های مجاز را دقیق بگذار (پیشنهادی)
  "https://k-law.ir",
  "https://www.k-law.ir",
  "https://ai.k-law.ir",
  // برای تست لوکال:
  "http://localhost:5173",
  "http://localhost:3000",
];

function buildCorsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
  };

  // اگر Origin فرستاده شده و در لیست مجاز است، همان را برگردان
  // وگرنه، برای درخواست‌های بدون Origin (مثلاً curl/server-to-server) چیزی ست نکن.
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

function json(data, status = 200, origin = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: buildCorsHeaders(origin),
  });
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get("Origin");
  return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");

  // CORS + Origin policy
  // اگر Origin وجود دارد ولی مجاز نیست، 403
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "دسترسی از این دامنه مجاز نیست." }, 403, origin);
  }

  try {
    if (!env.AI || typeof env.AI.run !== "function") {
      return json(
        { error: "Workers AI فعال نیست یا Binding آن در Cloudflare Pages تنظیم نشده است." },
        503,
        origin
      );
    }

    const body = await request.json().catch(() => ({}));

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const task = typeof body.task === "string" ? body.task.trim() : "مشاوره حقوقی";
    const form = body.form && typeof body.form === "object" ? body.form : {};
    const context = body.context && typeof body.context === "object" ? body.context : {};

    if (message.length < 5) return json({ error: "متن درخواست کافی نیست." }, 400, origin);
    if (message.length > 24000) return json({ error: "متن درخواست بیش از حد طولانی است." }, 413, origin);

    // --- SYSTEM PROMPT (نسخه سخت‌گیرانه طبق خواسته شما) ---
    const system = `
شما «دستیار هوشمند حقوقی k-low | مشاوره حقوقی خانم کربلایی» هستید.
زبان پاسخ: فارسی رسمی، دقیق، منظم، با تیترهای واضح. خروجی باید راست‌چین‌پسند باشد (استفاده از تیتر و بولت).

قواعد قطعی:
1) حوزه: حقوق ایران (مگر کاربر صریحاً کشور دیگری تعیین کند).
2) الزام استناد: هر ادعای حقوقی مهم را فقط با استناد به «نام قانون + شماره ماده + در صورت امکان تبصره/بند» بیان کن.
   مثال قالب درست: «قانون مدنی، ماده ۱۰»، «قانون مجازات اسلامی، ماده ...»، «قانون آیین دادرسی مدنی، ماده ...».
3) ممنوعیت جعل: هیچ ماده قانونی/تبصره/رأی وحدت رویه/نظریه مشورتی/تاریخ/عدد را حدس نزن یا جعل نکن.
   اگر شماره ماده را دقیق به یاد نداری، صریح بگو: «شماره ماده را با قطعیت به یاد ندارم» و فقط نام قانون و قاعده کلی را بگو.
4) کلی‌گویی ممنوع: پاسخ نباید «کلی و مبهم» باشد. باید عملیاتی و قابل اقدام باشد.
5) تفکیک واقعیت/ادعا: گفته‌های کاربر را از مواردی که نیاز به اثبات دارد جدا کن.
6) اگر اطلاعات کلیدی کم است: در پایان «سؤالات تکمیلی ضروری» را کوتاه و دقیق لیست کن.
7) این سرویس جایگزین وکیل نیست؛ اما باید مشاوره را تا حد ممکن حرفه‌ای و کاربردی ارائه کند.

قالب اجباری خروجی بسته به نوع خدمت:

A) اگر نوع خدمت «مشاوره حقوقی» یا مشابه بود، دقیقاً با این بخش‌ها جواب بده:
■ ۱) خلاصه مسئله و فرض‌های مهم  
■ ۲) تحلیل حقوقی (ماهیت دعوا/جرم/رابطه قراردادی و ارکان)  
■ ۳) مواد قانونی و مستندات (لیست‌وار؛ نام قانون + شماره ماده/تبصره/بند. اگر مطمئن نیستی صریحاً بگو)  
■ ۴) مراحل پیشنهادی اقدام (گام‌به‌گام و اولویت‌بندی‌شده: فوری/مذاکره/اظهارنامه/شکایت یا دادخواست/مرجع صالح/هزینه‌ها به صورت کلی)  
■ ۵) ادله و مدارک لازم (قرارداد، پیام‌ها، شهود، رسید، گزارش، ... متناسب با پرونده)  
■ ۶) ریسک‌ها و نکات احتیاطی (مثلاً ایرادات شکلی، بار اثبات، احتمال رد دعوا، ...)  
■ ۷) مواعد مهم و فوریت‌ها (اگر احتمال مهلت قانونی هست، هشدار بده و بگو نیاز به بررسی دقیق تاریخ‌هاست)  
■ ۸) سؤالات تکمیلی ضروری (حداکثر ۵ سؤال، فقط موارد واقعاً لازم)

B) اگر نوع خدمت «سند/دادخواست/شکواییه/لایحه/اظهارنامه» بود:
- اول «چک‌لیست اطلاعات ناقص» را بده.
- سپس یک پیش‌نویس استاندارد و حرفه‌ای ارائه کن با جای‌خالی‌ها مثل [نام خواهان]، [کد ملی]، [نشانی]، [شرح دقیق تاریخ‌ها]، ...
- بخش‌های لازم: عنوان، مشخصات طرفین، مرجع صالح (اگر قابل تشخیص)، شرح ماجرا، دلایل و منضمات، مستندات قانونی (با همان قاعده عدم جعل)، خواسته/نتیجه‌گیری، امضاء/تاریخ.
`;

    // پیام کاربر را طوری بسازیم که مدل قاطی نکند و داده‌ها ساختاریافته باشد:
    const user = [
      `نوع خدمت: ${task}`,
      `اطلاعات فرم (JSON): ${safeJson(form)}`,
      `زمینه/کانتکست (JSON): ${safeJson(context)}`,
      `متن درخواست کاربر:`,
      message,
    ].join("\n");

    const model = "@cf/meta/llama-3.1-8b-instruct";

    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: system.trim() },
        { role: "user", content: user.trim() },
      ],
      // برای جواب‌های کامل‌تر
      max_tokens: 3000,
      temperature: 0.2,
    });

    const answer =
      result?.response ||
      result?.result?.response ||
      result?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      return json({ error: "مدل هوش مصنوعی پاسخ متنی برنگرداند." }, 502, origin);
    }

    return json({ text: answer.trim() }, 200, origin);
  } catch (error) {
    // پیام خطا را لو نمی‌دهیم، ولی برای دیباگ یک خلاصه می‌دهیم
    const msg = (error && typeof error.message === "string") ? error.message : "";
    return json(
      {
        error: "در پردازش درخواست خطایی رخ داد. گزارش‌های Cloudflare Pages/Workers AI را بررسی کنید.",
        hint: msg ? `جزئیات: ${msg}` : undefined,
      },
      500,
      origin
    );
  }
}

// جلوگیری از کرش در stringify
function safeJson(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "{}";
  }
}
