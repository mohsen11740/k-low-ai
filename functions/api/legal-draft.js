const ALLOWED_ORIGINS = [
  "https://k-law.ir",
  "https://www.k-law.ir",
  "https://ai.k-law.ir",
  "http://localhost:5173",
  "http://localhost:3000",
];

function buildCorsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".k-law.ir"))) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  } else {
    // برای جلوگیری از مسدود شدن درخواست‌های درون‌برنامه‌ای
    headers["Access-Control-Allow-Origin"] = "*";
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

  try {
    if (!env.AI || typeof env.AI.run !== "function") {
      return json(
        { error: "Workers AI فعال نیست یا Binding آن در Cloudflare Pages تنظیم نشده است." },
        503,
        origin
      );
    }

    const body = await request.json().catch(() => ({}));

    // استخراج هوشمند ورودی‌ها (پشتیبانی از هر دو حالت فرم و فیلدهای مستقیم)
    const form = body.form && typeof body.form === "object" ? body.form : {};
    const context = body.context && typeof body.context === "object" ? body.context : {};
    const task = typeof body.task === "string" ? body.task.trim() : (body.subject ? "تنظیم پیش‌نویس سند قضایی" : "مشاوره حقوقی");

    const complainant = body.complainant || form.complainant || form.shaki || "";
    const accused = body.accused || form.accused || form.moshtaki || "";
    const subject = body.subject || form.subject || form.mozoo || "";
    const description = body.description || form.description || form.sharh || (typeof body.message === "string" ? body.message.trim() : "");
    const evidence = body.evidence || form.evidence || form.madarek || "";

    if (!description && !subject) {
      return json({ error: "متن درخواست، موضوع یا شرح واقعه کافی نیست." }, 400, origin);
    }

    if (description.length > 24000) {
      return json({ error: "متن درخواست بیش از حد طولانی است." }, 413, origin);
    }

    // --- SYSTEM PROMPT جامع و پیشرفته ---
    const system = `
شما «دستیار هوشمند حقوقی k-low | مشاوره و تنظیم اوراق قضایی دفتر حقوقی خانم کربلایی» هستید.
زبان پاسخ: فارسی رسمی، منقح، منطبق بر ادبیات دادگستری ایران، راست‌چین و با تیترها و نشانه‌گذاری واضح Markdown.

قواعد اساسی و قطعی:
۱) حوزه صلاحیت: قوانین و مقررات جمهوری اسلامی ایران.
۲) الزام استناد دقیق: هر ادعا یا راهکار را مستند به «نام قانون + شماره ماده + تبصره/بند» بیان کن (مانند: قانون روابط موجر و مستأجر مصوب ۱۳۷۶، قانون مدنی، قانون آیین دادرسی مدنی، قانون مجازات اسلامی و...).
۳) ممنوعیت جعل: هیچ ماده، تبصره یا رای وحدت رویه ساختگی ننویس. اگر شماره ماده را قطعی نمی‌دانی، صریحاً بگو «شماره ماده با قطعیت در حافظه نیست» و فقط نام قانون و اصل قاعده را بیاور.
۴) جایگذاری مستقیم اسامی (بسیار مهم): هرگز از کروشه و جای‌خالی‌های مجهول نظیر [نام شاکی]، [نام مشتکی‌عنه] یا [فلان] استفاده نکن! هر داده‌ای (نام اشخاص، مدارک و...) که کاربر وارد کرده را عینا در متن درج کن. فقط اطلاعاتی که کاربر واقعاً اعلام نکرده (مثل کد ملی یا نشانی دقیق) را با خط تیره (-) یا عبارت کوتاه درون پرانتز مشخص کن.
۵) تفکیک واقعیت و ادعا و شفافیت در مدارک اثباتی.

قالب پاسخ بسته به نوع خدمت:

حالت اول) اگر نوع خدمت «مشاوره حقوقی» بود:
■ ۱) خلاصه مسئله و فرض‌های مهم
■ ۲) تحلیل حقوقی (ماهیت دعوا/جرم/قرارداد و ارکان مسئولیت)
■ ۳) مواد قانونی و مستندات (لیست نام قانون + شماره ماده)
■ ۴) مراحل پیشنهادی اقدام (فوری، مذاکره، اظهارنامه، طرح دعوا، مرجع صالح و هزینه‌ها)
■ ۵) ادله و مدارک لازم برای اثبات
■ ۶) ریسک‌ها و نکات احتیاطی
■ ۷) مواعد قانونی و فوریت‌ها
■ ۸) سؤالات تکمیلی ضروری (حداکثر ۵ مورد)

حالت دوم) اگر نوع خدمت «سند/دادخواست/شکواییه/لایحه/اظهارنامه/پیش‌نویس» بود:
■ ۱) تشخیص ماهیت و تذکر قانونی:
   - اگر موضوع حقوقی/مدنی است (مثل روابط موجر و مستأجر، تخلیه، الزام به تنظیم سند، مطالبه وجه، چک حقوقی) ولی فرم شکواییه ثبت شده، با تیتر «⚠️ تذکر مهم ماهیت حقوقی» صریحاً توضیح بده که موضوع فاقد وصف کیفری است و مرجع رسیدگی شورای حل اختلاف یا دادگاه عمومی حقوقی است (نه دادسرا).
■ ۲) متن کامل و رسمی سند قضایی (دادخواست / شکواییه / اظهارنامه بر حسب ماهیت):
   - مشخصات دقیق خواهان/شاکی: نام واردشده توسط کاربر
   - مشخصات دقیق خوانده/مشتکی‌عنه: نام واردشده توسط کاربر
   - موضوع / خواسته
   - دلایل و منضمات
   - شرح ماجرا و متن دادخواهی با ادبیات فاخر و مستحکم حقوقی
■ ۳) مستندات قانونی دقیق (مواد و قوانین حاکم بر موضوع)
■ ۴) مرجع صالح رسیدگی و نحوه ثبت (دفاتر خدمات الکترونیک قضایی و...)
■ ۵) چک‌لیست اطلاعات و مدارک تکمیلی مورد نیاز
`;

    const userMessage = [
      `نوع درخواست/خدمت: ${task}`,
      `مشخصات ورودی کاربر:`,
      `- شاکی / خواهان: ${complainant || "ذکر نشده"}`,
      `- مشتکی‌عنه / خوانده: ${accused || "ذکر نشده"}`,
      `- موضوع اعلامی: ${subject || "ذکر نشده"}`,
      `- شرح واقعه: ${description}`,
      `- دلایل و مدارک: ${evidence || "ذکر نشده"}`,
      form && Object.keys(form).length > 0 ? `سایر اطلاعات فرم: ${safeJson(form)}` : "",
      context && Object.keys(context).length > 0 ? `زمینه تکمیلی: ${safeJson(context)}` : "",
    ].filter(Boolean).join("\n");

    const model = "@cf/meta/llama-3.1-8b-instruct";

    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: system.trim() },
        { role: "user", content: userMessage.trim() },
      ],
      max_tokens: 3200,
      temperature: 0.2,
    });

    const answer =
      result?.response ||
      result?.result?.response ||
      result?.choices?.[0]?.message?.content ||
      result?.draft;

    if (typeof answer !== "string" || !answer.trim()) {
      return json({ error: "مدل هوش مصنوعی پاسخ متنی برنگرداند." }, 502, origin);
    }

    // بازگرداندن پاسخ هم در فیلد draft و هم text تا هر دو فرمت فرانت‌اند شما بدون باگ کار کنند
    return json({ draft: answer.trim(), text: answer.trim() }, 200, origin);
  } catch (error) {
    const msg = (error && typeof error.message === "string") ? error.message : "";
    return json(
      {
        error: "در پردازش درخواست خطایی رخ داد. گزارش‌های Cloudflare Pages را بررسی کنید.",
        hint: msg ? `جزئیات: ${msg}` : undefined,
      },
      500,
      origin
    );
  }
}

function safeJson(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "{}";
  }
}
