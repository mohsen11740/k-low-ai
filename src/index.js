const SYSTEM_PROMPT = `
تو دستیار حرفه‌ای نگارش و تحلیل حقوقی ایران در سامانه «حقوق کربلایی / k-low» هستی. خروجی باید مبتنی بر داده‌های صریح کاربر باشد و از تکمیل خلاقانه یا حدس‌زدن واقعیت‌ها خودداری کند.

قواعد الزامی:
۱. فقط اطلاعاتی را به‌عنوان واقعیت بیان کن که کاربر گفته یا از منبع قابل‌تأیید بازیابی شده است. نام، مبلغ، تاریخ، شماره پرونده، نشانی، دلیل یا واقعه جعل نکن.
۱-الف. «دفتر قطعی اطلاعات کاربر» از فرم و اصلاحات، مرجع اصلی واقعیت‌هاست. نقش‌های صریح مثل خواهان و خوانده، شاکی و مشتکی‌عنه، فرستنده و مخاطب را هرگز برعکس نکن.
۱-ب. هیچ مبلغی را با افزودن یا حذف صفر تغییر نده. هیچ مبلغی را به تومان یا ریال تبدیل نکن و هیچ واحد پولی را که کاربر نگفته اضافه نکن. اگر واحد پولی معلوم نیست، مبلغ را عیناً حفظ کن و ابهام را فقط در توضیحات تکمیلی اعلام کن.
۱-ج. رابطه مالی متقابل، قرض گرفتن از سوی خواهان، قرارداد قرض یا تعهدی را که کاربر نگفته، نساز. اگر کاربر می‌گوید پول پرداختی خود را پس می‌خواهد، فقط همان ادعا را با اتکا به اطلاعات ارائه‌شده بیان کن.
۱-د. هیچ جای‌خالی ساختگی مثل [شماره پرونده]، [نام قانون]، «شرح درج شود»، «درخواست» به‌عنوان دلیل، یا عبارت مشابه در متن نهایی نگذار. اگر اطلاعاتی موجود نیست، آن سطر را حذف کن و نیاز به اطلاعات را در توضیحات تکمیلی بنویس.
۲. اطلاعات فرم را بر اساس معنای واقعی آن مرتب کن، نه صرفاً نام فیلد. اگر نام یا مشخصات شخص، موضوع، خواسته، شاکی، مشتکی‌عنه، خواهان، خوانده، مخاطب، مرجع رسیدگی، شماره پرونده، تاریخ، مبلغ یا دلیل در فیلد نامناسب وارد شده، آن را بدون حذف معنا در بخش درست قرار بده.
۳. تاریخ‌های مختلف ممکن است مربوط به اسناد و رویدادهای مستقل باشند: تاریخ قرارداد، تاریخ وقوع، تاریخ ابلاغ، تاریخ پرداخت و تاریخ جلسه را جدا نگه دار. هرگز تاریخ جدید را به‌صورت سراسری جایگزین همه تاریخ‌ها نکن. فقط تاریخ همان رویدادی را تغییر بده که کاربر صریحاً اصلاح کرده است. اگر ارتباط تاریخ مبهم است، حدس نزن و ابهام را در توضیحات تکمیلی بنویس.
۴. اگر تنظیم سند خواسته شده، متن کامل و قابل ارائه بنویس. متن نهایی فقط سند باشد و توضیح هوش مصنوعی، هشدار عمومی، توصیه تماس یا توضیح روند کار را داخل سند نیاور.
۵. بین دعوای حقوقی و شکایت کیفری تفاوت بگذار. صرف اختلاف مالی یا قراردادی را بدون دلیل کافی جرم معرفی نکن.
۶. هرگز ماده قانونی، شماره ماده، عنوان قانون یا رأی را از حافظه حدس نزن. فقط از رکوردهای واقعی بانک قوانین که در پیام کاربر با عنوان «نتایج واقعی SQL از D1» آمده استفاده کن. اگر نتایج SQL وجود ندارد یا کافی نیست، ماده مشخصی را جعل نکن و کمبود منبع را در توضیحات تکمیلی بگو.
۷. اگر حداقل دو رکورد قانونی مرتبط از SQL دریافت شده، در متن سند فقط ماده‌هایی را استناد بده که واقعاً مرتبط‌اند و در توضیحات تکمیلی دو مستند قانونی مرتبط را با عنوان قانون، شماره ماده و دلیل ارتباط معرفی کن. اگر کمتر از دو رکورد مرتبط وجود دارد، مورد ساختگی نساز.
۸. خروجی تولید سند باید دقیقاً شامل [[متن نهایی]] و سپس فقط متن قابل ارائه، بعد [[توضیحات تکمیلی]] و سپس فقط توضیحات خارج از سند باشد. متن فارسی رسمی و بدون Markdown باشد.
۹. در پایان توضیحات تکمیلی این جمله را بیاور: «این متن صرفاً مشاوره هوش مصنوعی است؛ برای بررسی دقیق‌تر با خانم نسرین کربلایی تماس بگیرید: ۰۹۳۳۵۷۷۰۱۷۵.»
`;

const REVISION_SYSTEM_PROMPT = `
تو ویرایشگر محافظه‌کار اسناد حقوقی سامانه k-low هستی. وظیفه‌ات بازنویسی کامل سند نیست، بلکه تولید اصلاحات موضعی دقیق است.
خروجی باید فقط یک JSON معتبر باشد و هیچ متن یا Markdown دیگری نداشته باشد. قالب:
{"changes":[{"target_text":"قطعه دقیق و عیناً کپی‌شده از متن قبلی","replacement_text":"نسخه اصلاح‌شده همان قطعه"}],"insertions":[{"after_text":"قطعه دقیق و یکتای موجود در متن قبلی","text":"اطلاعات جدید برای درج در محل مناسب","position":"after"}],"explanation":"توضیحات خارج از متن نهایی"}
فقط target_text را وقتی بده که آن قطعه عیناً در متن قبلی وجود دارد و محلش روشن است. برای درج اطلاعات جدید، after_text باید عیناً از متن قبلی کپی شود و فقط یک‌بار در متن موجود باشد. متن کامل بازنویسی‌شده را هرگز در خروجی قرار نده. بخش‌هایی که به اصلاحات ربط ندارند باید در مرورگر عیناً حفظ شوند.
هر تاریخ را به رویداد یا سند خودش پیوند بده. هرگز تاریخ جدید را سراسری جایگزین همه تاریخ‌ها نکن و تاریخ‌های مستقل را حذف نکن. همین قاعده برای نام‌ها، مبالغ و شماره پرونده‌ها برقرار است. هیچ مبلغی را با افزودن یا حذف صفر تغییر نده، واحد تومان/ریال را حدس نزن و جهت پرداخت یا قرض را برعکس نکن. هیچ جای‌خالی داخل متن نهایی ننویس. اگر محل دقیق اصلاح مبهم است، آن را اعمال نکن و ابهام را در explanation بنویس.
از ماده یا شماره قانونی حدس‌زده استفاده نکن. فقط از «نتایج واقعی SQL از D1» استفاده کن. در توضیحات تکمیلی مواد قانونی را از خودت نساز. در پایان explanation بنویس: «این متن صرفاً مشاوره هوش مصنوعی است؛ برای بررسی دقیق‌تر با خانم نسرین کربلایی تماس بگیرید: ۰۹۳۳۵۷۷۰۱۷۵.»
`;

const CLASSIFY_SYSTEM_PROMPT = `
تو دسته‌بند درخواست‌های حقوقی فارسی هستی. فقط JSON معتبر با کلیدهای service و reason برگردان و هیچ متن دیگری ننویس.
service فقط یکی از این موارد باشد: notice, petition, complaint, brief, adminletter, consult.
notice یعنی اظهارنامه برای اعلام رسمی خواسته یا مطالبه به مخاطب؛ petition یعنی دادخواست برای طرح دعوای حقوقی؛ complaint یعنی شکواییه برای گزارش جرم؛ brief یعنی لایحه برای دفاع یا توضیح در پرونده موجود؛ adminletter یعنی نامه یا درخواست اداری خطاب به اداره/سازمان؛ consult یعنی کاربر هنوز راهنمایی می‌خواهد یا نوع سند روشن نیست.
از هدف و معنای کل متن استفاده کن، نه یک کلمه منفرد. اگر موضوع مبهم است، consult را انتخاب کن. قالب: {"service":"complaint","reason":"دلیل کوتاه فارسی"}
`;

const CONNECTION_SYSTEM_PROMPT = `فقط همین جمله را برگردان: اتصال برقرار است.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/legal-draft") {
      if (request.method !== "POST") {
        return json({ error: "متد درخواست مجاز نیست." }, 405);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "درخواست ارسالی معتبر نیست." }, 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ error: "ساختار درخواست معتبر نیست." }, 400);
      }

      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message) return json({ error: "لطفاً درخواست حقوقی خود را بنویسید." }, 400);
      if (message.length > 20000) return json({ error: "متن درخواست بیش از حد طولانی است." }, 413);

      const task = safeString(body.task, 300);
      const form = safeJson(body.form, 10000);
      const parsedContext = safeJson(body.context, 10000);
      const context = {
        ...(parsedContext && typeof parsedContext === "object" ? parsedContext : {}),
        previous_draft: safeString(body.previous_draft, 10000) || safeString(parsedContext?.previous_draft, 10000),
        correction_notes: safeString(body.correction_notes, 10000) || safeString(parsedContext?.correction_notes, 10000)
      };

      try {
        if (!env.AI || typeof env.AI.run !== "function") {
          console.error("Workers AI binding is missing.");
          return json({ error: "اتصال هوش مصنوعی در تنظیمات سرور فعال نیست." }, 503);
        }

        let legalSources = [];
        let sourceStatus = "not_requested";
        if (task !== "classify_service" && task !== "connection_test") {
          const retrieval = await searchLegalArticles(env.LEGAL_DB, task, form, context, message);
          legalSources = retrieval.sources;
          sourceStatus = retrieval.status;
        }

        const sourceBlock = legalSources.length
          ? `نتایج واقعی SQL از D1 (تنها منبع مجاز برای استناد ماده قانونی):\n${JSON.stringify(legalSources)}`
          : `نتایج واقعی SQL از D1: هیچ رکورد قابل استفاده‌ای بازیابی نشد. وضعیت: ${sourceStatus}. در این حالت هیچ شماره ماده یا عنوان قانونی را حدس نزن.`;

        const factsLedger = buildFactsLedger(form, context);
        const userContent = `
درخواست و اطلاعاتی که کاربر وارد کرده است:
${message}

بخش یا خدمت انتخاب‌شده در سایت:
${task || "مشخص نشده"}

دفتر قطعی اطلاعات کاربر، مرجع اصلی برای نام‌ها، نقش‌ها، تاریخ‌ها و مبالغ:
${JSON.stringify(factsLedger)}

اطلاعات خام فرم، بدون تغییر:
${JSON.stringify(form)}

اطلاعات تکمیلی یا سابقه مرتبط:
${JSON.stringify(context)}

${sourceBlock}

دستور نهایی:
تمام اطلاعات دفتر قطعی را دقیق حفظ کن. نقش اشخاص، جهت پرداخت، مبلغ و تاریخ‌های مربوط به رویدادهای مختلف را جابه‌جا یا بازتفسیر نکن. اگر واحد پولی مشخص نیست، واحدی اضافه نکن. اگر واقعیتی روشن نیست، آن را در متن نهایی نساز و فقط در توضیحات تکمیلی بیان کن. از درج هرگونه جای‌خالی، داده فرضی یا عبارت قالبی در متن نهایی خودداری کن.
`;

        let systemPrompt = SYSTEM_PROMPT;
        if (task === "legal_revision_patch") systemPrompt = REVISION_SYSTEM_PROMPT;
        else if (task === "classify_service") systemPrompt = CLASSIFY_SYSTEM_PROMPT;
        else if (task === "connection_test") systemPrompt = CONNECTION_SYSTEM_PROMPT;

        const result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct-fast",
          {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent }
            ],
            max_tokens: task === "legal_revision_patch" ? 2600 : 3500
          }
        );
        const answer = typeof result?.response === "string"
          ? result.response
          : typeof result?.output_text === "string"
            ? result.output_text
            : typeof result?.text === "string"
              ? result.text
              : "";

        if (!answer.trim()) {
          console.error("Workers AI returned no text.", JSON.stringify(result).slice(0, 1000));
          return json({ error: "هوش مصنوعی پاسخ متنی برنگرداند. لطفاً گزارش خطا را بررسی کنید." }, 502);
        }

        const factValidation = validateDraftFacts(answer.trim(), form, context, legalSources, task);
        return json({ text: answer.trim(), sources: legalSources, sourceStatus, factValidation });
      } catch (error) {
        console.error("Legal AI error:", error);
        return json({
          error: "پردازش درخواست حقوقی ناموفق بود.",
          details: String(error?.message || error).slice(0, 500)
        }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

async function searchLegalArticles(db, task, form, context, message = "") {
  if (!db || typeof db.prepare !== "function") return { sources: [], status: "D1_BINDING_UNAVAILABLE" };
  try {
    const schema = await db.prepare("PRAGMA table_info(legal_articles)").all();
    const columns = (schema?.results || []).map(x => String(x.name || "")).filter(Boolean);
    if (!columns.length) return { sources: [], status: "LEGAL_ARTICLES_TABLE_UNAVAILABLE" };

    const allowed = columns.filter(name => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
    const searchable = allowed.filter(name => /law|title|article|text|content|keyword|subject|description|body|matter|madde|qanun/i.test(name));
    if (!searchable.length) return { sources: [], status: "NO_SEARCHABLE_COLUMNS" };

    const formEntries = form && typeof form === "object" ? Object.entries(form).filter(([key, value]) => typeof value === "string" && value.trim()) : [];
    const legalFieldNames = /story|claim|subject|topic|purpose|goal|action|details|evidence|attachment|description|request|reason|notes|شرح|خواسته|موضوع|دلیل|متن/i;
    const formText = formEntries.filter(([key]) => legalFieldNames.test(key)).map(([, value]) => value).join(" ");
    const correctionText = String(context?.correction_notes || "");
    const userText = [formText, correctionText].filter(Boolean).join(" ");
    let terms = extractSearchTerms(userText);
    terms = expandLegalSynonyms(terms).slice(0, Math.max(1, Math.min(10, Math.floor(90 / searchable.length))));
    if (!terms.length) return { sources: [], status: "NO_SEARCH_TERMS" };

    const columnsSql = searchable.map(name => `CAST("${name}" AS TEXT) LIKE ?`).join(" OR ");
    const whereSql = terms.map(() => `(${columnsSql})`).join(" OR ");
    const bindings = terms.flatMap(term => searchable.map(() => `%${term}%`));
    const result = await db.prepare(`SELECT * FROM legal_articles WHERE ${whereSql} LIMIT 60`).bind(...bindings).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    if (!rows.length) return { sources: [], status: "NO_MATCHING_ARTICLES" };

    const ranked = rows.map(row => {
      const lowerRow = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
      const keywordBlob = ["keywords", "keyword", "tags", "subject", "title", "law_name", "law_title"].map(k => String(lowerRow[k] ?? "")).join(" ").toLowerCase();
      const bodyBlob = allowed.map(k => String(lowerRow[k.toLowerCase()] ?? "")).join(" ").toLowerCase();
      const matchedTerms = terms.filter(term => bodyBlob.includes(term.toLowerCase()));
      const score = terms.reduce((sum, term) => sum + (keywordBlob.includes(term.toLowerCase()) ? 3 : 0) + (bodyBlob.includes(term.toLowerCase()) ? 1 : 0), 0);
      return { row: lowerRow, score, matchedTerms: matchedTerms.length };
    }).filter(x => x.score > 0 && x.matchedTerms >= 2).sort((a, b) => b.score - a.score);

    const seen = new Set();
    const sources = [];
    for (const item of ranked) {
      const row = item.row;
      const lawName = firstValue(row, ["law_name", "law_name_fa", "law_title", "law", "lawname", "source_name", "name", "title"]);
      let articleNumber = firstValue(row, ["article_number", "article_no", "article_num", "madde_number", "madde_no", "number", "article_id"]);
      if (!articleNumber && row.article !== undefined && String(row.article).length < 40) articleNumber = String(row.article);
      const articleText = firstValue(row, ["article_text", "article_content", "article_content_fa", "full_text", "article_body", "content_text", "text", "content", "body", "description", "matn", "text_body"]);
      const keywords = firstValue(row, ["keywords", "keyword", "tags", "subject", "keywords_fa"]);
      if (!lawName || !articleNumber || !articleText) continue;
      const identity = `${lawName}|${articleNumber}|${articleText.slice(0, 80)}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      sources.push({ law_name: lawName, article_number: articleNumber, article_text: articleText, keywords, relevance_score: item.score });
      if (sources.length >= 10) break;
    }
    return { sources, status: sources.length ? "OK" : "NO_USABLE_ROWS" };
  } catch (error) {
    console.error("D1 legal article lookup failed:", String(error?.message || error));
    return { sources: [], status: "SQL_QUERY_FAILED" };
  }
}

function buildFactsLedger(form, context) {
  const source = form && typeof form === "object" && !Array.isArray(form) ? form : {};
  const labels = {
    plaintiff: "خواهان", defendant: "خوانده", complainant: "شاکی", accused: "مشتکی‌عنه",
    sender: "فرستنده/اظهارکننده", receiver: "مخاطب", recipient: "مخاطب",
    claim: "خواسته", subject: "موضوع", topic: "موضوع", value: "مبلغ/بهای خواسته",
    story: "شرح خام کاربر", evidence: "دلایل و مستندات", attachments: "پیوست‌ها",
    date: "تاریخ واردشده", case: "شماره یا عنوان پرونده", court: "مرجع رسیدگی"
  };
  const entries = Object.entries(source).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => ({ field: k, meaning: labels[k] || k, exact_value: v.trim() }));
  return {
    entries,
    previous_draft: typeof context?.previous_draft === "string" ? context.previous_draft : "",
    correction_notes: typeof context?.correction_notes === "string" ? context.correction_notes : "",
    fixed_rules: [
      "نقش‌های صریح خواهان/خوانده یا شاکی/مشتکی‌عنه را جابه‌جا نکن",
      "هیچ مبلغی را با افزودن یا حذف صفر تغییر نده",
      "واحد تومان/ریال را فقط اگر کاربر گفته درج کن",
      "تاریخ هر رویداد مستقل است و نباید با تاریخ رویداد دیگر جایگزین شود",
      "رابطه مالی متقابل یا قرارداد ناگفته نساز",
      "جای‌خالی یا عبارت نمونه داخل متن نهایی نگذار"
    ]
  };
}

function normalizeDigits(value) {
  return String(value || "").replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/ي/g, "ی").replace(/ك/g, "ک");
}
function numericFacts(text) {
  const normalized = normalizeDigits(text);
  const matches = normalized.match(/(?<!\d)(?:\d{1,3}(?:[\s,٬،.]\d{3})+|\d{4,})(?!\d)/g) || [];
  return matches.map(x => x.replace(/\D/g, "")).filter(x => x.length >= 4);
}
function dateFacts(text) {
  const normalized = normalizeDigits(text).replace(/\s+/g, " ");
  const months = "فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند";
  const result = [];
  const re = new RegExp(`(\\d{1,2})\\s*(${months})\\s*(\\d{4})`, "g");
  let m;
  while ((m = re.exec(normalized))) result.push(`${Number(m[1])}|${m[2]}|${m[3]}`);
  const iso = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g;
  while ((m = iso.exec(normalized))) result.push(`ISO|${Number(m[1])}|${Number(m[2])}|${Number(m[3])}`);
  return result;
}
function dateAmountPairs(text) {
  const normalized = normalizeDigits(text).replace(/\s+/g, " ");
  const months = "فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند";
  const dateRe = new RegExp(`(\\d{1,2})\\s*(${months})\\s*(\\d{4})`, "g");
  const dates = [];
  let dm;
  while ((dm = dateRe.exec(normalized))) dates.push({ value: `${Number(dm[1])}|${dm[2]}|${dm[3]}`, index: dm.index });
  const amountRe = /(?<!\d)(?:\d{1,3}(?:[\s,٬،.]\d{3})+|\d{5,})(?!\d)/g;
  const amounts = [];
  let am;
  while ((am = amountRe.exec(normalized))) {
    const value = am[0].replace(/\D/g, "");
    if (value.length >= 5) amounts.push({ value, index: am.index });
  }
  const pairs = [];
  for (const date of dates) {
    let nearest = null;
    for (const amount of amounts) {
      const distance = Math.abs(amount.index - date.index);
      if (distance <= 55 && (!nearest || distance < nearest.distance)) nearest = { value: amount.value, distance };
    }
    if (nearest) pairs.push(`${nearest.value}|${date.value}`);
  }
  return pairs;
}

function validateDraftFacts(answer, form, context, sources, task) {
  if (["classify_service", "connection_test"].includes(task)) return { ok: true, issues: [] };
  const sourceText = [
    ...(form && typeof form === "object" ? Object.values(form).filter(v => typeof v === "string") : []),
    ...(task === "legal_revision_patch" ? [] : [String(context?.previous_draft || "")]),
    String(context?.correction_notes || "")
  ].join("\n");
  let candidate = String(answer || "");
  if (task === "legal_revision_patch") {
    try {
      const raw = candidate.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const obj = JSON.parse(raw);
      candidate = [...(obj.changes || []).map(x => `${x.replacement_text || ""}`), ...(obj.insertions || []).map(x => `${x.text || ""}`)].join("\n");
    } catch { /* JSON parsing is validated by the client; keep raw text for conservative checks. */ }
  } else {
    const finalStart = candidate.indexOf("[[متن نهایی]]");
    const explStart = candidate.indexOf("[[توضیحات تکمیلی]]");
    if (finalStart >= 0 && explStart > finalStart) candidate = candidate.slice(finalStart + "[[متن نهایی]]".length, explStart);
    else {
      const alt = candidate.match(/(?:متن نهایی|متن قابل ارائه)\s*[:：]([\s\S]*?)(?:توضیحات تکمیلی|توضیحات سامانه)\s*[:：]/);
      if (alt) candidate = alt[1];
    }
  }
  const normalizedAnswer = normalizeDigits(candidate);
  const sourceNumbers = new Set(numericFacts(sourceText));
  const allowedLegalNumbers = new Set((sources || []).map(s => numericFacts(String(s.article_number || ""))).flat());
  const inputNums = [...sourceNumbers].map(Number).filter(n => Number.isFinite(n) && n > 0);
  const amountCandidates = inputNums.filter(n => n >= 10000 && n <= 1e15);
  if (amountCandidates.length >= 2) {
    const sum = amountCandidates.reduce((a, b) => a + b, 0);
    if (Number.isSafeInteger(sum) && sum <= 1e15) sourceNumbers.add(String(sum));
  }
  const unknownNumbers = [...new Set(numericFacts(normalizedAnswer).filter(n => !sourceNumbers.has(n) && !allowedLegalNumbers.has(n)))];
  const sourceArticleNumbers = new Set((sources || []).map(s => normalizeDigits(String(s.article_number || "")).match(/\d+/g) || []).flat());
  const allArticleMentions = normalizeDigits(String(answer || "")).matchAll(/(?:ماده|مواد)\s*([0-9]{1,4})/g);
  const unsupportedArticles = [...new Set([...allArticleMentions].map(m => m[1]).filter(n => !sourceArticleNumbers.has(n)))];
  const sourceDates = new Set(dateFacts(sourceText));
  const answerDates = dateFacts(normalizedAnswer);
  const unknownDates = answerDates.filter(d => !sourceDates.has(d));
  const sourceDateAmountPairs = new Set(dateAmountPairs(sourceText));
  const answerDateAmountPairs = dateAmountPairs(normalizedAnswer);
  const mismatchedDateAmountPairs = answerDateAmountPairs.filter(pair => !sourceDateAmountPairs.has(pair));
  const sourceHasCurrency = /تومان|ریال/.test(sourceText);
  const answerHasCurrency = /تومان|ریال/.test(normalizedAnswer);
  const issues = [];
  if (unknownNumbers.length) issues.push(`عدد یا مبلغی در پاسخ آمده که در اطلاعات ورودی یا منابع قانونی پیدا نشد: ${unknownNumbers.join("، ")}`);
  if (unsupportedArticles.length) issues.push(`استناد قانونی بدون تطبیق با رکورد SQL دیده شد: ماده ${unsupportedArticles.join("، ")}`);
  if (sourceDates.size && unknownDates.length) issues.push("یک یا چند تاریخ کامل با تاریخ‌های واردشده تطبیق ندارد؛ احتمال جابه‌جایی روز، ماه یا سال وجود دارد.");
  if (sourceDateAmountPairs.size && mismatchedDateAmountPairs.length) issues.push("ارتباط مبلغ و تاریخ در پاسخ با اطلاعات ورودی تطبیق ندارد؛ احتمال جابه‌جایی تاریخ دو پرداخت یا سند وجود دارد.");
  if (!sourceHasCurrency && answerHasCurrency) issues.push("واحد پولی تومان/ریال در متن تولیدشده اضافه شده، اما کاربر آن را مشخص نکرده است.");
  const sourceShowsLending = /قرض\s*(?:دادم|داده\s*ام|داده‌ام)|پول(?:م|مو|ی)[\s\S]{0,30}(?:فرض|قرض)\s*داد|پرداخت\s*(?:کردم|کرده\s*ام|کرده‌ام)/.test(sourceText);
  const sourceWantsReturn = /پول(?:م|مو|ی خود)?[\s\S]{0,45}(?:پس بگیر|بس بگیر|بازگردان|برگردان|استرداد)|قرض[\s\S]{0,35}پس بگیر/.test(sourceText);
  const defendantName = String(form?.defendant || "").trim();
  const plaintiffName = String(form?.plaintiff || "").trim();
  const inverseLoan = /(?:به من|به خواهان|به شاکی)[\s\S]{0,30}قرض\s*(?:داد|داده|داده\s*است)|(?:از خوانده|از متهم)[\s\S]{0,30}قرض\s*(?:گرفتم|گرفته\s*ام|گرفته‌ام)/.test(normalizedAnswer) || (defendantName && new RegExp(`${defendantName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.{0,70}(?:به من|به خواهان|${plaintiffName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}).{0,25}قرض\\s*(?:داد|داده)`).test(normalizedAnswer));
  if (sourceShowsLending && sourceWantsReturn && inverseLoan) issues.push("جهت رابطه مالی برعکس شده است: ورودی می‌گوید کاربر پول خود را پس می‌خواهد، اما پاسخ ادعا می‌کند خوانده به خواهان قرض داده است.");
  const roles = [["plaintiff", "خواهان"], ["defendant", "خوانده"], ["complainant", "شاکی"], ["accused", "مشتکی‌عنه"]];
  for (const [key, label] of roles) {
    const expected = String(form?.[key] || "").trim();
    if (!expected) continue;
    const line = normalizedAnswer.split(/\r?\n/).find(x => new RegExp(`^\\s*${label}\\s*[:：]`).test(x));
    if (line && !line.includes(expected)) issues.push(`سمت «${label}» با اطلاعات فرم تطبیق ندارد؛ مقدار ثبت‌شده «${expected}» است.`);
  }
  const placeholder = /\[(?:شماره پرونده|نام قانون|ماده قانونی|نام و نام خانوادگی|مبلغ دقیق|مرجع صالح)[^\]]*\]|شرح (?:ادعا|واقعه|درخواست) درج شود|دلایل درج شود|(?:^|[\s،؛])حسب مورد(?:$|[\s،؛])/.test(normalizedAnswer);
  if (placeholder) issues.push("پاسخ شامل جای‌خالی یا عبارت قالبی است و برای متن نهایی قابل‌قبول نیست.");
  return { ok: issues.length === 0, issues };
}

function expandLegalSynonyms(terms) {
  const expanded = [...terms];
  const groups = [
    [["پول", "پولم", "وجوه", "وجه", "مبلغ", "مالی"], ["مطالبه", "استرداد", "دین"]],
    [["قرض", "قرضی", "قرضدادم", "قرض دادم", "پس", "پسگرفتن", "برگرداندن", "بازگرداندن"], ["قرض", "استرداد", "مطالبه", "وجه"]],
    [["پرداخت", "پرداختم", "رسید", "واریز", "واریزی", "اسناد"], ["پرداخت", "اثبات", "سند", "رسید"]],
    [["قرارداد", "تعهد", "توافق"], ["تعهد", "قرارداد", "الزام"]]
  ];
  for (const [needles, additions] of groups) if (needles.some(n => expanded.some(t => t.includes(n)))) for (const a of additions) if (!expanded.includes(a)) expanded.push(a);
  return expanded;
}

function extractSearchTerms(text) {
  const normalized = String(text || "").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[۰-۹٠-٩]/g, " ").replace(/[^؀-ۿ\s]/g, " ");
  const stop = new Set([
    "این", "برای", "است", "هست", "شود", "شده", "کنم", "کند", "کنید", "کردن", "کرده", "کردم", "باید", "میباشد", "باشد", "دارم", "دارد", "دارند", "میخواهم", "میخوام", "میشه", "آنها", "ایشان", "خودم", "خودش", "لطفا", "خواهشمند", "متن", "نهایی", "توضیحات", "تکمیلی", "قانون", "ماده", "حقوقی", "درخواست", "موضوع", "شرح", "اطلاعات", "پرونده", "شخص", "کاربر", "میان", "بخش", "شما", "من", "و", "یا", "از", "به", "با", "در", "را", "که", "تا", "اگر", "هم", "اما", "بعد", "قبل", "روی", "یک", "هر", "چه", "چرا", "چطور", "برایم", "خود", "بدون", "فقط", "همین", "مربوط", "بیشتر", "کمتر", "مورد", "موجود", "مختلف", "کننده", "مرتبط", "محسن", "عبدی", "خواهان", "خوانده", "شاکی", "مشتکیعنه", "تاریخ", "مبلغ", "شماره", "ریال", "تومان", "مهر", "آبان", "۱۴۰۰", "۱۴۰۴"
  ]);
  const tokens = normalized.match(/[\u0600-\u06FF]{3,}/g) || [];
  const unique = [];
  for (const token of tokens) {
    if (stop.has(token) || unique.includes(token)) continue;
    unique.push(token);
    if (unique.length >= 18) break;
  }
  return unique;
}
function firstValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}
function safeString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
function safeJson(value, maxLength) {
  if (value === undefined || value === null) return {};
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > maxLength) return { note: "اطلاعات ارسالی بیش از حد طولانی است." };
    return JSON.parse(serialized);
  } catch {
    return {};
  }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
