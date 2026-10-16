#!/usr/bin/env python3
"""本期观看副本只读复核；不升级受控导出或人工验收状态。"""
from pathlib import Path
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import numpy as np

qa = Path(__file__).resolve().parent
episode = qa.parents[1]
receipt_path = qa / '内部观看副本校时回执.v1.json'
receipt = json.loads(receipt_path.read_text())
parent = Path(receipt['parent']['path'])
video = Path(receipt['output']['path'])
voice = episode / '05_后期工程/public/audio/voice.m4a'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def pcm(path):
    return np.frombuffer(subprocess.check_output([
        'ffmpeg', '-v', 'error', '-nostdin', '-i', str(path),
        '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'
    ]), dtype='<f4')

def packets(path, stream):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', stream, '-show_packets',
        '-show_data_hash', 'sha256', '-show_entries',
        'packet=pts_time,dts_time,duration_time,size,data_hash', '-of', 'json', str(path)
    ]))['packets']

assert sha(parent) == receipt['parent']['sha256']
assert sha(video) == receipt['output']['sha256']
controlled_path = Path(receipt['parent']['controlledReceipt'])
controlled = json.loads(controlled_path.read_text())
assert controlled['output']['sha256'] == sha(parent)
claim = Path(controlled['outputClaim']['path'])
assert sha(claim) == controlled['outputClaim']['sha256']
receipt['parent']['controlledReceiptSha256'] = sha(controlled_path)
receipt['parent']['outputClaim'] = {'path': str(claim), 'sha256': sha(claim)}
receipt['tool'] = {'path': str(Path(shutil.which('ffmpeg')).resolve())}
receipt['tool']['sha256'] = sha(Path(receipt['tool']['path']))
packet_checks = []
for stream in ['v:0', 'a:0']:
    a, b = packets(parent, stream), packets(video, stream)
    offsets = [round(float(y['pts_time']) - float(x['pts_time']), 6) for x, y in zip(a, b)]
    packet_checks.append({
        'stream': stream, 'parentCount': len(a), 'viewingCount': len(b),
        'allPacketDataIdentical': [x['data_hash'] for x in a] == [x['data_hash'] for x in b],
        'ptsOffsetSecondsRange': [min(offsets), max(offsets)],
        'dtsOffsetSecondsRange': [min(float(y['dts_time']) - float(x['dts_time']) for x,y in zip(a,b)), max(float(y['dts_time']) - float(x['dts_time']) for x,y in zip(a,b))]
    })
a, b = pcm(voice), pcm(video)
windows = []
for start, end in [(14,17),(36.8,39.8),(80,82),(137.7,140),(165,167.8)]:
    x = a[round(start*16000):round(end*16000)].astype('float64')
    y = b[round(start*16000):round(end*16000)].astype('float64')
    x -= x.mean(); y -= y.mean()
    n = 1 << (len(x) + len(y) - 2).bit_length()
    c = np.fft.irfft(np.conj(np.fft.rfft(x,n)) * np.fft.rfft(y,n),n)
    lags = np.arange(-3200,3201)
    lag = int(lags[np.argmax(c[lags % n])])
    windows.append({'startSeconds': start, 'endSeconds': end, 'lagMs': lag/16,
        'sameTimestampCorrelation': float(np.corrcoef(x,y)[0,1]),
        'rmsGain': float(np.sqrt(np.mean(y*y)/np.mean(x*x)))})
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]))
command = ['ffmpeg','-hide_banner','-nostdin','-i',str(video),'-vf','blackdetect=d=0.15:pix_th=0.08','-af','silencedetect=n=-50dB:d=0.5,ebur128=peak=true','-f','null','-']
decode = subprocess.run(command, capture_output=True, text=True)
(qa/'观看副本全解码.log').write_text(decode.stderr)
v = next(x for x in probe['streams'] if x['codec_type']=='video')
black = re.findall(r'black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)',decode.stderr)
report = {'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'file':str(video),'sha256':sha(video),'parentSha256':sha(parent),
    'controlledDirectOutput':False,'derivativeReceipt':str(receipt_path),
    'decodeExitCode':decode.returncode,'videoFrames':int(v['nb_frames']),
    'width':v['width'],'height':v['height'],'fps':v['avg_frame_rate'],
    'durationSeconds':float(probe['format']['duration']),
    'blackWindows':black,'silenceWindows':re.findall(r'silence_end: ([\d.]+) \| silence_duration: ([\d.]+)',decode.stderr),
    'audioMeasurementSummary':decode.stderr.rsplit('Summary:',1)[-1].strip(),
    'packetChecks':packet_checks,'voiceWindows':windows,
    'normalSpeedFullWatchPerformed':False,'listeningAcceptancePerformed':False,
    'userAccepted':False,'formalRelease':False,'publishAuthorized':False}
report['technicalStructurePass'] = (decode.returncode==0 and int(v['nb_frames'])==5035
    and v['width']==1280 and v['height']==720 and not black
    and abs(float(probe['format']['duration'])-5035/30)<.1
    and all(x['allPacketDataIdentical'] for x in packet_checks)
    and all(abs(x['lagMs'])<1 and x['sameTimestampCorrelation']>.98 for x in windows))
receipt['fullDecodeVoiceWindows'] = windows
receipt['packetChecks'] = packet_checks
receipt['pass'] = report['technicalStructurePass']
receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
(qa/'观看副本技术检查.v1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(0 if report['technicalStructurePass'] else 1)
