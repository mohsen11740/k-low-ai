// functions/api/legal-deraft.js

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    // خواندن داده‌های ارسالی از فرانت‌اند
    const body = await request.json();
    
    // گرفتن پیام کاربر (پشتیبانی از هر فیلدی که فرانت‌اند می‌فرستد مثل message، prompt یا text)
    const userPrompt = body.message || body.prompt || body.text || JSON.stringify(body);

    if (!userPrompt) {
      return new Response(JSON.stringify({ error: "متن درخواست یافت نشد." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // دستورالعمل حقوقی اختصاصی موسسه k-law
    const systemPrompt = `شما دستیار ارشد هوشمند حقوقی موسسه حقوقی k-law (تحت نظارت آقای محسن عبدی) هستید.
وظایف و اصول نگارش:
1. تحلیل دقیق، تنظیم لایحه، دادخواست یا پاسخگویی به سوالات حقوقی کاربران بر اساس قوانین رسمی جمهوری اسلامی ایران (قانون مدنی، آیین دادرسی مدنی، قانون اجرای احکام مدنی، قانون نحوه اجرای محکومیت‌های مالی و سایر قوانین جاری).
2. استناد صریح و بدون ابهام به شماره مواد، تبصره‌ها و اصول قانونی.
3. لحن کاملاً حقوقی، رسمی، مستند، اداری و بدون اضافه‌گویی.
4. خروجی تفکیک‌شده و منظم (مقدمه، شرح خواسته/لایحه، مبانی قانونی و نتیجه‌گیری نهایی).`;

    // فراخوانی سرویس AvalAI (با پروتکل رسمی OpenAI)
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
        temperature: 0.3, // دمای پایین برای جلوگیری از توهم و خطای حقوقی
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ 
        error: "خطا در برقراری ارتباط با مدل هوش مصنوعی", 
        status: response.status,
        details: errText 
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const replyText = data.choices && data.choices[0] && data.choices[0].message 
      ? data.choices[0].message.content 
      : "";

    // خروجی استاندارد سازگار با فرانت‌اند شما
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

// مدیریت درخواست‌های OPTIONS برای حل مشکل CORS
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
