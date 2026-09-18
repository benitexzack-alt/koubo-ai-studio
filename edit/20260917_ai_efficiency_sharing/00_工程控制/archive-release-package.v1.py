from pathlib import Path
import os,json,hashlib,zipfile
ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/'edit/20260917_ai_efficiency_sharing'
PACKAGE=BASE/'09_发布包'
name='员工AI增效分配_V8_1080P_正式候选_v1.mp4'
source=BASE/'08_正式成片'/name
target=PACKAGE/name
if not target.exists():os.link(source,target)
assert source.stat().st_ino==target.stat().st_ino
files=sorted(p for p in PACKAGE.iterdir() if p.is_file() and p.suffix not in ['.zip'] and
  p.name not in ['交付文件清单.v1.json','正式交付校验.v1.json'] and not p.name.startswith('打包校验.'))
assert all(p.stat().st_size>0 for p in files),'交付文件不能为空'
validation=json.loads((PACKAGE/'正式交付校验.v2.json').read_text())
assert validation['ok'] is True and validation['fullWatchConfirmed'] is False
rows=[{'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
manifest=PACKAGE/'交付文件清单.v1.json'
manifest.write_text(json.dumps({'files':rows,'fullWatchConfirmed':False,'publishAuthorized':False},ensure_ascii=False,indent=2)+'\n')
archive=PACKAGE/'员工AI增效分配_正式成片与4比3发布包_v2.zip'
assert not archive.exists(),'禁止覆盖已交付压缩包'
with zipfile.ZipFile(archive,'w') as z:
    for p in files+[manifest]:z.write(p,p.name,compress_type=zipfile.ZIP_STORED if p.suffix=='.mp4' else zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for row in rows:assert hashlib.sha256(z.read(row['file'])).hexdigest()==row['sha256']
(PACKAGE/'打包校验.v2.json').write_text(json.dumps({'status':'passed','zip':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
  'bytes':archive.stat().st_size,'verifiedEntries':len(rows),'videoHardlinkedToCanonical':True},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':'archive-verified','entries':len(rows),'bytes':archive.stat().st_size},ensure_ascii=False))
