import net from 'node:net';
import fs from 'node:fs';

const port = 54091;
const server = net.createServer(socket => socket.end('local-only'));
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
const result = {loopbackAllowed: false, otherLoopbackDenied: false, secretEnvironmentAbsent: false, secretFileDenied: false};
try {
  result.loopbackAllowed = await new Promise((resolve, reject) => {
    const socket = net.connect({host: '127.0.0.1', port}, () => { socket.end(); resolve(true); });
    socket.once('error', reject);
  });
  result.otherLoopbackDenied = await new Promise(resolve => {
    const socket = net.connect({host: '127.0.0.1', port: port + 2});
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', e => resolve(['EPERM', 'EACCES'].includes(e.code)));
    socket.setTimeout(1500, () => { socket.destroy(); resolve(false); });
  });
  result.secretEnvironmentAbsent = !Object.keys(process.env).some(k => /proxy|token|secret|api.key|authorization|node_options|codex|controlled_render/iu.test(k));
  try { fs.readFileSync(process.argv[2]); } catch (e) { result.secretFileDenied = ['EPERM', 'EACCES'].includes(e.code); }
} finally { await new Promise(resolve => server.close(resolve)); }
process.stdout.write(JSON.stringify(result) + '\n');
if (!Object.values(result).every(Boolean)) process.exitCode = 1;
