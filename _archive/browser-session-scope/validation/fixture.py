from http.server import BaseHTTPRequestHandler,SimpleHTTPRequestHandler,ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from threading import Thread
from secrets import token_urlsafe
static=Path(".dev/validation-66805ba/renderer").resolve()
class App(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(static),**kwargs)
 def do_GET(self):
  if not Path(self.translate_path(self.path)).is_file() and "." not in Path(urlsplit(self.path).path).name:self.path="/index.html"
  super().do_GET()
accounts={"northwind-qa":"Northwind tester","contoso-qa":"Contoso tester"}
sessions={}
class Site(BaseHTTPRequestHandler):
 def do_POST(self):
  key=parse_qs(self.rfile.read(int(self.headers.get('Content-Length','0'))).decode()).get("account",[""])[0]
  if key not in accounts:return self.send_error(400)
  sid=token_urlsafe();sessions[sid]=key
  self.send_response(303);self.send_header("Set-Cookie","session="+sid+"; HttpOnly; SameSite=Lax; Path=/");self.send_header("Location","/");self.end_headers()
 def do_GET(self):
  cookie=SimpleCookie(self.headers.get("Cookie",""));sid=cookie.get("session");key=sessions.get(sid.value if sid else "")
  content=("<h1>Account</h1><p>Signed in as <strong>"+accounts[key]+"</strong></p><p>"+key+"@example.test</p>" if key else "<h1>Sign in</h1><form method=post>"+''.join('<button name=account value="'+k+'">'+v+'</button>' for k,v in accounts.items())+"</form>")
  self.send_response(200);self.send_header("Content-Type","text/html; charset=utf-8");self.send_header("Cache-Control","no-store");self.end_headers()
  self.wfile.write(('<!doctype html><title>Account portal</title><style>body{font:17px system-ui;margin:0;color:#243747;background:#f6f9fb}header{background:#24495b;color:white;padding:20px 32px;font-weight:600}main{max-width:500px;background:white;border:1px solid #ccd7dd;border-radius:8px;margin:48px auto;padding:30px}h1{margin:0 0 24px}button{margin:4px;padding:10px}</style><header>Account portal</header><main>'+content+'</main>').encode())
Thread(target=ThreadingHTTPServer(("127.0.0.1",24769),Site).serve_forever,daemon=True).start()
ThreadingHTTPServer(("127.0.0.1",24768),App).serve_forever()
