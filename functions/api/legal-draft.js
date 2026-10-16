const ALLOWED_ORIGINS = [
  "https://k-law.ir",
  "https://www.k-law.ir",
  "https://ai.k-law.ir",
  "http://localhost:3000",
  "http://localhost:5173",
];

const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_INPUT_LENGTH = 24000;
const MAX_RELEVANT_ARTICLES = 8;
const MAX_SEARCH_TERMS = 28;

function buildCorsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
}

function jsonResponse(data, status = 200, origin = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: buildCorsHeaders(origin),
  });
}

function textValue(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function firstText(...values) {
  for (const value of values) {
    const result = textValue(value);
    if (result) return result;
  }
  return "";
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function normalizeDigits(value) {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";

  return String(value ?? "").replace(/[۰-۹٠-٩]/g, digit => {
    const p = persian.indexOf(digit);
    if (p !== -1) return String(p);

    const a = arabic.indexOf(digit);
    if (a !== -1) return String(a);

    return digit;
  });
}

function normalizeLegalText(value) {
  return normalizeDigits(String(value ?? ""))
    .normalize("NFC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[\u200c\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/[ـ]/g, "")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeDocumentType(value) {
  const text = normalizeLegalText(value);

  if (
    text.includes("شکواییه") ||
    text.includes("شکایت کیفری") ||
    text.includes("کیفری") ||
    text.includes("complaint")
  ) {
    return "شکواییه کیفری";
  }

  if (text.includes("اظهارنامه") || text.includes("notice")) {
    return "اظهارنامه";
  }

  if (
    text.includes("دادخواست") ||
    text.includes("petition") ||
    text.includes("حقوقی")
  ) {
    return "دادخواست حقوقی";
  }

  if (text.includes("لایحه")) return "لایحه حقوقی";

  return "پیش‌نویس قضایی";
}

const LEGAL_SYNONYMS = {
  "قرض": ["بدهی", "دین", "مطالبه وجه", "استرداد وجه"],
  "قرضی": ["بدهی", "دین", "مطالبه وجه"],
  "بدهی": ["دین", "مطالبه وجه", "پرداخت دین"],
  "پول": ["وجه", "مطالبه وجه", "دین"],
  "پولم": ["وجه", "مطالبه وجه", "دین"],
  "طلب": ["مطالبه وجه", "دین", "طلبکار"],
  "طلبکار": ["مطالبه وجه", "دین"],
  "بدهکار": ["دین", "الزام به پرداخت"],
  "پس": ["استرداد وجه", "پرداخت دین"],
  "نداده": ["عدم پرداخت", "مطالبه وجه"],
  "نپرداخته": ["عدم پرداخت", "مطالبه وجه"],
  "پرداخت": ["ایفای تعهد", "وفای به عهد"],
  "قرارداد": ["تعهد", "الزام به ایفای تعهد"],
  "تعهد": ["الزام به ایفای تعهد", "مسئولیت قراردادی"],
  "خسارت": ["مسئولیت مدنی", "خسارت تاخیر تادیه"],
  "تاخیر": ["خسارت تاخیر تادیه"],
  "چک": ["قانون صدور چک", "مطالبه وجه چک"],
  "اجاره": ["اجاره بها", "قانون مدنی"],
  "فروش": ["بیع", "ثمن معامله", "الزام به پرداخت"],
  "معامله": ["قرارداد", "تعهد"],
  "ضمانت": ["ضمان", "مسئولیت"],
  "تصادف": ["مسئولیت مدنی", "خسارت"],
  "کارفرما": ["قرارداد کار", "مطالبات کارگری"],
  "حقوق": ["مطالبات مزدی", "قرارداد کار"],
};

function extractSearchTerms(query) {
  const normalized = normalizeLegalText(query);

  const stopWords = new Set([
    "این", "آن", "برای", "من", "شما", "ایشان",
    "است", "بود", "شد", "شود", "شده", "کرد",
    "کرده", "کنم", "کند", "باید", "هستم", "دارم",
    "دارد", "درباره", "مورد", "موضوع", "لطفا",
    "قانون", "قانونی", "ماده", "مواد", "مرتبط",
    "میخواهم", "شخص", "طرف", "داده", "خواهم",
    "کردن", "دارند", "چند", "بار", "هم", "اما",
    "باشد", "نیز", "بابت", "جهت", "خود", "میان",
    "توسط", "کردند", "شدهاند", "کردهاند", "از",
    "به", "با", "در", "و", "یا", "را", "که",
  ]);

  const words =
    normalized.match(/[\u0600-\u06FF]{2,}|[0-9]{1,}/g) || [];

  const expanded = new Set();

  for (const word of words) {
    if (!stopWords.has(word)) expanded.add(word);

    for (const [key, synonyms] of Object.entries(LEGAL_SYNONYMS)) {
      if (word === key || word.includes(key)) {
        for (const synonym of synonyms) {
          expanded.add(normalizeLegalText(synonym));
        }
      }
    }
  }

  return [...expanded]
    .filter(term => term && !stopWords.has(term))
    .slice(0, MAX_SEARCH_TERMS);
}

async function findRelevantArticles(db, query) {
  if (!db || typeof db.prepare !== "function") {
    throw new Error("اتصال دیتابیس قوانین در دسترس نیست.");
  }

  const terms = extractSearchTerms(query);
  if (!terms.length) return [];

  const conditions = terms.map(() =>
    "(keywords LIKE ? OR article_text LIKE ? OR law_name LIKE ? OR article_no = ?)"
  ).join(" OR ");

  const params = [];

  for (const term of terms) {
    const pattern = `%${term}%`;
    params.push(pattern, pattern, pattern, term);
  }

  const result = await db.prepare(`
    SELECT
      law_name,
      article_no,
      article_text,
      source_url,
      effective_status,
      keywords
    FROM legal_articles
    WHERE is_active = 1
      AND (${conditions})
    LIMIT 150
  `).bind(...params).all();

  const rows = result.results || [];

  function scoreArticle(article) {
    const keywords = normalizeLegalText(article.keywords);
    const lawName = normalizeLegalText(article.law_name);
    const articleText = normalizeLegalText(article.article_text);
    const articleNo = normalizeDigits(article.article_no).trim();

    let score = 0;

    for (const term of terms) {
      if (keywords.includes(term)) score += 6;
      if (lawName.includes(term)) score += 2;
      if (articleText.includes(term)) score += 1;

      if (/^\d+$/.test(term) && articleNo === term) {
        score += 8;
      }
    }

    if (!article.article_text?.trim()) score -= 5;

    return score;
  }

  const deduplicated = new Map();

  for (const article of rows) {
    const key = [
      normalizeLegalText(article.law_name),
      normalizeDigits(article.article_no).trim(),
    ].join("|");

    const score = scoreArticle(article);
    if (score <= 0) continue;

    const previous = deduplicated.get(key);

    if (!previous || score > previous._score) {
      deduplicated.set(key, { ...article, _score: score });
    }
  }

  return [...deduplicated.values()]
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_RELEVANT_ARTICLES)
    .map(({ _score, ...article }) => article);
}

function buildLegalContext(articles) {
  if (!articles.length) {
    return `
هیچ ماده‌ای در جست‌وجوی فعلی دیتابیس پیدا نشد.
این موضوع به معنای نبود قانون مرتبط نیست.
شماره ماده، متن قانون، رأی وحدت رویه یا نظریه مشورتی نساز.
در صورت امکان پیش‌نویس را با اطلاعات موجود تهیه کن و نیاز به بررسی منابع رسمی را صریحاً اعلام کن.
`.trim();
  }

  return articles.map((article, index) => `
منبع بازیابی‌شده ${index + 1}
نام قانون: ${article.law_name || "نامشخص"}
شماره ماده ثبت‌شده: ${article.article_no || "نامشخص"}
متن ثبت‌شده:
${article.article_text || "متن ثبت نشده"}
وضعیت اعتبار ثبت‌شده:
${article.effective_status || "نامشخص"}
نشانی منبع:
${article.source_url || "ثبت نشده"}
`).join("\n\n");
}

function buildSystemPrompt(documentType, articles) {
  return `
نقش:
دستیار تنظیم پیش‌نویس حقوقی ایران هستی. متن باید رسمی، دقیق، منسجم و قابل بازبینی باشد. وکیل پرونده نیستی و نتیجه دعوا را تضمین نمی‌کنی.

نوع سند:
${documentType}

قواعد الزامی:

۱. تحلیل موضوع
ماهیت حقوقی موضوع را تشخیص بده. صرف پرداخت‌نشدن بدهی را بدون دلایل کافی جرم تلقی نکن. مسیر حقوقی و کیفری را با هم مخلوط نکن.

۲. صحت اطلاعات
نام‌ها، شرکت‌ها، مبلغ، تاریخ و شرح وقایع را تغییر نده. هیچ قرارداد، رسید، شاهد، اقرار، ابلاغ یا واقعه‌ای نساز. اگر اطلاعات فرم با شرح کاربر تعارض دارد، آن را مشخص کن و فرض پنهانی نساز.

۳. استناد قانونی
فقط شماره و متن ماده‌ای را که در منابع زیر آمده به آن منبع نسبت بده.
هیچ شماره ماده، قانون، رأی قضایی یا نظریه مشورتی را جعل نکن.
هر ماده را فقط زمانی به عنوان مستند معرفی کن که ارتباط واقعی آن با موضوع روشن باشد.
وجود یک ماده در دیتابیس، به‌تنهایی اثبات‌کننده اعتبار جاری آن نیست.
اگر وضعیت ماده «نیازمند تطبیق نهایی» است، همین محدودیت را صریح اعلام کن.
اگر مواد بازیابی‌شده نامرتبط‌اند، آن‌ها را استناد نکن.
اگر ماده مناسبی در منابع وجود ندارد، توضیح بده که بانک قوانین برای این موضوع کافی نیست و باید منبع رسمی بررسی شود.
هرگز برای پرکردن بخش استنادات، یک ماده نامرتبط را وارد نکن.

۴. ساختار پاسخ
فقط یک خروجی نهایی بده. پیش‌نویس را با این ساختار تنظیم کن:

عنوان: پیش‌نویس برای بازبینی حقوقی

الف) تشخیص موضوع و مسیر حقوقی پیشنهادی
در چند جمله کوتاه.

ب) مشخصات طرفین
خواهان یا شاکی و خوانده یا مشتکی‌عنه. اطلاعات نامعلوم را «تکمیل شود» درج کن.

ج) خواسته یا موضوع سند
خواسته روشن و متناسب با اطلاعات کاربر. از عبارت مبهم «دریافت پول» به‌تنهایی استفاده نکن.

د) بهای خواسته
مبلغ و واحد پول را دقیقاً مطابق اطلاعات کاربر بنویس. اگر نامعلوم است، «تکمیل شود».

هـ) دلایل و منضمات
فقط مدارک اعلام‌شده را قطعی درج کن. مدارک دیگر را با عبارت «در صورت وجود» پیشنهاد بده.

و) شرح دادخواست یا متن سند
یک متن رسمی، منسجم و قابل بازبینی بنویس. وقایع را منطقی مرتب کن. شرح کاربر را عیناً تکرار نکن و هیچ واقعه‌ای نساز.

ز) مواد قانونی و مبانی مرتبط
برای هر ماده مرتبط و موجود، نام قانون، شماره ماده، مضمون ثبت‌شده و کاربرد آن در پرونده را ذکر کن. وضعیت اعتبار ثبت‌شده را هم اعلام کن. اگر منبع معتبر کافی نیست، صریحاً بنویس که استناد قطعی نیازمند تطبیق با منبع رسمی است.

ح) خواسته نهایی
یک عبارت رسمی و کوتاه، متناسب با اطلاعات پرونده.

ط) مرجع صالح
اگر اطلاعات لازم موجود است، مرجع احتمالی را با توضیح مبنای صلاحیت ذکر کن. اگر مبلغ، محل اقامت یا اطلاعات مؤثر نامعلوم است، از تعیین قطعی مرجع خودداری کن و فقط اطلاعات لازم را بخواه.

ی) موارد ضروری برای تکمیل
فقط اطلاعات واقعاً ضروری و ناموجود را فهرست کن. بخش‌های قبلی را تکرار نکن.

ک) تذکر بازبینی
تأکید کن که پیش از ثبت، مشخصات، مدارک، صلاحیت و اعتبار مواد قانونی بررسی شوند.

۵. سبک نگارش
از تکرار عنوان‌ها، خواسته‌ها و فهرست‌های چندباره خودداری کن.
متن را به راهنمای عمومی تبدیل نکن.
اگر اطلاعات کافی است، پیش‌نویس واقعی ارائه بده.
اگر اطلاعات ناقص است، فقط جای خالی‌های ضروری را مشخص کن.
بین تحلیل حقوقی و متن آماده ثبت تمایز بگذار.

منابع بازیابی‌شده از دیتابیس:
${buildLegalContext(articles)}
`.trim();
}

function buildUserPrompt({
  documentType,
  task,
  person1,
  person2,
  subject,
  description,
  evidence,
  amount,
  date,
  location,
  form,
}) {
  return `
اطلاعات اعلام‌شده از سوی کاربر:

نوع سند: ${documentType}
هدف: ${task || "تنظیم پیش‌نویس حقوقی"}
خواهان یا شاکی: ${person1 || "اعلام نشده"}
خوانده یا مشتکی‌عنه: ${person2 || "اعلام نشده"}
موضوع: ${subject || "اعلام نشده"}
مبلغ: ${amount || "اعلام نشده"}
تاریخ‌ها: ${date || "اعلام نشده"}
محل: ${location || "اعلام نشده"}
شرح واقعه: ${description || "ارائه نشده"}
دلایل و مدارک: ${evidence || "اعلام نشده"}
اطلاعات فرم: ${safeJson(form)}

دستور:
با اتکا به همین اطلاعات و منابع قانونی موجود، یک پیش‌نویس منسجم بنویس.
اطلاعات ناشناخته را جعل نکن.
نام و مبلغ و شرح واقعه را در تمام بخش‌ها یکسان نگه دار.
مواد قانونی را فقط در صورت وجود منبع مناسب ذکر کن.
`.trim();
}

function extractModelText(result) {
  if (typeof result === "string") return result;

  return firstText(
    result?.response,
    result?.output_text,
    result?.text,
    result?.answer
  );
}

function needsCitationCorrection(text, articles) {
  if (!articles.length) return false;

  const normalized = normalizeDigits(text);
  const hasArticleNumber =
    /(?:ماده|مواد|تبصره)\s*[0-9]+/.test(normalized);

  const hasLegalSection =
    /مواد قانونی و مبانی مرتبط|مواد قانونی|مبانی قانونی/.test(text);

  return !hasArticleNumber || !hasLegalSection;
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get("Origin");

  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");

  try {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse(
        { error: "مبدأ درخواست مجاز نیست." },
        403,
        null
      );
    }

    if (!env?.AI || typeof env.AI.run !== "function") {
      return jsonResponse(
        { error: "اتصال هوش مصنوعی با نام AI تنظیم نشده است." },
        503,
        origin
      );
    }

    if (!env?.LEGAL_DB || typeof env.LEGAL_DB.prepare !== "function") {
      return jsonResponse(
        { error: "اتصال پایگاه قوانین با نام LEGAL_DB برقرار نیست." },
        503,
        origin
      );
    }

    const contentLength =
      Number(request.headers.get("Content-Length")) || 0;

    if (contentLength > 1000000) {
      return jsonResponse(
        { error: "حجم درخواست بیش از حد مجاز است." },
        413,
        origin
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(
        { error: "بدنه درخواست باید یک شیء JSON معتبر باشد." },
        400,
        origin
      );
    }

    const bodyForm =
      body.form && typeof body.form === "object" && !Array.isArray(body.form)
        ? body.form
        : {};

    const bodyData =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? body.data
        : {};

    const form = { ...bodyData, ...bodyForm };

    const documentType = normalizeDocumentType(firstText(
      body.documentType,
      body.document_type,
      body.type,
      body.kind,
      form.documentType,
      form.document_type,
      form.type
    ));

    const task = firstText(
      body.task, body.action, form.task, form.action
    );

    const person1 = firstText(
      body.person1, body.khahan, body.plaintiff, body.complainant,
      form.person1, form.khahan, form.plaintiff, form.complainant
    );

    const person2 = firstText(
      body.person2, body["خوانده"], body["خوانده_یا_مشتکی_عنه"],
      body.defendant, body.respondent,
      form.person2, form["خوانده"], form["خوانده_یا_مشتکی_عنه"],
      form.defendant, form.respondent
    );

    const subject = firstText(
      body.subject, body.title, body["موضوع"],
      form.subject, form.title, form["موضوع"]
    );

    const description = firstText(
      body.description, body.desc, body["متن"], body["شرح_ماجرا"],
      form.description, form.desc, form["متن"], form["شرح_ماجرا"]
    );

    const evidence = firstText(
      body.evidence, body["مدارک"], form.evidence, form["مدارک"]
    );

    const amount = firstText(
      body.amount, body.claimAmount, body.amountClaimed,
      body.value, body.baha, body.mablagh,
      form.amount, form.claimAmount, form.amountClaimed,
      form.value, form.baha, form.mablagh
    );

    const date = firstText(
      body.date, body.contractDate, body.dueDate,
      body.deadline, body.tarikh,
      form.date, form.contractDate, form.dueDate,
      form.deadline, form.tarikh
    );

    const location = firstText(
      body.location, body.city, body.address, body.place, body.mahal,
      form.location, form.city, form.address, form.place, form.mahal
    );

    if (!description && !subject && !task) {
      return jsonResponse(
        { error: "لطفاً موضوع یا شرح واقعه را وارد کنید." },
        400,
        origin
      );
    }

    for (const value of [description, subject, task, evidence, amount]) {
      if (value.length > MAX_INPUT_LENGTH) {
        return jsonResponse(
          { error: "یکی از بخش‌های ورودی بیش از حد طولانی است." },
          413,
          origin
        );
      }
    }

    const searchQuery = [
      subject, task, description, evidence,
    ].filter(Boolean).join(" ");

    const relevantArticles = await findRelevantArticles(
      env.LEGAL_DB,
      searchQuery
    );

    const system = buildSystemPrompt(documentType, relevantArticles);

    const userPrompt = buildUserPrompt({
      documentType,
      task,
      person1,
      person2,
      subject,
      description,
      evidence,
      amount,
      date,
      location,
      form,
    });

    const answer = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });

    let answerText = extractModelText(answer);

    if (!answerText) {
      throw new Error("مدل هوش مصنوعی پاسخ متنی تولید نکرد.");
    }

    if (needsCitationCorrection(answerText, relevantArticles)) {
      const correctionPrompt = `
پاسخ زیر را یک بار بازنویسی کن تا ساختار حقوقی کامل و منسجم داشته باشد.
بخش «مواد قانونی و مبانی مرتبط» را در صورت وجود منابع مرتبط کامل کن.
فقط از منابع درج‌شده در پیام سیستم استفاده کن.
شماره یا متن ماده جدید نساز.
مواد نامرتبط را صرفاً برای افزودن استناد وارد نکن.
اطلاعات پرونده را تغییر نده.
تکرارها و توضیحات عمومی غیرضروری را حذف کن.
اگر منابع برای استناد کافی نیستند، این محدودیت را صریح بیان کن.

پاسخ قبلی:
${answerText}

اطلاعات پرونده:
${userPrompt}
`.trim();

      const corrected = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: correctionPrompt },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      });

      const correctedText = extractModelText(corrected);
      if (correctedText) answerText = correctedText;
    }

    return jsonResponse({
      success: true,
      documentType,
      text: answerText,
      answer: answerText,
      draft: answerText,
      legalSourcesFound: relevantArticles.length,
      legalSources: relevantArticles.map(article => ({
        lawName: article.law_name,
        articleNo: article.article_no,
        sourceUrl: article.source_url,
        status: article.effective_status,
      })),
    }, 200, origin);
  } catch (err) {
    console.error("legal-draft error:", err);

    return jsonResponse({
      error: "پردازش درخواست ناموفق بود. اتصال‌ها و گزارش خطای Cloudflare را بررسی کنید.",
    }, 500, origin);
  }
}
