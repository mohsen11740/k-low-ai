const AVALAI_URL = "https://api.avalai.ir/v1/chat/completions";
const AVALAI_MODEL = "qwen3.8-flash";

const SYSTEM_PROMPT = `
تو دستیار تخصصی نگارش حقوقی فارسی سامانه k-low هستی.

وظایف تو:
۱. درخواست کاربر را دقیق بفهم و آن را به فارسی رسمی، منسجم و حرفه‌ای تبدیل کن.
۲. در مشاوره حقوقی، موضوع، قواعد قابل استناد، شرایط اعمال قانون و راهکارهای احتمالی را توضیح بده.
۳. در تنظیم دادخواست، شکواییه، اظهارنامه، لایحه و نامه اداری، متن رسمی و قابل بازبینی تهیه کن.
۴. برای استناد قانونی، فقط از مواد ارائه‌شده در بخش «مواد بازیابی‌شده از بانک قوانین» استفاده کن.
۵. هرگز شماره ماده، نام قانون، رأی قضایی، شماره پرونده، تاریخ، مبلغ، نام شخص یا واقعه‌ای را جعل نکن.
۶. اگر منبع قانونی مرتبط بازیابی نشده است، ماده‌ای را از حافظه حدس نزن. در توضیحات تکمیلی اعلام کن که برای استناد دقیق‌تر باید منبع قانونی بررسی شود.
۷. اطلاعاتی را که کاربر نداده است، به متن اضافه نکن. جای خالی، کروشه، نام فرضی یا تاریخ فرضی نساز.
۸. اگر فیلدی خالی است، تا جایی که امکان دارد متن را بدون آن تنظیم کن. خالی بودن فیلد غیرضروری نباید مانع تولید متن شود.
۹. اظهارات کاربر را از واقعیت اثبات‌شده تفکیک کن. ادعای کاربر را بدون دلیل، واقعیت قطعی معرفی نکن.
۱۰. مبلغ، تاریخ، سمت اشخاص و شرح وقایع را تغییر نده. اگر اطلاعات متناقض‌اند، تناقض را در توضیحات تکمیلی مشخص کن.
۱۱. در تحلیل رأی یا دستور قضایی، فقط بر اساس متن ارائه‌شده تحلیل کن. قسمت‌های ناخوانا یا اطلاعات مفقود را حدس نزن.
۱۲. نشانی و شماره تلفن مراجع قضایی را بدون منبع معتبر ارائه نکن.
۱۳. توضیحات تکمیلی باید ساده، قابل فهم و جدا از متن رسمی باشد.

خروجی پاسخ‌های حقوقی را دقیقاً با این قالب بنویس:

[[متن نهایی]]
متن رسمی یا پاسخ حقوقی

[[توضیحات تکمیلی]]
شرح ساده نتیجه، نکات مهم، اطلاعات احتمالیِ موردنیاز و محدودیت منابع

بیرون از این دو بخش مقدمه یا توضیح اضافه ننویس.
`;

const REVISION_SYSTEM_PROMPT = `
تو ویراستار تخصصی متون حقوقی فارسی هستی.
پیش‌نویس قبلی را با توجه به اصلاحات صریح کاربر بازنویسی کن.
اطلاعات، مبالغ، تاریخ‌ها، نقش اشخاص و وقایع را تغییر نده، مگر کاربر صریحاً درخواست کرده باشد.
ماده قانونی یا واقعیت تازه نساز.
اگر اصلاح درخواستی با اطلاعات قبلی تعارض دارد، تعارض را در notes توضیح بده.
پاسخ را فقط به شکل JSON معتبر برگردان:
{"text":"متن کامل اصلاح‌شده","notes":"شرح کوتاه اصلاحات"}
`;

const CLASSIFY_SYSTEM_PROMPT = `
درخواست کاربر را در یکی از دسته‌های زیر قرار بده:
consult, notice, petition, complaint, brief, adminletter, tracking, judgment_analysis, request
فقط JSON معتبر برگردان:
{"service":"نام دسته","confidence":0.0,"reason":"دلیل کوتاه فارسی"}
هیچ متن دیگری ننویس.
`;

const CONNECTION_SYSTEM_PROMPT = "فقط همین جمله را برگردان: اتصال برقرار است.";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "k-low-ai",
        provider: "AvalAI",
        model: AVALAI_MODEL,
        legal_database_configured: Boolean(env.LEGAL_DB),
        api_key_configured: Boolean(env.AVALAI_API_KEY)
      });
    }

    if (url.pathname !== "/api/legal-draft") {
      return json({ error: "مسیر درخواست پیدا نشد." }, 404);
    }

    if (request.method !== "POST") {
      return json(
        { error: "روش درخواست پشتیبانی نمی‌شود." },
        405,
        { Allow: "POST, OPTIONS" }
      );
    }

    if (!env.AVALAI_API_KEY) {
      console.error("AVALAI_API_KEY is missing.");
      return json({
        error: "کلید اتصال هوش مصنوعی در تنظیمات سرور ثبت نشده است."
      }, 503);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "اطلاعات ارسالی معتبر نیست." }, 400);
    }

    const message = safeString(body?.message, 30000);
    const task = safeString(body?.task, 100) || "legal_draft";
    const form = isPlainObject(body?.form) ? body.form : {};
    const context = isPlainObject(body?.context) ? body.context : {};

    const previousDraft = safeString(
      body?.previous_draft || context.previous_draft,
      30000
    );

    const correctionNotes = safeString(
      body?.correction_notes || context.correction_notes,
      15000
    );

    if (!message.trim()) {
      return json({
        error: "لطفاً متن یا اطلاعات درخواست را وارد کنید."
      }, 400);
    }

    let legalSources = [];
    let sourceStatus = "not_requested";

    if (task !== "classify_service" && task !== "connection_test") {
      try {
        const retrieval = await searchLegalArticles(
          env.LEGAL_DB,
          task,
          form,
          context,
          message
        );

        legalSources = retrieval.sources;
        sourceStatus = retrieval.status;
      } catch (error) {
        console.error(
          "Legal database search failed:",
          error?.message || error
        );

        sourceStatus = "database_unavailable";
      }
    }

    const systemPrompt = chooseSystemPrompt(task);

    const userContent = buildUserContent({
      task,
      message,
      form,
      context,
      previousDraft,
      correctionNotes,
      legalSources,
      sourceStatus
    });

    try {
      const result = await callAvalAI(env.AVALAI_API_KEY, {
        model: AVALAI_MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userContent
          }
        ],
        max_tokens: task === "legal_revision_patch" ? 2600 : 3500,
        temperature: 0.2,
        stream: false
      });

      const answer = extractAnswer(result);

      if (!answer.trim()) {
        console.error(
          "AvalAI returned empty content:",
          JSON.stringify(result).slice(0, 1000)
        );

        return json({
          error: "پاسخ متنی از سرویس هوش مصنوعی دریافت نشد."
        }, 502);
      }

      return json({
        text: answer.trim(),
        answer: answer.trim(),
        legal_sources_count: legalSources.length,
        legal_source_status: sourceStatus
      });

    } catch (error) {
      const status = Number(error?.status) || 502;

      console.error(
        "AvalAI request failed:",
        status,
        error?.message || error
      );

      let errorMessage =
        "ارتباط با سرویس هوش مصنوعی برقرار نشد. لطفاً کمی بعد دوباره تلاش کنید.";

      if (status === 401 || status === 403) {
        errorMessage =
          "کلید یا دسترسی سرویس هوش مصنوعی معتبر نیست. تنظیمات کلید را بررسی کنید.";
      } else if (status === 429) {
        errorMessage =
          "درخواست‌های سرویس هوش مصنوعی موقتاً به سقف مجاز رسیده است. کمی بعد دوباره تلاش کنید.";
      } else if (status === 400) {
        errorMessage =
          "سرویس هوش مصنوعی درخواست را نپذیرفت. تنظیمات مدل یا اطلاعات درخواست را بررسی کنید.";
      }

      return json({
        error: errorMessage,
        status
      }, 502);
    }
  }
};

/* --------------------------------
   اتصال به AvalAI
-------------------------------- */

async function callAvalAI(apiKey, payload) {
  const response = await fetch(AVALAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");

    console.error(
      "AvalAI HTTP error:",
      response.status,
      errorBody.slice(0, 1000)
    );

    const error = new Error(`AvalAI HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

function extractAnswer(result) {
  const content = result?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(part => typeof part?.text === "string" ? part.text : "")
      .filter(Boolean)
      .join("\n");
  }

  if (typeof result?.output_text === "string") {
    return result.output_text;
  }

  return "";
}

function chooseSystemPrompt(task) {
  if (task === "connection_test") {
    return CONNECTION_SYSTEM_PROMPT;
  }

  if (task === "classify_service") {
    return CLASSIFY_SYSTEM_PROMPT;
  }

  if (task === "legal_revision_patch") {
    return REVISION_SYSTEM_PROMPT;
  }

  return SYSTEM_PROMPT;
}

/* --------------------------------
   آماده‌سازی اطلاعات درخواست
-------------------------------- */

function buildUserContent({
  task,
  message,
  form,
  context,
  previousDraft,
  correctionNotes,
  legalSources,
  sourceStatus
}) {
  const sections = [];

  sections.push(`نوع درخواست: ${task}`);
  sections.push(`شرح درخواست کاربر:\n${message}`);

  const cleanForm = removeEmptyValues(form);

  if (Object.keys(cleanForm).length > 0) {
    sections.push(
      `اطلاعات فرم اعلام‌شده از سوی کاربر:\n${safeJson(cleanForm)}`
    );
  }

  const cleanContext = removeEmptyValues({
    ...context,
    previous_draft: undefined,
    correction_notes: undefined
  });

  if (Object.keys(cleanContext).length > 0) {
    sections.push(`اطلاعات تکمیلی:\n${safeJson(cleanContext)}`);
  }

  if (previousDraft) {
    sections.push(`پیش‌نویس قبلی:\n${previousDraft}`);
  }

  if (correctionNotes) {
    sections.push(`اصلاحات درخواستی:\n${correctionNotes}`);
  }

  sections.push(buildSourceBlock(legalSources, sourceStatus));

  sections.push(`
دستورهای مهم:
- کاربر ممکن است محاوره‌ای، ناقص یا با غلط املایی بنویسد. منظور او را حفظ و متن را حرفه‌ای کن.
- فیلدهای خالی را مانع تولید متن ندان.
- اطلاعاتی که کاربر ارائه نکرده است نساز.
- در دادخواست، شکواییه، اظهارنامه و لایحه، ساختار حقوقی مناسب موضوع را رعایت کن.
- «بهای خواسته» را فقط وقتی درج کن که کاربر اعلام کرده یا برای موضوع ضروری است.
- فهرست ادله و پیوست‌ها را فقط از اطلاعات واقعی ارائه‌شده تنظیم کن.
- در نامه اداری، نام مرجع یا سازمان ناشناخته را حدس نزن.
- در تحلیل رأی قضایی، ابتدا نتیجه و دستور اصلی را توضیح بده، سپس آثار احتمالی و اقدامات بعدی را با تفکیک موارد قطعی از موارد احتمالی بیان کن.
- برای پاسخ حقوقی، استناد قانونی فقط زمانی مجاز است که ماده و نام قانون در منابع بازیابی‌شده وجود داشته باشند و واقعاً به موضوع مرتبط باشند.
- از بانک قوانین فقط مطالب مرتبط را انتخاب کن؛ وجود یک ماده در نتایج جست‌وجو به‌تنهایی به معنی ارتباط آن با موضوع نیست.
- اگر منبع قانونی کافی وجود ندارد، این موضوع را در توضیحات تکمیلی شفاف بیان کن.
- متن رسمی و توضیح ساده را با دو نشانه مشخص‌شده در دستور سیستم از هم جدا کن.
`);

  return sections.join("\n\n");
}

/* --------------------------------
   جست‌وجو در دیتابیس قوانین D1
-------------------------------- */

async function searchLegalArticles(
  db,
  task,
  form,
  context,
  message
) {
  if (!db || typeof db.prepare !== "function") {
    return {
      sources: [],
      status: "database_unavailable"
    };
  }

  const tableInfo = await db
    .prepare("PRAGMA table_info(legal_articles)")
    .all();

  const columns = Array.isArray(tableInfo?.results)
    ? tableInfo.results
    : [];

  if (columns.length === 0) {
    return {
      sources: [],
      status: "no_match"
    };
  }

  const columnNames = columns
    .map(column => String(column.name || ""))
    .filter(Boolean);

  const lowerMap = new Map(
    columnNames.map(name => [name.toLowerCase(), name])
  );

  const lawColumn = pickColumn(lowerMap, [
    "law_name",
    "law",
    "legal_name",
    "name_of_law",
    "title",
    "قانون",
    "نام_قانون"
  ]);

  const articleColumn = pickColumn(lowerMap, [
    "article_number",
    "article",
    "article_no",
    "number",
    "ماده",
    "شماره_ماده"
  ]);

  const textColumn = pickColumn(lowerMap, [
    "article_text",
    "text",
    "content",
    "body",
    "description",
    "متن",
    "متن_ماده"
  ]);

  if (!textColumn) {
    console.error("Could not identify legal article text column.");
    return {
      sources: [],
      status: "no_match"
    };
  }

  const inputText = [
    message,
    ...Object.values(form),
    ...Object.values(context)
  ]
    .map(value => {
      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }

      return "";
    })
    .join(" ");

  const terms = extractSearchTerms(inputText);

  if (terms.length === 0) {
    return {
      sources: [],
      status: "no_match"
    };
  }

  const searchableColumns = columnNames.filter(name =>
    /law|article|text|content|title|description|subject|keyword|قانون|ماده|متن|عنوان|موضوع|کلید/i.test(name)
  );

  if (!searchableColumns.includes(textColumn)) {
    searchableColumns.push(textColumn);
  }

  const expandedTerms = expandLegalSynonyms(terms).slice(0, 16);

  const conditions = [];
  const bindings = [];

  for (const term of expandedTerms) {
    for (const column of searchableColumns) {
      conditions.push(`${quoteIdentifier(column)} LIKE ?`);
      bindings.push(`%${escapeLike(term)}%`);
    }
  }

  if (conditions.length === 0) {
    return {
      sources: [],
      status: "no_match"
    };
  }

  const sql = `
    SELECT *
    FROM legal_articles
    WHERE ${conditions.join(" OR ")}
    LIMIT 100
  `;

  const queryResult = await db
    .prepare(sql)
    .bind(...bindings)
    .all();

  const rows = Array.isArray(queryResult?.results)
    ? queryResult.results
    : [];

  if (rows.length === 0) {
    return {
      sources: [],
      status: "no_match"
    };
  }

  const normalizedTerms = expandedTerms.map(normalizeText);

  const rankedRows = rows
    .map(row => {
      const searchableText = searchableColumns
        .map(column => String(row[column] ?? ""))
        .join(" ");

      const normalizedRow = normalizeText(searchableText);

      let score = 0;

      for (const term of normalizedTerms) {
        if (normalizedRow.includes(term)) {
          score += 3;
        }
      }

      if (lawColumn && row[lawColumn]) {
        score += 1;
      }

      if (articleColumn && row[articleColumn]) {
        score += 2;
      }

      if (textColumn && row[textColumn]) {
        score += 2;
      }

      return {
        row,
        score
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const sources = rankedRows
    .map(({ row }) => ({
      law_name: lawColumn
        ? safeString(row[lawColumn], 300)
        : "",
      article_number: articleColumn
        ? safeString(row[articleColumn], 100)
        : "",
      article_text: textColumn
        ? safeString(row[textColumn], 5000)
        : ""
    }))
    .filter(source => source.article_text.trim());

  return {
    sources,
    status: sources.length > 0 ? "matched" : "no_match"
  };
}

function buildSourceBlock(sources, status) {
  if (!sources || sources.length === 0) {
    let reason;

    if (status === "database_unavailable") {
      reason = "دسترسی به بانک قوانین برقرار نشد.";
    } else if (status === "no_match") {
      reason = "جست‌وجو در بانک قوانین ماده مرتبطی پیدا نکرد.";
    } else {
      reason = "منبع قانونی قابل استناد بازیابی نشده است.";
    }

    return `
مواد بازیابی‌شده از بانک قوانین:
${reason}
در این وضعیت شماره ماده یا نام قانون را حدس نزن.
`;
  }

  const sourceText = sources.map((source, index) => {
    return [
      `${index + 1}.`,
      `نام قانون: ${source.law_name || "در رکورد مشخص نشده"}`,
      `شماره ماده: ${source.article_number || "در رکورد مشخص نشده"}`,
      `متن ماده: ${source.article_text}`
    ].join("\n");
  });

  return `
مواد بازیابی‌شده از بانک قوانین:
${sourceText.join("\n\n")}

فقط مواد مرتبط با موضوع درخواست را انتخاب کن.
اگر ارتباط ماده با موضوع روشن نیست، به آن استناد نکن.
`;
}

/* --------------------------------
   استخراج و گسترش واژه‌های جست‌وجو
-------------------------------- */

function extractSearchTerms(value) {
  const normalized = normalizeText(value);

  const stopWords = new Set([
    "برای", "از", "به", "در", "با", "که", "این", "آن",
    "را", "و", "یا", "من", "ما", "شما", "ایشان", "است",
    "بود", "شد", "شود", "کرد", "کرده", "می", "یک", "هم",
    "اگر", "اما", "تا", "بر", "موضوع", "درخواست", "لطفا",
    "خواهشمند", "مبلغ", "تاریخ", "شماره", "حقوقی"
  ]);

  const tokens = normalized
    .split(/[^آ-یa-z0-9]+/i)
    .map(token => token.trim())
    .filter(token =>
      token.length >= 3 &&
      !stopWords.has(token)
    );

  const counts = new Map();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, 12);
}

function expandLegalSynonyms(terms) {
  const groups = [
    ["مهریه", "صداق", "سکه", "زوج", "زوجه", "نفقه"],
    ["اجرای", "احکام", "توقیف", "حساب", "حقوق", "مستثنیات"],
    ["چک", "صیاد", "دارنده", "صادرکننده", "گواهی", "پرداخت"],
    ["اجاره", "موجر", "مستاجر", "تخلیه", "ودیعه", "سرقفلی"],
    ["کارگر", "کارفرما", "دستمزد", "اخراج", "بیمه"],
    ["قرارداد", "تعهد", "فسخ", "خسارت", "وجه", "التزام"],
    ["کیفری", "شکایت", "شکواییه", "جرم", "مجازات", "متهم"],
    ["خانواده", "طلاق", "حضانت", "نفقه", "مهریه", "تمکین"],
    ["مالکیت", "ملک", "سند", "تصرف", "خلع", "ید"]
  ];

  const expanded = [...terms];

  for (const group of groups) {
    const matches = group.some(word =>
      terms.some(term =>
        term.includes(word) || word.includes(term)
      )
    );

    if (matches) {
      expanded.push(...group);
    }
  }

  return [...new Set(expanded)];
}

/* --------------------------------
   توابع کمکی
-------------------------------- */

function pickColumn(lowerMap, candidates) {
  for (const candidate of candidates) {
    const found = lowerMap.get(candidate.toLowerCase());

    if (found) {
      return found;
    }
  }

  const entries = [...lowerMap.entries()];

  for (const candidate of candidates) {
    const key = candidate.toLowerCase();

    const found = entries.find(([name]) =>
      name.includes(key)
    );

    if (found) {
      return found[1];
    }
  }

  return "";
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

function normalizeText(value) {
  return normalizeDigits(String(value || ""))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[ۀة]/g, "ه")
    .replace(/\u200c/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDigits(value) {
  return String(value || "")
    .replace(/[۰-۹]/g, digit =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    )
    .replace(/[٠-٩]/g, digit =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    );
}

function removeEmptyValues(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  const output = {};

  for (const [key, item] of Object.entries(value)) {
    if (item === null || item === undefined) {
      continue;
    }

    if (typeof item === "string" && !item.trim()) {
      continue;
    }

    if (Array.isArray(item) && item.length === 0) {
      continue;
    }

    if (
      isPlainObject(item) &&
      Object.keys(removeEmptyValues(item)).length === 0
    ) {
      continue;
    }

    output[key] = item;
  }

  return output;
}

function isPlainObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function safeString(value, maxLength = 10000) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, maxLength);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value).slice(0, maxLength);
  }

  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return "";
  }
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}
