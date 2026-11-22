# يبني index.html (النسخة المستقلة) من claude-artifact/app.html (نسخة Claude).
# الاستخدام: python3 tools/build_standalone.py
import re
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+'/'

src=open(ROOT+'claude-artifact/app.html').read()
i=src.index('<div id="app"></div>')
head_part=src[:i];body_part=src[i:]
head_part=head_part.replace('<title>متابعة المارشندايزر</title>','<title>متابعة المناديب – القرية</title>')
extra_css="""
#auth{position:fixed;inset:0;z-index:100;background:var(--bg);overflow-y:auto}
.auth-wrap{min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px max(16px,env(safe-area-inset-left,0px))}
.auth-card{width:100%;max-width:400px;align-items:stretch;text-align:start}
.auth-card .redlogo{align-self:center}.auth-card .slogan{align-self:center;margin-top:-6px}
</style>"""
head_part=head_part.replace('</style>',extra_css,1)
reset=":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px}img{max-width:100%}[hidden]{display:none!important}"
doc=f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#AC1F23">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="مناديب القرية">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/favicon-64.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>{reset}</style>
{head_part}</head>
<body>
"""
body_part=body_part.replace('<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.umd.js"></script>',
 '<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.umd.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"></script>\n<script src="config.js"></script>\n<script src="runtime.js"></script>')
body_part+="""
<script>if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}</script>
</body>
</html>
"""
open(ROOT+'index.html','w').write(doc+body_part)
print(len(doc+body_part))
