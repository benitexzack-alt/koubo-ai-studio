import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = new URL('..', import.meta.url);
const envPath = new URL('../.env', import.meta.url);

const parseEnv = (source) =>
  Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        if (index === -1) {
          return [line, ''];
        }

        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, '')];
      }),
  );

const env = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
const config = {...process.env, ...env};

const args = process.argv.slice(2);
const readArg = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }

  return args[index + 1] ?? fallback;
};

const hasArg = (name) => args.includes(`--${name}`);

const requireConfig = (name) => {
  if (!config[name]) {
    throw new Error(`${name} 未配置，请先填写 /Users/pc/Documents/口播/.env`);
  }

  return config[name];
};

const normalizeBaseUrl = (value) => {
  let baseUrl = value.replace(/\/$/, '');
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && typeof parsed.url === 'string') {
      baseUrl = parsed.url.replace(/\/$/, '');
      if (!config.IMAGE_API_KEY && typeof parsed.key === 'string') {
        config.IMAGE_API_KEY = parsed.key;
      }
    }
  } catch {
    // Plain URL.
  }

  return baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
};

const usage = () => {
  console.log(`用法:
node tools/generate-image.mjs --prompt "封面提示词" [--out outputs/generated/test.png] [--size 1024x1024]

常用参数:
  --prompt      必填，生图提示词
  --out         输出路径，默认 outputs/generated/image-时间戳.png
  --size        默认 1024x1024；竖版封面可用 1024x1536
  --model       默认读取 IMAGE_MODEL
  --quality     可选，默认不传；中转站支持时可填 low/medium/high/auto
  --dry-run     只打印脱敏后的请求概要，不调用 API
`);
};

if (hasArg('help') || hasArg('h')) {
  usage();
  process.exit(0);
}

const prompt = readArg('prompt');
if (!prompt) {
  usage();
  process.exit(1);
}

const baseUrl = normalizeBaseUrl(requireConfig('IMAGE_API_BASE_URL'));
const apiKey = requireConfig('IMAGE_API_KEY');
const model = readArg('model', config.IMAGE_MODEL || 'gpt-image-2');
const size = readArg('size', '1024x1024');
const quality = readArg('quality');
const timeoutMs = Number(config.IMAGE_API_TIMEOUT_MS || 120000);
const defaultOut = `outputs/generated/image-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
const outPath = path.resolve(fileURLToPath(projectRoot), readArg('out', defaultOut));

const requestBody = {
  model,
  prompt,
  size,
  n: 1,
};

if (quality) {
  requestBody.quality = quality;
}

const dryRunSummary = {
  endpoint: `${baseUrl}/images/generations`,
  model,
  size,
  quality: quality || null,
  outPath,
  promptChars: prompt.length,
};

if (hasArg('dry-run')) {
  console.log(JSON.stringify({ok: true, dryRun: true, ...dryRunSummary}, null, 2));
  process.exit(0);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

const decodeImageResponse = async (response) => {
  const json = await response.json();
  const item = json.data?.[0] ?? json;

  if (item.b64_json) {
    return Buffer.from(item.b64_json, 'base64');
  }

  if (item.url) {
    const imageResponse = await fetch(item.url);
    if (!imageResponse.ok) {
      throw new Error(`图片 URL 下载失败：HTTP ${imageResponse.status}`);
    }
    return Buffer.from(await imageResponse.arrayBuffer());
  }

  throw new Error(`未识别的生图返回结构：${JSON.stringify(json).slice(0, 500)}`);
};

try {
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`生图失败：HTTP ${response.status} ${text.slice(0, 500)}`);
  }

  const imageBuffer = await decodeImageResponse(response);
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, imageBuffer);

  console.log(
    JSON.stringify(
      {
        ok: true,
        model,
        size,
        outPath,
        bytes: imageBuffer.length,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        model,
        size,
        endpoint: `${baseUrl}/images/generations`,
        error: error instanceof Error ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***') : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(2);
} finally {
  clearTimeout(timer);
}
