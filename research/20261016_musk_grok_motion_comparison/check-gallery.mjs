import {chromium} from '../../remotion/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = ['00_现有动效_同原声对照.mp4', '01_连续形变.mp4', '02_纵深聚焦.mp4', '03_杂志展开.mp4'];
const report = {
  scope: '真实四版视频的本地网页、同时间切换与播放状态检查',
  url: 'http://127.0.0.1:5196/',
  expectedDuration: 26.9,
  humanAccepted: false,
  passed: false,
  items: [],
  pausedSwitches: [],
  playingSwitches: [],
  errors: [],
};
const missing = files.filter(file => {
  const filename = path.join(root, 'outputs', file);
  return !fs.existsSync(filename) || fs.statSync(filename).size === 0;
});
let browser;
try {
  if (missing.length) {
    report.status = 'waiting-for-rendered-media';
    report.missingFiles = missing;
    throw new Error('四版视频尚未全部就绪，未执行浏览器验证');
  }
  browser = await chromium.launch({
    executablePath: path.resolve(root, '../../.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
    headless: true,
  });
  const page = await browser.newPage({viewport: {width: 1440, height: 1080}});
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(report.url, {waitUntil: 'domcontentloaded'});
  const waitReady = async id => {
    await page.waitForFunction(({id, filename}) => {
      const video = document.getElementById('player');
      const button = document.querySelector(`button[data-index="${id}"]`);
      return video.readyState >= 2 && !video.seeking && video.dataset.loading !== 'true' &&
        decodeURIComponent(video.currentSrc).endsWith('/' + filename) && button.getAttribute('aria-pressed') === 'true';
    }, {id, filename: files[id]}, {timeout: 20000});
  };
  const state = () => page.evaluate(() => {
    const video = document.getElementById('player');
    return {
      name: document.getElementById('name').textContent,
      source: decodeURIComponent(video.currentSrc),
      duration: video.duration, width: video.videoWidth, height: video.videoHeight,
      time: video.currentTime, paused: video.paused, error: video.error?.message || null,
      selected: [...document.querySelectorAll('nav button[aria-pressed="true"]')].map(button => Number(button.dataset.index)),
      download: decodeURIComponent(document.getElementById('download').href),
    };
  });
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await waitReady(0);
  report.items.push(await state());

  for (const id of [1, 2, 3, 0]) {
    const target = 7.2 + id * .3;
    await page.evaluate(time => {
      const video = document.getElementById('player');
      video.pause(); video.currentTime = time;
    }, target);
    await page.waitForFunction(() => !document.getElementById('player').seeking);
    await page.locator(`button[data-index="${id}"]`).click();
    await waitReady(id);
    const actual = await state();
    report.pausedSwitches.push({id, expectedTime: target, actual});
    check(actual.paused && Math.abs(actual.time - target) <= 1 / 30, `暂停切换第${id}版未保留时间或状态`);
    check(actual.selected.length === 1 && actual.selected[0] === id, `第${id}版按钮状态不一致`);
    check(actual.download.endsWith('/' + files[id]), `第${id}版下载链接未同步`);
    if (id !== 0) report.items.push(actual);
  }

  for (const id of [1, 2, 3, 0]) {
    await page.evaluate(async () => {
      const video = document.getElementById('player');
      video.pause(); video.muted = true; video.currentTime = 12.5; await video.play();
    });
    const before = await state();
    await page.locator(`button[data-index="${id}"]`).click();
    await waitReady(id);
    await page.waitForFunction(() => !document.getElementById('player').paused);
    const after = await state();
    check(after.time >= before.time - .05 && after.time <= before.time + 1, `播放切换第${id}版时间跳变`);
    await page.waitForFunction(time => document.getElementById('player').currentTime > time + .12, after.time);
    const advanced = await state();
    report.playingSwitches.push({id, before, after, advancedTime: advanced.time});
    check(!advanced.paused && advanced.selected.length === 1 && advanced.selected[0] === id, `第${id}版切换后未继续播放`);
  }

  await page.evaluate(() => {
    const video = document.getElementById('player');
    video.pause(); video.currentTime = 8.75;
  });
  await page.waitForFunction(() => !document.getElementById('player').seeking);
  await page.evaluate(() => {
    for (const id of [1, 2, 3]) document.querySelector(`button[data-index="${id}"]`).click();
  });
  await waitReady(3);
  report.rapidSwitch = await state();
  check(report.rapidSwitch.paused && Math.abs(report.rapidSwitch.time - 8.75) <= 1 / 30, '连续快速切换丢失暂停位置');
  check(report.rapidSwitch.selected.length === 1 && report.rapidSwitch.selected[0] === 3, '快速切换后的最终按钮不一致');

  report.downloadLinks = await page.locator('.downloads a').evaluateAll(links => links.map(link => ({href: decodeURIComponent(link.href), download: link.hasAttribute('download')})));
  check(report.downloadLinks.length === 4 && report.downloadLinks.every((link, i) => link.download && link.href.endsWith('/' + files[i])), '四版下载入口不完整');
  await page.setViewportSize({width: 390, height: 844});
  report.mobile = await page.evaluate(() => ({
    viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    buttonHeights: [...document.querySelectorAll('nav button')].map(button => button.getBoundingClientRect().height),
  }));
  check(report.mobile.scrollWidth <= report.mobile.viewport && report.mobile.buttonHeights.every(height => height >= 44), '手机宽度或按钮高度不合格');
  check(report.items.length === 4 && report.items.every(item => !item.error && item.width === 1920 && item.height === 1080 && Math.abs(item.duration - 26.9) <= .05), '四版视频尺寸或时长不一致');
  check(report.errors.length === 0, '网页存在运行错误');
  report.status = 'browser-check-passed';
  report.passed = true;
} catch (error) {
  report.errors.push(error.message);
  if (!report.status) report.status = 'browser-check-failed';
} finally {
  if (browser) await browser.close();
}
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = missing.length ? 2 : 1;
