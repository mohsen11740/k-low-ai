const corsHeaders = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost({ request, env }) {
  try {
    const origin = request.headers.get("Origin");
    if (origin && origin !== new URL(request.url).origin) {
      return json({ error: "درخواست از مبدأ غیرمجاز پذیرفته نشد." }, 403);
    }
    if (!env.AI || typeof env.AI.run !== "function") {
      return json({ error: "اتصال Workers AI در تنظیمات Cloudflare Pages فعال نشده است." }, 503);
    }

    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const task = typeof body.task === "string" ? body.task : "مشاوره حقوقی";
    const form = body.form && typeof body.form === "object" ? body.form : {};
    const context = body.context && typeof body.context === "object" ? body.context : {};

    if (message.length < 5) return json({ error: "متن درخواست کافی نیست." }, 400);
    if (message.length > 24000) return json({ error: "متن درخواست بیش از حد طولانی است." }, 413);

    const system = `شما دستیار فارسی‌زبان حقوقی سرویس «k-low | مشاوره حقوقی خانم کربلایی» هستید. به زبان فارسی روان و راست‌چین پاسخ بده و موضوع را بر اساس قوانین ایران بررسی کن مگر کاربر کشور دیگری مشخص کند. پاسخ کاربردی، دقیق و منظم با تیترهای روشن بنویس. هیچ ماده قانونی، رأی، تاریخ، مدرک یا نقل‌قولی را جعل نکن؛ اگر از صحت یا جاری بودن مقرره مطمئن نیستی صریحاً بگو. گفته‌های کاربر را از واقعیت اثبات‌شده جدا کن. اگر اطلاعات ضروری کم است، ابهام‌ها و پرسش‌های تکمیلی را مشخص کن. برای مشاوره: خلاصه مسئله، نکات حقوقی، راهکارهای احتمالی، ریسک‌ها، مدارک لازم و اقدام بعدی را بیاور. برای سند: پیش‌نویس حرفه‌ای، عنوان، شرح ماجرا، دلایل، خواسته نهایی و موارد ناقص را ارائه کن. در موضوعات دارای مهلت یا اجرای حکم، ضرورت بررسی فوری را یادآور شو. پاسخ جایگزین بررسی وکیل نیست.`;
    const user = `نوع خدمت: ${task}\nاطلاعات فرم: ${JSON.stringify(form)}\nزمینه: ${JSON.stringify(context)}\nدرخواست و متن اولیه:\n${message}`;

    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 1800,
      temperature: 0.25
    });

    const answer = result?.response || result?.result?.response || result?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return json({ error: "مدل هوش مصنوعی پاسخ متنی برنگرداند." }, 502);
    }
    return json({ text: answer.trim() });
  } catch (error) {
    return json({ error: "در پردازش درخواست خطایی رخ داد. تنظیمات Workers AI و گزارش‌های Pages را بررسی کنید." }, 500);
  }
}
