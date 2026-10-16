
const ALLOWED_ORIGINS = [
  "https://k-law.ir",
  "https://www.k-law.ir",
  "https://ai.k-law.ir",
  "http://localhost:3000",
  "http://localhost:5173",
];

const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_INPUT_LENGTH = 24000;
const MAX_SEARCH_TERMS = 14;
const MAX_RELEVANT_ARTICLES = 8;

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
  if (typeof value === "number") return String(value);
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

  return String(value || "").replace(/[۰-۹٠-٩]/g, digit => {
    if (persian.includes(digit)) {
      return String(persian.indexOf(digit));
    }

    return String(arabic.indexOf(digit));
  });
}

function normalizeLegalText(value) {
  return normalizeDigits(String(value || ""))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200f\u202a-\u202e]/g, " ")
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

  if (
    text.includes("اظهارنامه") ||
    text.includes("notice")
  ) {
    return "اظهارنامه";
  }

  if (
    text.includes("دادخواست") ||
    text.includes("petition") ||
    text.includes("حقوقی")
  ) {
    return "دادخواست حقوقی";
  }

  return "پیش‌نویس قضایی";
}

function extractSearchTerms(query) {
  const normalized = normalizeLegalText(query);

  const stopWords = new Set([
    "این", "آن", "برای", "من", "شما", "ایشان",
    "است", "بود", "شد", "شود", "شده", "کرد",
    "کرده", "کنم", "کند", "باید", "میشود",
    "هستم", "دارم", "دارد", "درباره", "مورد",
    "موضوع", "لطفا", "قانون", "قانونی", "ماده",
    "مواد", "مرتبط", "میخواهم", "می‌خواهم",
    "شخص", "طرف", "داده", "خواهم", "کردن",
    "دارند", "پس", "چند", "بار", "هم", "اما",
    "باشد", "نیز", "بابت", "جهت", "خود",
  ]);

  const words =
    normalized.match(/[\u0600-\u06FF]{3,}|[0-9]{2,}/g) || [];

  return [
    ...new Set(
      words.filter(word => !stopWords.has(word))
    ),
  ].slice(0, MAX_SEARCH_TERMS);
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
    LIMIT 100
  `).bind(...params).all();

  const rows = result.results || [];

  function scoreArticle(article) {
    const keywords = normalizeLegalText(article.keywords);
    const lawName = normalizeLegalText(article.law_name);
    const articleText = normalizeLegalText(article.article_text);
    const articleNo = normalizeDigits(article.article_no);

    let score = 0;

    for (const term of terms) {
      if (keywords.includes(term)) score += 5;
      if (lawName.includes(term)) score += 2;
      if (articleText.includes(term)) score += 1;
      if (/^\d+$/.test(term) && articleNo === term) {
        score += 4;
      }
    }

    return score;
  }

  return rows
    .map(article => ({
      ...article,
      _score: scoreArticle(article),
    }))
    .filter(article => article._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_RELEVANT_ARTICLES)
    .map(({ _score, ...article }) => article);
}

function buildLegalContext(articles) {
  if (!articles.length) {
    return `
هیچ ماده قانونی مرتبطی در دیتابیس موجود پیدا نشد.

در این وضعیت:
- شماره ماده یا متن قانون را حدس نزن.
- رأی وحدت رویه، نظریه مشورتی یا بخشنامه نساز.
- پیش‌نویس را تا حد امکان بر اساس اطلاعات پرونده تنظیم کن.
- در بخش مستندات بنویس که مواد قانونی مرتبط باید از منبع رسمی بررسی شوند.
- فقدان منبع در دیتابیس را به معنای فقدان قانون مرتبط تلقی نکن.
`.trim();
  }

  return articles.map((article, index) => `
منبع بازیابی‌شده شماره ${index + 1}
نام قانون: ${article.law_name || "نامشخص"}
شماره ماده: ${article.article_no || "نامشخص"}
متن ثبت‌شده:
${article.article_text || "متن موجود نیست"}
وضعیت اعتبار ثبت‌شده:
${article.effective_status || "نامشخص"}
منبع:
${article.source_url || "نشانی ثبت نشده"}
`).join("\n\n");
}

function buildSystemPrompt(documentType, articles) {
  const legalContext = buildLegalContext(articles);

  return `
نقش شما:
دستیار تخصصی تنظیم پیش‌نویس اسناد و متون حقوقی ایران هستید.
متن باید حرفه‌ای، مستدل، منسجم و قابل بازبینی باشد.
شما وکیل پرونده نیستید، رأی قضایی صادر نمی‌کنید و نتیجه دعوا را تضمین نمی‌کنید.

نوع سند درخواستی:
${documentType}

قواعد اصلی:

۱. تحلیل حقوقی
- ابتدا ماهیت واقعی موضوع را از شرح وقایع تشخیص بده.
- میان دعوای حقوقی، اختلاف قراردادی و جرم تفاوت قائل شو.
- صرف پرداخت‌نشدن بدهی یا انجام‌نشدن تعهد را بدون دلیل کافی جرم تلقی نکن.
- مسیر حقوقی مناسب را با توجه به اطلاعات موجود بررسی کن.
- اگر اطلاعات برای نتیجه‌گیری قطعی کافی نیست، محدودیت را توضیح بده.

۲. حفظ اطلاعات پرونده
- نام اشخاص، نام شرکت‌ها، مبلغ، تاریخ و وقایع اعلام‌شده را تغییر نده.
- اطلاعات نامعلوم را جعل نکن.
- اطلاعات ضروری ناموجود را با عبارت «تکمیل شود» مشخص کن.
- اگر اطلاعات فرم با شرح کاربر تعارض دارد، تعارض را پنهان نکن.
- واحد پول را بدون اجازه کاربر تبدیل نکن.
- مدرک، قرارداد، اقرار، شاهد، ابلاغ یا سابقه قضایی جدید نساز.

۳. استناد به قانون
- یک بخش مستقل با عنوان «مواد قانونی و مبانی قانونی مرتبط» بنویس.
- ابتدا منابع بازیابی‌شده در انتهای این دستور را بررسی کن.
- فقط متن و شماره ماده‌ای را که در منبع موجود است به آن منبع نسبت بده.
- ارتباط واقعی هر ماده با دعوا را توضیح بده؛ صرف شباهت واژگان کافی نیست.
- اگر ماده‌ای ارتباطی با دعوا ندارد، آن را صرفاً برای افزایش تعداد استنادها ذکر نکن.
- وضعیت اعتبار ثبت‌شده را عیناً در نظر بگیر.
- وضعیت «نیازمند تطبیق نهایی» به معنی تأیید اعتبار جاری نیست؛ این محدودیت را اعلام کن.
- متن بازیابی‌شده را بدون بررسی، قانون قطعی و لازم‌الاجرا معرفی نکن.
- اگر ماده مرتبطی در منابع موجود نیست، شماره آن را از حافظه حدس نزن.
- نبود ماده در دیتابیس به معنای نبود قانون مرتبط نیست. توضیح بده که بررسی منبع رسمی و تکمیل بانک قوانین لازم است.
- قوانین خاص مرتبط با موضوع را از نظر تحلیلی در نظر بگیر، اما شماره مواد، آرای قضایی و نظریات مشورتی تأییدنشده نساز.
- اگر درباره صلاحیت مرجع رسیدگی اطلاعات کافی نداری، مرجع احتمالی و اطلاعات لازم برای تشخیص قطعی را مشخص کن.
- در دعاوی مطالبه وجه، اصل خواسته، خسارت دادرسی و خسارت تأخیر تأدیه را از هم تفکیک کن. مطالبه هرکدام باید مبنای قانونی و شرایط مربوط را داشته باشد.
- در صورت وجود منبع معتبر، نام قانون، شماره ماده، مضمون مرتبط و کاربرد آن در پرونده را بیاور.

۴. ساختار خروجی

پیش‌نویس برای بازبینی حقوقی

الف) تشخیص موضوع
نوع سند، ماهیت دعوا و مسیر حقوقی پیشنهادی را کوتاه توضیح بده.

ب) مشخصات طرفین
خواهان یا شاکی، خوانده یا مشتکی‌عنه و اطلاعات تکمیلی را درج کن.
اطلاعات نامعلوم را «تکمیل شود» بنویس.

ج) عنوان و خواسته
خواسته یا تقاضا را دقیق، روشن و متناسب با وقایع اعلام‌شده تنظیم کن.
از عبارت‌های مبهم مانند «دریافت پول» به‌تنهایی استفاده نکن؛ تا جایی که اطلاعات اجازه می‌دهد، نوع مطالبه را مشخص کن.

د) بهای خواسته
مبلغ اعلام‌شده، واحد پول و هر مورد نامعلوم را مشخص کن.
اگر مبلغ یا واحد آن روشن نیست، حدس نزن.

هـ) دلایل و منضمات
مدارک اعلام‌شده را درج کن.
مدارک احتمالی دیگر را فقط با قید «در صورت وجود» پیشنهاد بده.

و) شرح دادخواست یا متن سند
شرح را با زبان رسمی و روشن تنظیم کن.
وقایع را به ترتیب منطقی بیان کن.
تعهد، تخلف ادعایی، مطالبه انجام تعهد و نتیجه مورد درخواست را به هم مرتبط کن.
شرح کاربر را صرفاً تکرار نکن، اما هیچ واقعه جدیدی نساز.

ز) مواد قانونی و مبانی قانونی مرتبط
برای هر منبع قابل استفاده:
- نام قانون
- شماره ماده
- خلاصه دقیق مفاد مرتبط
- دلیل ارتباط ماده با موضوع
- وضعیت اعتبار و نیاز به تطبیق، در صورت وجود

اگر منبع کافی نیست، صریح و کوتاه اعلام کن که استناد دقیق نیازمند بررسی منبع رسمی است.

ح) خواسته یا تقاضای نهایی
یک متن رسمی و قابل استفاده تهیه کن که با اطلاعات پرونده و خواسته اعلام‌شده سازگار باشد.
خواسته جدید یا خسارت اثبات‌نشده اضافه نکن.

ط) مرجع صالح
مرجع احتمالی رسیدگی و دلیل انتخاب آن را بیان کن.
اگر اطلاعات لازم موجود نیست، موارد لازم برای تعیین صلاحیت را مشخص کن.
بدون بررسی صلاحیت، مرجع را قطعی اعلام نکن.

ی) موارد تکمیلی پیش از ثبت
فقط اطلاعات ضروری و ناموجود را فهرست کن.
از تکرار فهرست‌های عمومی و توصیه‌های بی‌ارتباط خودداری کن.

ک) تذکر بازبینی
یادآوری کن که مشخصات، مدارک، صلاحیت و اعتبار مواد قانونی باید پیش از ثبت با منابع معتبر و مقررات جاری تطبیق داده شوند.

۵. سبک نگارش
- فارسی رسمی، دقیق و قابل فهم.
- متن باید پیش‌نویس واقعی باشد، نه فقط راهنمای عمومی.
- از تکرار، حاشیه‌روی و فهرست‌سازی غیرضروری خودداری کن.
- هرجا داده کافی وجود دارد، متن را کامل بنویس.
- اگر اطلاعاتی نامعلوم است، آن را مشخص کن و کل پاسخ را به فهرست سؤال تبدیل نکن.
- بین تحلیل حقوقی و متن آماده ثبت تمایز قائل شو.

منابع بازیابی‌شده از دیتابیس:
${legalContext}
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
اطلاعات پرونده که کاربر ارائه کرده است:

نوع سند:
${documentType}

هدف:
${task || "تنظیم پیش‌نویس حقوقی"}

خواهان یا شاکی:
${person1 || "اعلام نشده است"}

خوانده یا مشتکی‌عنه:
${person2 || "اعلام نشده است"}

موضوع:
${subject || "اعلام نشده است"}

مبلغ:
${amount || "اعلام نشده است"}

تاریخ‌ها:
${date || "اعلام نشده است"}

محل:
${location || "اعلام نشده است"}

شرح واقعه:
${description || "شرح کافی ارائه نشده است"}

دلایل و مدارک:
${evidence || "اعلام نشده است"}

اطلاعات تکمیلی فرم:
${safeJson(form)}

دستور:
بر اساس همین اطلاعات و منابع قانونی بازیابی‌شده، پیش‌نویس حقوقی را مطابق ساختار تعیین‌شده تنظیم کن.
اطلاعات ناموجود را نساز و مواد قانونی را بدون منبع معتبر به پرونده نسبت نده.
`.trim();
}

function extractModelText(result) {
  if (typeof result === "string") return result;

  return firstText(
    result?.response,
    result?.output_text,
    result?.text,
    result?.answer
  ) || "";
}

function needsCitationCorrection(text, articles) {
  if (!articles.length) return false;

  const normalized = normalizeDigits(text);

  const hasArticleNumber =
    /(?:ماده|مواد|تبصره)\s*[0-9]+/.test(normalized);

  const hasLegalSection =
    /مواد قانونی و مبانی قانونی مرتبط|مبانی قانونی|مستندات قانونی/.test(
      text
    );

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
        { error: "اتصال Workers AI با نام AI تنظیم نشده است." },
        503,
        origin
      );
    }

    if (!env?.LEGAL_DB || typeof env.LEGAL_DB.prepare !== "function") {
      return jsonResponse(
        { error: "اتصال دیتابیس با نام LEGAL_DB برقرار نیست." },
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
        { error: "بدنه درخواست باید JSON معتبر باشد." },
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

    const documentType = normalizeDocumentType(
      firstText(
        body.documentType,
        body.document_type,
        body.type,
        body.kind,
        form.documentType,
        form.document_type,
        form.type
      )
    );

    const task = firstText(
      body.task,
      body.action,
      form.task,
      form.action
    );

    const person1 = firstText(
      body.person1,
      body.khahan,
      body.plaintiff,
      body.complainant,
      form.person1,
      form.khahan,
      form.plaintiff,
      form.complainant
    );

    const person2 = firstText(
      body.person2,
      body["خوانده"],
      body["خوانده_یا_مشتکی_عنه"],
      body.defendant,
      body.respondent,
      form.person2,
      form["خوانده"],
      form["خوانده_یا_مشتکی_عنه"],
      form.defendant,
      form.respondent
    );

    const subject = firstText(
      body.subject,
      body.title,
      body["موضوع"],
      form.subject,
      form.title,
      form["موضوع"]
    );

    const description = firstText(
      body.description,
      body.desc,
      body["متن"],
      body["شرح_ماجرا"],
      form.description,
      form.desc,
      form["متن"],
      form["شرح_ماجرا"]
    );

    const evidence = firstText(
      body.evidence,
      body["مدارک"],
      form.evidence,
      form["مدارک"]
    );

    const amount = firstText(
      body.amount,
      body.claimAmount,
      body.amountClaimed,
      body.value,
      body.baha,
      body.mablagh,
      form.amount,
      form.claimAmount,
      form.amountClaimed,
      form.value,
      form.baha,
      form.mablagh
    );

    const date = firstText(
      body.date,
      body.contractDate,
      body.dueDate,
      body.deadline,
      body.tarikh,
      form.date,
      form.contractDate,
      form.dueDate,
      form.deadline,
      form.tarikh
    );

    const location = firstText(
      body.location,
      body.city,
      body.address,
      body.place,
      body.mahal,
      form.location,
      form.city,
      form.address,
      form.place,
      form.mahal
    );

    if (!description && !subject && !task) {
      return jsonResponse(
        { error: "موضوع یا شرح واقعه ارائه نشده است." },
        400,
        origin
      );
    }

    if (
      description.length > MAX_INPUT_LENGTH ||
      subject.length > MAX_INPUT_LENGTH ||
      task.length > MAX_INPUT_LENGTH ||
      evidence.length > MAX_INPUT_LENGTH
    ) {
      return jsonResponse(
        { error: "یکی از بخش‌های ورودی بیش از حد طولانی است." },
        413,
        origin
      );
    }

    const searchQuery = [
      subject,
      task,
      description,
      evidence,
    ].filter(Boolean).join(" ");

    const relevantArticles = await findRelevantArticles(
      env.LEGAL_DB,
      searchQuery
    );

    const system = buildSystemPrompt(
      documentType,
      relevantArticles
    );

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
پاسخ قبلی ساختار استناد قانونی کافی ندارد.

پاسخ را بازنویسی کن و بخش «مواد قانونی و مبانی قانونی مرتبط» را اضافه کن.
فقط از منابع درج‌شده در پیام سیستم استفاده کن.
شماره یا متن ماده جدیدی نساز.
برای هر ماده، ارتباط آن با موضوع پرونده را توضیح بده.
وضعیت اعتبار ثبت‌شده را رعایت کن.
اگر ماده بازیابی‌شده با موضوع ارتباط واقعی ندارد، آن را استناد نکن.
اگر منبع کافی نیست، محدودیت را روشن بیان کن.
اطلاعات پرونده را تغییر نده و متن را به یک راهنمای عمومی تبدیل نکن.

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

      if (correctedText) {
        answerText = correctedText;
      }
    }

    return jsonResponse(
      {
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
      },
      200,
      origin
    );
  } catch (err) {
    console.error("legal-draft error:", err);

    return jsonResponse(
      {
        error: "خطای داخلی سرور در پردازش درخواست. لطفاً گزارش خطا را در Cloudflare بررسی کنید.",
      },
      500,
      origin
    );
  }
}
