from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import re
BASE=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(BASE),**kw)
 def send_head(self):
  path=Path(self.translate_path(self.path))
  if path.is_file() and self.headers.get('Range'):
   match=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers['Range'])
   if match:
    size=path.stat().st_size;start=int(match[1]);end=min(int(match[2]) if match[2] else size-1,size-1)
    if start>=size or end<start:self.send_error(416);return None
    f=path.open('rb');f.seek(start);self.send_response(206);self.send_header('Content-Type',self.guess_type(str(path)));self.send_header('Accept-Ranges','bytes');self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(end-start+1));self.end_headers();self.remaining=end-start+1;return f
  return super().send_head()
 def copyfile(self,source,output):
  if hasattr(self,'remaining'):
   left=self.remaining;del self.remaining
   while left:
    data=source.read(min(left,1024*1024))
    if not data:break
    output.write(data);left-=len(data)
  else:super().copyfile(source,output)
 def log_message(self,*a):pass
s=ThreadingHTTPServer(('127.0.0.1',0),Handler)
print(f'http://127.0.0.1:{s.server_port}/',flush=True)
s.serve_forever()
