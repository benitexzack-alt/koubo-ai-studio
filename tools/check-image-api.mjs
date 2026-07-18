import fs from 'node:fs';

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
const merged = {...process.env, ...env};
const required = ['IMAGE_API_BASE_URL', 'IMAGE_API_KEY', 'IMAGE_MODEL'];
const missing = required.filter((name) => !merged[name]);
const safeUrl = (value) => {
  if (!value) {
    return '';
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && typeof parsed.url === 'string') {
      return parsed.url.replace(/\/$/, '');
    }
  } catch {
    // Not a JSON connection blob.
  }

  return String(value)
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
    .replace(/key["']?\s*:\s*["'][^"']+["']/gi, 'key:"***"');
};

if (missing.length > 0) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        status: 'missing-config',
        missing,
        next: '请在项目根目录的 .env 填入中转站生图 API。不要把 Key 发到聊天或写进代码。',
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

let baseUrl = merged.IMAGE_API_BASE_URL.replace(/\/$/, '');
try {
  const parsed = JSON.parse(merged.IMAGE_API_BASE_URL);
  if (parsed && typeof parsed === 'object') {
    if (typeof parsed.url === 'string') {
      baseUrl = parsed.url.replace(/\/$/, '');
    }
    if (!merged.IMAGE_API_KEY && typeof parsed.key === 'string') {
      merged.IMAGE_API_KEY = parsed.key;
    }
  }
} catch {
  // Plain URL.
}

if (!baseUrl.endsWith('/v1')) {
  baseUrl = `${baseUrl}/v1`;
}
const timeoutMs = Number(merged.IMAGE_API_TIMEOUT_MS || 120000);
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${merged.IMAGE_API_KEY}`,
    },
    signal: controller.signal,
  });

  const text = await response.text();
  console.log(
    JSON.stringify(
      {
        ok: response.ok,
        status: response.status,
        baseUrl: safeUrl(baseUrl),
        model: merged.IMAGE_MODEL,
        editModel: merged.IMAGE_EDIT_MODEL || null,
        note: response.ok
          ? '生图 API 鉴权入口可访问。下一步可接封面/图生图生成脚本。'
          : '已连到接口，但鉴权或路径可能不兼容；需要确认中转站是否支持 /models 或 OpenAI Images API。',
        sample: text.slice(0, 360),
      },
      null,
      2,
    ),
  );
  process.exit(response.ok ? 0 : 2);
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        status: 'request-failed',
        baseUrl: safeUrl(baseUrl),
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(2);
} finally {
  clearTimeout(timer);
}
