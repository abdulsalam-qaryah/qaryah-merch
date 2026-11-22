// إعدادات الاتصال بقاعدة البيانات. عدّل السطرين الأولين فقط.
// القيم من Supabase: زر Connect (Project URL و publishable key).
// المفتاح العام anon key آمن للنشر؛ الحماية من سياسات قاعدة البيانات.
window.APP_CONFIG = {
  SUPABASE_URL: "https://qvnnwnniajujjpcggbfq.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_2cVuqSpub_fjm0E7HK8OZw_H52fsyAi",

  // اجعلها true بعد نشر دالة shelf-ai وإضافة مفتاح Claude (الخطوة 6 في الدليل)
  AI_ENABLED: false,
  AI_FUNCTION: "shelf-ai",

  // لا تغيّرها بعد ما يبدأ الموظفين التسجيل
  LOGIN_DOMAIN: "merch.qaryah.sa"
};
