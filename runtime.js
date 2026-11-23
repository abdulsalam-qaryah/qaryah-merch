/* Standalone runtime for «متابعة المناديب – القرية».
   The app was written against claude.ai's window.claude.use(...) capabilities (db, user, assets, downloads, sample).
   This file provides the same calls on top of Supabase, plus a username/password login screen. */
(function () {
  'use strict';
  var C = window.APP_CONFIG || {};
  var DOMAIN = C.LOGIN_DOMAIN || 'merch.qaryah.sa';
  window.APP_STANDALONE = true;

  var configured = C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !/YOUR_|xxxx/i.test(C.SUPABASE_URL + C.SUPABASE_ANON_KEY);
  if (!configured || !window.supabase) {
    window.claude = { use: function () { return new Promise(function () {}); } };
    document.addEventListener('DOMContentLoaded', function () {
      gate('<h1>التطبيق يحتاج إعداد</h1><p>افتح ملف <b dir="ltr">config.js</b> وضع فيه رابط مشروع Supabase والمفتاح العام (anon key). الخطوات في دليل النشر.</p>');
    });
    return;
  }

  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  var T = 'docs';
  window.APP_SB = sb;
  window.APP_IMG = function (id) { return sb.storage.from('photos').getPublicUrl(id).data.publicUrl; };
  window.APP_SIGNOUT = function () { return sb.auth.signOut().then(function () { location.reload(); }); };

  /* ---------------- login ---------------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var toEmail = function (u) { return u.trim().toLowerCase() + '@' + DOMAIN; };
  var authErr = function (e) {
    var m = (e && e.message) || '';
    if (/invalid login/i.test(m)) return 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    if (/already registered|already exists/i.test(m)) return 'اسم المستخدم مستخدم من قبل. اختر اسم ثاني أو سجّل دخول.';
    if (/password/i.test(m) && /6|short|weak/i.test(m)) return 'كلمة المرور قصيرة. استخدم 8 أحرف أو أرقام على الأقل.';
    if (/email not confirmed/i.test(m)) return 'الحساب يحتاج تفعيل. اطلب من المدير إيقاف «تأكيد البريد» في إعدادات Supabase.';
    if (/fetch|network/i.test(m)) return 'تعذّر الاتصال. تأكد من الإنترنت وأعد المحاولة.';
    return 'تعذّر الدخول: ' + m;
  };
  function gate(inner) {
    var el = document.getElementById('auth') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'auth' }));
    var lang = 'ar'; try { lang = localStorage.getItem('lang') === 'ur' ? 'ur' : 'ar'; } catch (e) {}
    var sw = '<div class="gate-lang"><div class="langsw" data-notr role="group" aria-label="اللغة / زبان">' +
      '<button type="button" data-lang="ar" class="' + (lang === 'ar' ? 'on' : '') + '">العربية</button>' +
      '<button type="button" data-lang="ur" lang="ur" class="' + (lang === 'ur' ? 'on' : '') + '">اردو</button></div></div>';
    el.innerHTML = '<div class="auth-wrap"><div class="card auth-card">' + sw + '<span class="redlogo" role="img" aria-label="القرية"></span><div class="slogan">جودة تُصدر للعالم</div>' + inner + '</div></div>';
    el.querySelectorAll('[data-lang]').forEach(function (b) { b.onclick = function () { if (b.dataset.lang === lang) return; try { localStorage.setItem('lang', b.dataset.lang); } catch (e) {} location.reload(); }; });
    return el;
  }
  // Same rules as the in-app registration form (claude-artifact/app.html → Register).
  var digits = function (s) { return String(s || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[^\d]/g, ''); };
  var normPhone = function (s) { var d = digits(s); if (d.indexOf('00966') === 0) d = d.slice(5); else if (d.indexOf('966') === 0) d = d.slice(3); if (d.length === 9 && d[0] === '5') d = '0' + d; return d; };
  function loginUI() {
    return new Promise(function (resolve) {
      var mode = 'in', kept = {};
      function draw(msg) {
        var prev = document.querySelectorAll('#af input');
        prev.forEach(function (i) { kept[i.id] = i.value; });
        var up = mode === 'up';
        var el = gate(
          '<h1>' + (up ? 'حساب جديد' : 'تسجيل الدخول') + '</h1>' +
          '<form id="af" class="stack" autocomplete="on" novalidate>' +
          '<label class="fld"><span>اسم المستخدم</span><input id="a-user" name="username" dir="ltr" autocomplete="username" autocapitalize="none" required placeholder="مثال: mahmoud"></label>' +
          '<label class="fld"><span>كلمة المرور</span><input id="a-pass" name="password" type="password" dir="ltr" autocomplete="' + (up ? 'new-password' : 'current-password') + '" required minlength="8"></label>' +
          (up ? '<label class="fld"><span>تأكيد كلمة المرور</span><input id="a-pass2" type="password" dir="ltr" autocomplete="new-password" required minlength="8"></label>' +
            '<div class="notice info">كل الخانات إجبارية</div>' +
            '<label class="fld"><span>الاسم الكامل *</span><input id="a-name" autocomplete="name" placeholder="الاسم الثلاثي كما في الإقامة" required></label>' +
            '<label class="fld"><span>رقم الجوال *</span><input id="a-phone" type="tel" dir="ltr" inputmode="tel" autocomplete="tel" placeholder="05xxxxxxxx" required></label>' +
            '<label class="fld"><span>الرقم الوظيفي *</span><input id="a-emp" dir="ltr" required></label>' +
            '<label class="fld"><span>المدينة *</span><input id="a-city" placeholder="مثال: الرياض" required></label>' : '') +
          (msg ? '<div class="notice ' + (msg.ok ? 'info' : 'bad') + '">' + esc(msg.t) + '</div>' : '') +
          '<button class="btn pri" id="a-go">' + (up ? 'إنشاء الحساب' : 'دخول') + '</button>' +
          '<button type="button" class="btn ghost" id="a-sw">' + (up ? 'عندي حساب، تسجيل الدخول' : 'موظف جديد؟ إنشاء حساب') + '</button>' +
          '</form>');
        el.querySelectorAll('#af input').forEach(function (i) { if (kept[i.id] != null) i.value = kept[i.id]; });
        el.querySelector('#a-sw').onclick = function () { mode = up ? 'in' : 'up'; draw(); };
        el.querySelector('#af').onsubmit = async function (ev) {
          ev.preventDefault();
          var btn = el.querySelector('#a-go'); btn.disabled = true; btn.textContent = 'لحظة…';
          var u = el.querySelector('#a-user').value.trim().toLowerCase();
          var p = el.querySelector('#a-pass').value;
          if (!/^[a-z0-9._-]{3,30}$/.test(u)) { draw({ t: 'اسم المستخدم بالإنجليزي أو أرقام فقط، من 3 إلى 30 حرف، بدون مسافات.' }); return; }
          if (p.length < 8) { draw({ t: 'كلمة المرور قصيرة. استخدم 8 أحرف أو أرقام على الأقل.' }); return; }
          try {
            if (up) {
              if (p !== el.querySelector('#a-pass2').value) { draw({ t: 'كلمتا المرور غير متطابقتين.' }); return; }
              var name = el.querySelector('#a-name').value.trim().replace(/\s+/g, ' '), phone = normPhone(el.querySelector('#a-phone').value);
              var empNo = el.querySelector('#a-emp').value.trim(), city = el.querySelector('#a-city').value.trim();
              if (name.split(' ').length < 2) { draw({ t: 'اكتب اسمك الكامل (اسمين على الأقل)' }); return; }
              if (!/^05\d{8}$/.test(phone)) { draw({ t: 'اكتب رقم جوال صحيح يبدأ بـ 05 (10 أرقام)' }); return; }
              if (!empNo) { draw({ t: 'اكتب الرقم الوظيفي' }); return; }
              if (!city) { draw({ t: 'اكتب المدينة' }); return; }
              var r = await sb.auth.signUp({ email: toEmail(u), password: p, options: { data: { username: u, name: name, phone: phone } } });
              if (r.error) throw r.error;
              if (!r.data.session) { draw({ t: 'تم إنشاء الحساب لكنه يحتاج تفعيل. اطلب من المدير إيقاف «Confirm email» في Supabase ثم سجّل دخول.' }); return; }
              await sb.from(T).upsert({ collection: 'profiles', id: r.data.user.id, data: { name: name, phone: phone, empNo: empNo, city: city, username: u, createdAt: Date.now() } });
              resolve(r.data.session);
            } else {
              var s = await sb.auth.signInWithPassword({ email: toEmail(u), password: p });
              if (s.error) throw s.error;
              resolve(s.data.session);
            }
            el.remove();
          } catch (e) { draw({ t: authErr(e) }); }
        };
      }
      draw();
    });
  }
  var ready = sb.auth.getSession().then(function (r) { return r.data.session || loginUI(); }).then(function (s) {
    window.APP_USERNAME = (s.user.user_metadata && s.user.user_metadata.username) || s.user.email.split('@')[0];
    return s;
  });

  /* ---------------- db ---------------- */
  var mapErr = function (e) {
    var m = (e && e.message) || '';
    var code = /fetch|network|Failed to/i.test(m) ? 'unavailable' : (e && e.code === 'P0002') ? 'invalid_argument' : /quota|limit/i.test(m) ? 'quota_exceeded' : 'invalid_argument';
    return { code: code, message: m };
  };
  var listeners = {}, timers = {};
  function notify(col) { (listeners[col] || []).slice().forEach(function (f) { f(); }); }
  function soon(col) { clearTimeout(timers[col]); timers[col] = setTimeout(function () { if (col === '*') Object.keys(listeners).forEach(notify); else notify(col); }, 350); }
  var channel = null;
  function live() {
    if (channel) return;
    channel = sb.channel('docs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: T }, function (p) {
        var col = (p.new && p.new.collection) || (p.old && p.old.collection); soon(col || '*');
      }).subscribe();
  }
  function listen(col, f) { (listeners[col] = listeners[col] || []).push(f); live(); return function () { listeners[col] = (listeners[col] || []).filter(function (x) { return x !== f; }); }; }
  var snapDoc = function (id, data) { return { id: id, exists: data !== undefined && data !== null, data: function () { return data || undefined; }, metadata: { fromCache: false, hasPendingWrites: false } }; };
  var rid = function () { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); };

  function docRef(path) {
    var parts = path.split('/'), col = parts[0], id = parts[1];
    if (parts.length !== 2 || !col || !id) throw new TypeError('document path must have 2 segments: ' + path);
    var ref = {
      id: id, path: path,
      get: async function () {
        var r = await sb.from(T).select('data').eq('collection', col).eq('id', id).maybeSingle();
        if (r.error) throw mapErr(r.error);
        return snapDoc(id, r.data && r.data.data);
      },
      set: async function (data) {
        var r = await sb.from(T).upsert({ collection: col, id: id, data: data, updated_at: new Date().toISOString() });
        if (r.error) throw mapErr(r.error); notify(col);
      },
      update: async function (patch) {
        var r = await sb.rpc('doc_merge', { c: col, i: id, patch: patch });
        if (r.error) throw mapErr(r.error); notify(col);
      },
      delete: async function () {
        var r = await sb.from(T).delete().eq('collection', col).eq('id', id);
        if (r.error) throw mapErr(r.error); notify(col);
      },
      onSnapshot: function (next, err) {
        var dead = false;
        var run = function () { ref.get().then(function (s) { if (!dead) next(s); }, function (e) { if (!dead && e.code !== 'unavailable' && err) err(e); }); };
        var off = listen(col, run); run();
        return function () { dead = true; off(); };
      },
      collection: function () { throw new TypeError('sub-collections are not used in this app'); }
    };
    return ref;
  }
  var OPS = { '==': 'eq', '!=': 'neq', '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte' };
  function query(col, w, o, l) {
    var run = async function () {
      var out = [], from = 0, page = 1000;
      while (true) {
        var q = sb.from(T).select('id,data').eq('collection', col);
        w.forEach(function (c) {
          var f = 'data->>' + c[0];
          if (c[1] === 'in') q = q.in(f, c[2].map(String));
          else if (c[1] === 'not-in') q = q.not(f, 'in', '(' + c[2].map(String).join(',') + ')');
          else q = q.filter(f, OPS[c[1]], String(c[2]));
        });
        if (o) q = q.order('data->>' + o[0], { ascending: o[1] !== 'desc' });
        var want = l ? Math.min(page, l - out.length) : page;
        var r = await q.range(from, from + want - 1);
        if (r.error) throw mapErr(r.error);
        out = out.concat(r.data);
        if (r.data.length < want || (l && out.length >= l)) break;
        from += want;
      }
      var docs = out.map(function (x) { return snapDoc(x.id, x.data); });
      return { docs: docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: function () { return []; } };
    };
    var api = {
      path: col,
      where: function (f, op, v) { return query(col, w.concat([[f, op, v]]), o, l); },
      orderBy: function (f, d) { return query(col, w, [f, d || 'asc'], l); },
      limit: function (n) { return query(col, w, o, n); },
      get: run,
      onSnapshot: function (next, err) {
        var dead = false;
        var go = function () { run().then(function (s) { if (!dead) next(s); }, function (e) { if (!dead && e.code !== 'unavailable' && err) err(e); }); };
        var off = listen(col, go); go();
        return function () { dead = true; off(); };
      },
      doc: function (id) { return docRef(col + '/' + (id || rid())); },
      add: async function (data) { var d = docRef(col + '/' + rid()); await d.set(data); return d; }
    };
    return api;
  }
  var db = { doc: docRef, collection: function (c) { return query(c, [], null, 0); } };

  /* ---------------- user, assets, downloads, sample ---------------- */
  function makeNamespaces(session) {
    var uid = session.user.id, adminP = null;
    var isAdmin = function () { return adminP || (adminP = sb.rpc('is_admin').then(function (r) { return !!r.data; }, function () { return false; })); };
    var user = {
      id: async function () { return uid; },
      canEdit: isAdmin, isOwner: isAdmin,
      can: async function () { return true; },
      me: async function () { var a = await isAdmin(); return { id: uid, name: '', avatarUrl: '', color: '', email: null, isOwner: a, canEdit: a }; },
      profiles: async function () { return {}; }, name: async function () { return ''; }, search: async function () { return []; }
    };
    var assets = {
      upload: async function (blob, opt) {
        var type = (opt && opt.contentType) || blob.type || 'image/jpeg';
        var ext = /png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : 'jpg';
        var path = uid + '/' + new Date().toISOString().slice(0, 10) + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
        var r = await sb.storage.from('photos').upload(path, blob, { contentType: type, upsert: false });
        if (r.error) throw { code: /size|large/i.test(r.error.message) ? 'too_large' : 'store_unavailable', message: r.error.message };
        return { id: path, url: window.APP_IMG(path), sizeBytes: blob.size, contentType: type };
      },
      delete: async function (id) { var r = await sb.storage.from('photos').remove([id]); if (r.error) throw { code: 'not_uploader', message: r.error.message }; },
      list: async function () { return { assets: [], usage: {} }; }
    };
    var downloads = {
      save: async function (req) {
        var blob = req.data instanceof Blob ? req.data : new Blob([req.data], { type: /\.csv$/i.test(req.filename) ? 'text/csv;charset=utf-8' : 'application/octet-stream' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = req.filename; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        return { status: 'saved' };
      }
    };
    var ns = { db: db, user: user, assets: assets, downloads: downloads };
    if (C.AI_ENABLED) {
      var b64 = function (blob) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1]); }; fr.onerror = rej; fr.readAsDataURL(blob); }); };
      var sample = async function (input, opts) {
        opts = opts || {};
        var prompt = typeof input === 'string' ? input : input.map(function (m) { return m.content; }).join('\n\n');
        var imgs = [];
        var list = opts.images ? [].concat(opts.images instanceof FileList ? Array.from(opts.images) : opts.images) : [];
        for (var i = 0; i < list.length; i++) imgs.push({ type: list[i].type || 'image/jpeg', data: await b64(list[i]) });
        if (opts.onText) opts.onText({ text: '', delta: '' });
        var r = await sb.functions.invoke(C.AI_FUNCTION || 'shelf-ai', { body: { prompt: prompt, images: imgs } });
        if (r.error) {
          var body = null; try { body = await r.error.context.json(); } catch (e) {}
          throw { code: (body && body.code) || 'upstream_error', message: (body && body.error) || r.error.message };
        }
        if (r.data && r.data.error) throw { code: r.data.code || 'upstream_error', message: r.data.error };
        var text = (r.data && r.data.text) || '';
        if (opts.onText) opts.onText({ text: text, delta: text });
        return { text: text, truncated: !!(r.data && r.data.truncated), modelTierApplied: 'default' };
      };
      sample.json = async function (input, opts) {
        var r = await sample(input, opts), t = r.text;
        var m = t.match(/```(?:json)?\s*([\s\S]*?)```/), s = m ? m[1] : t.slice(Math.max(0, t.search(/[\[{]/)));
        try { return JSON.parse(s); } catch (e) {
          var end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
          try { return JSON.parse(s.slice(0, end + 1)); } catch (e2) { throw { code: 'invalid_json', message: 'invalid JSON', text: t }; }
        }
      };
      sample.limits = async function () { return { maxPromptBytes: 262144, images: { maxCount: 4, maxInputBytes: 5 * 1024 * 1024, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } }; };
      ns.sample = sample;
    }
    return ns;
  }
  var nsP = ready.then(makeNamespaces);
  window.claude = { use: function (name) { return nsP.then(function (ns) { return ns[name] || null; }); } };
})();
