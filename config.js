// إعدادات الاتصال بقاعدة البيانات. عدّل السطرين الأولين فقط.
// القيم من Supabase: Project Settings ← API (أو Connect).
// المفتاح العام anon key آمن للنشر؛ الحماية من سياسات قاعدة البيانات.
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_KEY",

  // اجعلها true بعد نشر دالة shelf-ai وإضافة مفتاح Claude (الخطوة 6 في الدليل)
  AI_ENABLED: false,
  AI_FUNCTION: "shelf-ai",

  // لا تغيّرها بعد ما يبدأ الموظفين التسجيل
  LOGIN_DOMAIN: "merch.qaryah.sa"
};
