
const SYSTEM_PROMPT = `
تو دستیار حرفه‌ای نگارش و تحلیل حقوقی ایران در سامانه «حقوق کربلایی» هستی.

هدف تو این است که درخواست ساده کاربر را به پاسخ حقوقی دقیق، روشن، کامل و قابل ویرایش تبدیل کنی.

قواعد الزامی:

۱. فقط بر اساس اطلاعات ارائه‌شده توسط کاربر پاسخ بده. نام، مبلغ، تاریخ، شماره پرونده، نشانی، دلیل، پیامک یا واقعه‌ای را جعل نکن.

۲. اطلاعاتی که کاربر خودش وارد کرده است را حفظ کن. اگر اطلاعاتی مشخص نیست، از جای‌خالی‌هایی مانند [نام خواهان]، [تاریخ] و [مبلغ دقیق] استفاده کن.

۳. ابتدا تشخیص بده کاربر چه می‌خواهد: مشاوره حقوقی، دادخواست، شکواییه، اظهارنامه، لایحه دفاعیه، اعتراض یا نوع دیگری از متن حقوقی.

۴. اگر کاربر تنظیم سند می‌خواهد، متن کامل و آماده ویرایش را بنویس؛ فقط عنوان‌ها، نکته‌ها یا راهنمای کلی نده.

۵. در تنظیم دادخواست، در صورت تناسب، مشخصات طرفین، عنوان خواسته، شرح ماجرا، دلایل و منضمات، مستندات قانونی معتبر و متن کامل درخواست را درج کن. موارد نامعلوم را با جای‌خالی مشخص کن.

۶. بین دعوای حقوقی و شکایت کیفری تفاوت بگذار. صرف اختلاف مالی یا قراردادی را بدون وجود دلایل کافی جرم معرفی نکن. تجدیدنظرخواهی را بدون وجود رأی قابل اعتراض پیشنهاد نده.

۷. شماره مواد قانونی، عنوان قوانین، آرای قضایی و مهلت‌های قانونی را جعل نکن. اگر از مستند قانونی مطمئن نیستی، آن را قطعی اعلام نکن و مشخص کن که نیاز به بررسی دارد.

۸. به اطلاعات فرم، نوع خدمت انتخاب‌شده و سابقه مرتبطی که در درخواست آمده توجه کن. اگر اطلاعات فرم با متن درخواست تعارض دارد، تعارض را مشخص کن و خودسرانه یکی را انتخاب نکن.

۹. اگر برای تعیین مسیر درست، اطلاعات ضروری کم است، ابتدا فقط سؤال‌های کوتاه و ضروری بپرس. اگر می‌توان متن را با جای‌خالی تنظیم کرد، بی‌دلیل کاربر را معطل نکن.

۱۰. متن را به فارسی روان، رسمی، منظم و متناسب با نظام حقوقی ایران بنویس. از تکرار و توضیحات بی‌ربط خودداری کن.

۱۱. اگر کاربر مشاوره می‌خواهد، مسئله را تحلیل کن، گزینه‌های قانونی محتمل را توضیح بده و اقدام بعدی را مشخص کن. نتیجه قطعی را بدون بررسی اسناد تضمین نکن.

۱۲. اگر کاربر متن حقوقی می‌خواهد، ابتدا سند کامل را ارائه کن و سپس مدارک ناقص یا نکات مهم را کوتاه بنویس.

۱۳. اطلاعات کاربر را با فرضیات خودت مخلوط نکن. اگر چیزی صرفاً ادعا یا فرض است، آن را از واقعیت قطعی جدا کن.

۱۴. پاسخ باید کاربردی باشد و مستقیماً به خواسته کاربر پاسخ دهد.
`;

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

      const message =
        typeof body.message === "string"
          ? body.message.trim()
          : "";

      if (!message) {
        return json({ error: "لطفاً درخواست حقوقی خود را بنویسید." }, 400);
      }

      if (message.length > 20000) {
        return json({ error: "متن درخواست بیش از حد طولانی است." }, 413);
      }

      const task = safeString(body.task, 300);
      const form = safeJson(body.form, 10000);
      const context = safeJson(body.context, 10000);

      const userContent = `
درخواست اصلی کاربر:
${message}

بخش یا خدمت انتخاب‌شده در سایت:
${task || "مشخص نشده"}

اطلاعات فرم:
${JSON.stringify(form)}

اطلاعات تکمیلی یا سابقه مرتبط:
${JSON.stringify(context)}

دستور نهایی:
درخواست را دقیق بررسی کن و مطابق قواعد پیام سیستمی پاسخ بده.
اگر تنظیم سند خواسته شده، متن کامل و قابل ویرایش بنویس.
اطلاعات نامعلوم، مبلغ‌ها، وقایع و مواد قانونی را از خودت نساز.
`;

      try {
        if (!env.AI || typeof env.AI.run !== "function") {
          console.error("Workers AI binding is missing.");

          return json({
            error: "اتصال هوش مصنوعی در تنظیمات سرور فعال نیست."
          }, 503);
        }

        const result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct-fast",
          {
            messages: [
              {
                role: "system",
                content: SYSTEM_PROMPT
              },
              {
                role: "user",
                content: userContent
              }
            ],
            max_tokens: 3000
          }
        );

        const answer =
          typeof result?.response === "string"
            ? result.response
            : typeof result?.output_text === "string"
              ? result.output_text
              : typeof result?.text === "string"
                ? result.text
                : "";

        if (!answer.trim()) {
          console.error(
            "Workers AI returned no text.",
            JSON.stringify(result).slice(0, 1000)
          );

          return json({
            error: "هوش مصنوعی پاسخ متنی برنگرداند. لطفاً گزارش خطا را بررسی کنید."
          }, 502);
        }

        return json({ text: answer.trim() });

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

function safeString(value, maxLength) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function safeJson(value, maxLength) {
  if (value === undefined || value === null) {
    return {};
  }

  try {
    const serialized = JSON.stringify(value);

    if (!serialized || serialized.length > maxLength) {
      return {
        note: "اطلاعات ارسالی بیش از حد طولانی است."
      };
    }

    return JSON.parse(serialized);
  } catch {
    return {};
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
