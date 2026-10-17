// functions/api/legal-deraft.js

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json();
    
    // گرفتن پیام ورودی
    const userPrompt = body.message || body.prompt || body.text || (typeof body === 'string' ? body : JSON.stringify(body));

    if (!userPrompt) {
      return new Response(JSON.stringify({ error: "متن درخواست یافت نشد." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // دستورالعمل تخصصی حقوقی موسسه k-law
    const systemPrompt = `شما وکیل ارشد و مشاور حقوقی هوشمند موسسه حقوقی k-law هستید.
وظایف اصلی شما:
۱. تشخیص دقیق نوع سند درخواستی:
   - اگر کاربر لایحه دادگاه خواست، یک «لایحه دفاعیه / اعتراضی رسمی خطاب به مرجع قضایی» بنویسید (نه اظهارنامه!).
   - اگر کاربر دادخواست خواست، قالب کامل «دادخواست حقوقی» را تنظیم کنید.
   - اگر اظهارنامه خواست، قالب رسمی «اظهارنامه» را تنظیم کنید.
   - اگر صرفاً سوال حقوقی پرسید، پاسخ تحلیلی و حقوقی ارائه دهید.

۲. ذکر صریح مواد قانونی:
   - به هیچ وجه نگویید "نیازمند ماده قانونی هستیم"؛ بلکه خودتان مستقیماً و با تسلط کامل، شماره مواد قانونی مربوطه در قوانین ایران (قانون مدنی، آیین دادرسی مدنی، قانون اجرای احکام مدنی، قانون نحوه اجرای محکومیت‌های مالی و...) را دقیقاً ذکر و تحلیل کنید.

۳. ساختار استاندارد لایحه/متن قضایی:
   - عنوان مرجع رسیدگی‌کننده
   - مشخصات طرفین (تجدیدنظرخواه / تجدیدنظرخوانده یا خواهان / خوانده)
   - مقدمه و شرح ماوقع
   - استناد به مواد قانونی و جهات تجدیدنظرخواهی یا دفاع
   - نتیجه‌گیری و درخواست نهایی از دادگاه محترم

۴. در انتهای تمام پاسخ‌ها این عبارت را درج کنید:
«این متن توسط دستیار هوش مصنوعی موسسه حقوقی k-law تنظیم گردیده است؛ جهت اعتبارسنجی نهایی پرونده و پیگیری قضایی، با خانم نسرین کربلایی تماس بگیرید: ۰۹۳۳۵۷۷۰۱۷۵.»`;

    const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.AVALAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.25, // دقت بسیار بالا بدون ابهام
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ 
        error: "خطا در ارتباط با هوش مصنوعی", 
        status: response.status,
        details: errText 
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ 
      success: true,
      reply: replyText,
      draft: replyText,
      response: replyText 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: "خطای سرور", 
      message: err.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
