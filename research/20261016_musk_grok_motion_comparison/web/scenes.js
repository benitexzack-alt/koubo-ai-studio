/*
 * adunext/adu-motion-video 源码改编；MIT 许可见 ../MIT上游许可.txt。
 * 延续 20261011 四个同原声对照中的三种候选动作，不改上游冻结包或生产模板。
 * 输入：SAMPLE_DATA 中本期原声词级时点；所有 update(t) 的 t 为窗口内相对秒。
 * 四个任务始终保留四个对象；结尾汇聚的是按需匹配流程，不是万能模型。
 * 末态跟随 DATA.durationFrames 保持，不提前淡出；末态底板在全画布 y=428 结束。
 */
(() => {
  const DATA = window.SAMPLE_DATA;
  if (!DATA) throw new Error('缺少本期实录时间数据');
  const START = DATA.startFrame / DATA.fps;
  const wordAt = index => {
    const word = DATA.words.find(item => item.sourceWordIndex === index);
    if (!word) throw new Error(`缺少本期词级索引：${index}`);
    return Math.max(0, word.start - START);
  };
  const eventAt = id => {
    const event = DATA.events.find(item => item.id === id);
    if (!event) throw new Error(`缺少本期事件：${id}`);
    return (event.frame - DATA.startFrame) / DATA.fps;
  };
  const WORDS = ['画图', '写代码', '复杂推理', '业务文档'];
  const CUES = [384, 396, 399, 411].map(wordAt);
  const T = {
    negative: wordAt(429),
    consolidate: eventAt('match-business'),
    call: wordAt(452),
    match: wordAt(456),
    end: DATA.durationFrames / DATA.fps,
  };
  const COLOR = { white: '#F8FAFC', blue: '#68B9FF', yellow: '#FFE36D' };
  const FONT = "Motion,'PingFang SC',sans-serif";
  const smooth = (t, a, b) => MOTION.at(t, a, b);
  const STABLE_IDS = ['task-image', 'task-code', 'task-reasoning', 'task-document'];

  function create(parent, styleId, mechanism) {
    const root = mk(parent, '', 64, 96, {
      style: 'position:absolute;width:660px;height:414px;overflow:hidden;pointer-events:none;isolation:isolate;',
    });
    const copies = [];
    const objects = [];
    const node = (html, x, y, width, height, opts = {}, target = root) => mk(target, html, x, y, {
      ...opts,
      style: `position:absolute;width:${width}px;height:${height}px;${opts.style || ''}`,
    });
    const box = (x, y, width, height, extra = '', target = root) => node('', x, y, width, height, {
      style: `box-sizing:border-box;border-radius:18px;background:rgba(13,26,44,.38);${extra}`,
    }, target);
    const text = (value, x, y, size = 60, color = COLOR.white, center = false, target = root) => {
      const element = node('<span></span>', x, y, 0, size * 1.2, { ax: center ? .5 : 0 }, target);
      element.firstElementChild.textContent = value;
      Object.assign(element.firstElementChild.style, {
        display: 'inline-block', whiteSpace: 'nowrap', fontFamily: FONT,
        fontWeight: '700', fontSize: `${size}px`, lineHeight: '1.15', letterSpacing: '1px',
        color, textShadow: '0 2px 7px rgba(0,0,0,.42)',
      });
      element.style.width = 'max-content';
      copies.push({ element, span: element.firstElementChild, value, size });
      return element;
    };
    const track = (id, element) => { objects.push({ id, element }); return element; };
    const effectiveOpacity = element => {
      let opacity = 1;
      for (let current = element; current && current !== parent.parentElement; current = current.parentElement) {
        const css = getComputedStyle(current);
        if (css.display === 'none' || css.visibility === 'hidden') return 0;
        opacity *= Number(css.opacity);
      }
      return opacity;
    };
    let lastTime = 0;
    function audit() {
      const texts = copies.flatMap(({ element, span, value, size }) => {
        const opacity = effectiveOpacity(element);
        if (opacity < .025) return [];
        const r = span.getBoundingClientRect();
        const actual = getComputedStyle(span);
        return [{ text: value, left: r.left, top: r.top, right: r.right, bottom: r.bottom,
          width: r.width, height: r.height, fontSize: parseFloat(actual.fontSize),
          declaredFontSize: size, fontFamily: actual.fontFamily, color: actual.color,
          clipPath: getComputedStyle(element).clipPath, opacity }];
      });
      const persistentObjects = objects.map(({ id, element }) => {
        const r = element.getBoundingClientRect();
        return { id, left: r.left, top: r.top, right: r.right, bottom: r.bottom,
          opacity: effectiveOpacity(element), transform: getComputedStyle(element).transform };
      });
      return {
        styleId, time: lastTime, sourceTime: START + lastTime,
        region: { left: 64, top: 96, right: 724, bottom: 510 },
        texts, mechanism, taskObjectCount: WORDS.length, persistentObjects,
        timing: { taskCues: CUES, negative: T.negative, consolidate: T.consolidate,
          call: T.call, match: T.match, end: T.end },
        finalHold: { from: T.match + .24, to: T.end,
          endFrameExclusive: DATA.endFrameExclusive, panelBottom: 428, maximumAllowedBottom: 436 },
        conclusionPolicy: '按需调用与匹配业务分别绑定实际词首；读稳至本窗口结束。',
      };
    }
    return { root, node, box, text, track, audit, tick(t) { lastTime = t; place(root, { o: 1 }); } };
  }

  function labels(c) {
    const title = c.text('各有所长', 330, 18, 60, COLOR.white, true);
    const negative = c.text('不是买最强模型', 330, 24, 46, COLOR.white, true);
    const call = c.text('按需调用', 330, 145, 60, COLOR.yellow, true);
    const match = c.text('匹配业务', 330, 225, 60, COLOR.yellow, true);
    [title, negative, call, match].forEach(element => { element.style.zIndex = '5'; });
    function update(t, useMask = false) {
      const initial = smooth(t, 0, .3);
      const beforeNegative = 1 - smooth(t, T.negative - .28, T.negative);
      const negOn = smooth(t, T.negative, T.negative + .24);
      const negOff = 1 - smooth(t, T.consolidate, T.consolidate + .28);
      const callOn = smooth(t, T.call, T.call + .24);
      const matchOn = smooth(t, T.match, T.match + .24);
      place(title, { y: 18 + 12 * (1 - initial), o: initial * beforeNegative });
      place(negative, { y: 24 + 12 * (1 - negOn), o: negOn * negOff });
      place(call, { y: 145 + 12 * (1 - callOn), o: callOn });
      place(match, { y: 225 + 12 * (1 - matchOn), o: matchOn });
      if (useMask) {
        title.style.clipPath = `inset(${(1 - initial) * 100}% 0 0 0)`;
        negative.style.clipPath = `inset(${(1 - negOn) * 100}% 0 0 0)`;
        call.style.clipPath = `inset(${(1 - callOn) * 100}% 0 0 0)`;
        match.style.clipPath = `inset(${(1 - matchOn) * 100}% 0 0 0)`;
      }
    }
    return { update };
  }

  function continuous(parent) {
    /* 来源：continuous-performance/1.0.0/units/claim-into-container.js:48–54。
     * 保留同一容器伸展、四路错峰和 MOTION.bezier 分支接力与汇聚；
     * 相对时间由本期词级锚点重绑，不将旧 13 秒时间轴线性拉伸。
     */
    const c = create(parent, 'continuous', ['同一容器随任务逐级展开', '四路贝塞尔分支接力', '原任务条汇聚为匹配流程']);
    const vessel = c.track('persistent-vessel', c.box(155, 4, 350, 92, 'border:1px solid rgba(104,185,255,.42);'));
    const header = labels(c);
    const branchRoot = c.node(`<svg width="660" height="410" viewBox="0 0 660 410" style="overflow:visible">${WORDS.map((_, i) => `<path d="M330 88 C80 88 22 ${102 + i * 70} 31 ${139 + i * 70}" fill="none" stroke="${COLOR.blue}" stroke-width="2.5" opacity=".55"/>`).join('')}</svg>`, 0, 0, 660, 410);
    const branches = [...branchRoot.querySelectorAll('path')];
    const rows = WORDS.map((word, i) => ({
      body: c.track(STABLE_IDS[i], c.box(42, 110 + i * 70, 576, 60, 'background:rgba(35,72,110,.38);border:1px solid rgba(104,185,255,.35);')),
      label: c.text(word, 80, 113 + i * 70, 46),
      dot: c.node('', 31, 139 + i * 70, 8, 8, { ax: .5, ay: .5, style: `border-radius:50%;background:${COLOR.blue};` }),
    }));
    function update(t) {
      c.tick(t);
      const appear = smooth(t, 0, .3);
      const open = smooth(t, CUES[0], CUES[0] + .5);
      const merge = smooth(t, T.consolidate, T.call + .24);
      const expandedHeight = 92 + CUES.reduce((height, cue) => height + 77 * smooth(t, cue, cue + .5), 0);
      vessel.style.width = `${lerp(350, 644, open)}px`;
      vessel.style.height = `${lerp(expandedHeight, 228, merge)}px`;
      place(vessel, { x: lerp(155, 8, open), y: lerp(4, 104, merge), o: appear });
      place(branchRoot, { o: open * (1 - smooth(t, T.consolidate, T.consolidate + .32)) });
      rows.forEach(({ body, label, dot }, i) => {
        const on = smooth(t, CUES[i], CUES[i] + .34);
        const flight = smooth(t, CUES[i], CUES[i] + .56);
        const labelOut = 1 - smooth(t, T.consolidate, T.consolidate + .25);
        const gather = smooth(t, T.consolidate + .14 + i * .035, T.call + .24 + i * .035);
        const xy = MOTION.bezier([42, 110 + i * 70], [64 + i * 20, 116 + i * 50], [118, 142 + i * 30], [42, 142 + i * 42], gather);
        body.style.height = `${lerp(60, 10, gather)}px`;
        place(body, { x: xy[0], y: xy[1] + 12 * (1 - on), o: on * (1 - smooth(t, T.call - .03, T.call + .28)) });
        place(label, { y: 113 + i * 70 + 12 * (1 - on), o: on * labelOut });
        const dotXY = MOTION.bezier([330, 88], [80, 88], [22, 102 + i * 70], [31, 139 + i * 70], flight);
        place(dot, { x: dotXY[0], y: dotXY[1], o: on * (1 - smooth(t, T.consolidate, T.consolidate + .28)) });
        MOTION.stroke(branches[i], flight);
      });
      header.update(t);
    }
    update(0);
    return { update, audit: c.audit };
  }

  function stage(parent) {
    /* 来源：stage-performance/1.0.0/units/decompose-and-consolidate.js:10、35–39。
     * 保留 perspective/rotateY、错峰聚焦与原面板归拢；四任务改为 2×2，
     * 文字和承载卡作为同一对象转动，46px 字号不缩小，真人与相机由外层掌管。
     */
    const c = create(parent, 'stage', ['四张原卡分组登台', '透视转动逐项聚焦', '原卡去透视后归拢']);
    const back = c.track('persistent-stage', c.box(8, 4, 644, 400, 'background:rgba(13,26,44,.32);'));
    const header = labels(c);
    const floor = c.node('', 22, 393, 616, 2, { style: 'background:linear-gradient(90deg,transparent,rgba(104,185,255,.7),transparent);' });
    const panels = WORDS.map((word, i) => {
      const x = i % 2 === 0 ? 18 : 338;
      const y = i < 2 ? 112 : 254;
      const group = c.track(STABLE_IDS[i], c.node('', x, y, 304, 116));
      const body = c.box(0, 0, 304, 116, 'background:rgba(22,49,76,.56);border:1px solid rgba(104,185,255,.43);', group);
      const label = c.text(word, 152, 30, 46, COLOR.white, true, group);
      return { group, body, label, x, y };
    });
    const depth = (element, state) => {
      place(element, state);
      element.style.transform += ` perspective(1600px) rotateY(${state.ry.toFixed(3)}deg)`;
      element.style.zIndex = String(state.z);
    };
    function update(t) {
      c.tick(t);
      const appear = smooth(t, 0, .3);
      const merge = smooth(t, T.consolidate, T.call + .24);
      back.style.height = `${lerp(400, 228, merge)}px`;
      place(back, { y: lerp(4, 104, merge), o: appear });
      place(floor, { sx: appear, o: appear * (1 - smooth(t, T.consolidate, T.call)) });
      panels.forEach(({ group, body, label, x, y }, i) => {
        const on = smooth(t, CUES[i], CUES[i] + .4);
        const settle = EZ.spring(pr(t, CUES[i], CUES[i] + .56));
        const recede = i < CUES.length - 1 ? smooth(t, CUES[i + 1], CUES[i + 1] + .36) : 0;
        const fold = smooth(t, T.consolidate + i * .035, T.call + .22 + i * .035);
        const labelOut = 1 - smooth(t, T.consolidate, T.consolidate + .24);
        const side = i % 2 === 0 ? -1 : 1;
        const focusY = -8 * on + 14 * recede;
        const targetY = 150 + (i < 2 ? 0 : 86);
        depth(group, { x: lerp(x, i % 2 === 0 ? 22 : 334, fold),
          y: lerp(y + 22 * (1 - settle) + focusY, targetY, fold),
          ry: side * (15 * (1 - on) + 8 * recede) * (1 - fold),
          o: on * (1 - smooth(t, T.call - .02, T.call + .26)), z: 2 + i });
        body.style.height = `${lerp(116, 64, fold)}px`;
        body.style.background = `rgba(22,49,76,${lerp(.70, .43, recede)})`;
        place(body, { o: 1 });
        place(label, { o: labelOut });
      });
      header.update(t);
    }
    update(0);
    return { update, audit: c.audit };
  }

  function editorial(parent) {
    /* 来源：editorial-performance/1.0.0/units/decompose-and-consolidate.js:8–9、27–29。
     * 保留 cap 遮罩、rule 生长、四条压合归页；只改本期词级时间和四行布局。
     * 同一纸页收拢为结果页，不引入全屏白板、不移动真人、不复制旧字幕。
     */
    const c = create(parent, 'editorial', ['逐行遮罩展开', '四条规则线按语义生长', '原纸页与规则线归页']);
    const sheet = c.track('persistent-sheet', c.box(8, 4, 644, 400, 'background:rgba(13,26,44,.38);border-radius:8px;'));
    const header = labels(c);
    const seam = c.node('', 38, 98, 580, 2, { style: `background:${COLOR.blue};transform-origin:left;` });
    const rows = WORDS.map((word, i) => ({
      label: c.text(word, 58, 110 + i * 70, 46),
      rule: c.track(STABLE_IDS[i], c.node('', 58, 171 + i * 70, 546, 2, { style: 'background:rgba(104,185,255,.72);' })),
      marker: c.node('', 36, 124 + i * 70, 4, 34, { style: `background:${COLOR.blue};border-radius:2px;` }),
    }));
    function update(t) {
      c.tick(t);
      const appear = smooth(t, 0, .3);
      const page = smooth(t, T.consolidate, T.call + .24);
      sheet.style.height = `${lerp(400, 228, page)}px`;
      sheet.style.borderRadius = `${lerp(8, 16, page)}px`;
      place(sheet, { y: lerp(4, 104, page), o: appear });
      place(seam, { sx: appear, o: appear * (1 - smooth(t, T.consolidate, T.consolidate + .32)) });
      seam.style.transformOrigin = 'left center';
      rows.forEach(({ label, rule, marker }, i) => {
        const on = smooth(t, CUES[i], CUES[i] + .38);
        const fold = smooth(t, T.consolidate + i * .04, T.call + .20 + i * .04);
        const out = 1 - smooth(t, T.consolidate, T.consolidate + .24);
        place(label, { y: 110 + i * 70 + 16 * (1 - on), o: on * out });
        label.style.clipPath = `inset(${(1 - on) * 100}% 0 0 0)`;
        place(rule, { x: 58 + 14 * fold, y: lerp(171 + i * 70, 304, fold),
          sx: smooth(t, CUES[i] + .10, CUES[i] + .68),
          o: on * (1 - smooth(t, T.call, T.call + .3)) });
        rule.style.transformOrigin = 'left center';
        place(marker, { sy: on, o: on * out });
      });
      header.update(t, true);
    }
    update(0);
    return { update, audit: c.audit };
  }

  window.buildMotion = (styleId, parent) => {
    const builders = { continuous, stage, editorial };
    if (!builders[styleId]) throw new Error(`未知小样样式：${styleId}`);
    return builders[styleId](parent);
  };
})();
