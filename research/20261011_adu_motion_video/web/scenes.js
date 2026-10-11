/*
 * adu-motion-video 源码改编实验，仅供本轮历史口播小样。
 * 不是完整 macro 镜头组复刻，不修改上游冻结包或现行口播模板。
 * 依赖：上游 lib.js 的 clamp/lerp/pr/EZ/mk/place，以及 motion.js 的 MOTION。
 * 实录窗口：156.2–169.933333 秒；所有 t 均为此窗口内的相对秒。
 * 词级依据：字幕候选_R2/transcript.r2.json 的 words[].start / text。
 */
(() => {
  const WORDS = ['岗位体系', '决策流程', '考核方式'];
  const CUES = [4.34, 5.18, 6.46];
  const T = { person: 2.78, result: 8.80, leave: 12.60, end: 13.20 };
  const COLOR = { white: '#F8FAFC', blue: '#68B9FF', yellow: '#FFE36D', ink: '#142238' };
  const FONT = "Motion,'PingFang SC',sans-serif";
  const smooth = (t, a, b) => MOTION.at(t, a, b);
  const fade = t => 1 - smooth(t, T.leave, T.end);

  function create(parent, styleId) {
    const root = mk(parent, '', 64, 96, {
      style: 'position:absolute;width:660px;height:414px;overflow:hidden;pointer-events:none;isolation:isolate;',
    });
    const copies = [];
    const node = (html, x, y, width, height, opts = {}) => mk(root, html, x, y, {
      ...opts,
      style: `position:absolute;width:${width}px;height:${height}px;${opts.style || ''}`,
    });
    const box = (x, y, width, height, extra = '') => node('', x, y, width, height, {
      style: `box-sizing:border-box;border-radius:18px;background:rgba(13,26,44,.36);${extra}`,
    });
    const text = (value, x, y, size = 60, color = COLOR.white, center = false) => {
      const element = node(`<span>${value}</span>`, x, y, 0, size * 1.2, { ax: center ? .5 : 0 });
      // Assign CSS through the DOM: font-family quotes cannot break HTML attributes.
      Object.assign(element.firstElementChild.style, {
        display: 'inline-block', whiteSpace: 'nowrap', fontFamily: FONT,
        fontWeight: '700', fontSize: `${size}px`, lineHeight: '1.15',
        letterSpacing: '1px', color, textShadow: '0 2px 7px rgba(0,0,0,.42)',
      });
      // Width is explicit so the upstream percentage anchor centers real text.
      element.style.width = 'max-content';
      copies.push({ element, span: element.firstElementChild, value, size });
      return element;
    };
    let lastTime = 0;
    function audit() {
      const texts = copies.flatMap(({ element, span, value, size }) => {
        let opacity = 1;
        for (let current = element; current && current !== parent.parentElement; current = current.parentElement) {
          const css = getComputedStyle(current);
          if (css.display === 'none' || css.visibility === 'hidden') return [];
          opacity *= Number(css.opacity);
        }
        if (opacity < .025) return [];
        const r = span.getBoundingClientRect();
        const actual = getComputedStyle(span);
        return [{ text: value, left: r.left, top: r.top, right: r.right, bottom: r.bottom,
          width: r.width, height: r.height, fontSize: parseFloat(actual.fontSize),
          declaredFontSize: size, fontFamily: actual.fontFamily, color: actual.color, opacity }];
      });
      return { styleId, time: lastTime, region: { left: 64, top: 96, right: 724, bottom: 455 }, texts };
    }
    return { root, node, box, text, audit, tick(t) { lastTime = t; place(root, { o: fade(t) }); } };
  }

  function continuous(parent) {
    /* 来源：packs/continuous-performance/1.0.0/units/claim-into-container.js:48–54
     * 保留同一容器伸展、节点错峰和 MOTION.bezier 的三路接力；重写尺寸与语义时钟。
     * motion.js:3–8 保留绝对时间平滑曲线、贝塞尔公式；没有全组线性加速。
     */
    const c = create(parent, 'continuous');
    const vessel = c.box(155, 4, 350, 92, 'border:1px solid rgba(104,185,255,.42);');
    const main = c.text('人＋AI', 330, 19, 60, COLOR.white, true);
    const rails = c.node('<svg width="660" height="354" viewBox="0 0 660 354" style="overflow:visible"><path d="M330 90 L330 120 M330 120 Q30 120 30 147 M330 120 Q30 120 30 223 M330 120 Q30 120 30 299" fill="none" stroke="#68B9FF" stroke-width="2.5" opacity=".55"/></svg>', 0, 0, 660, 354);
    const rows = WORDS.map((word, i) => ({
      body: c.box(42, 114 + i * 76, 576, 64, 'background:rgba(35,72,110,.34);border:1px solid rgba(104,185,255,.35);'),
      label: c.text(word, 80, 120 + i * 76, 46, COLOR.white),
      dot: c.node('', 31, 146 + i * 76, 8, 8, { ax: .5, ay: .5, style: `border-radius:50%;background:${COLOR.blue};` }),
    }));
    const result = c.text('组织升级', 330, 155, 60, COLOR.yellow, true);
    function update(t) {
      c.tick(t);
      const appear = smooth(t, T.person, T.person + .32);
      const open = smooth(t, CUES[0], CUES[0] + .52);
      const merge = smooth(t, 8.32, 8.94);
      vessel.style.width = `${lerp(350, 644, open)}px`;
      vessel.style.height = `${lerp(92, lerp(350, 124, merge), open)}px`;
      vessel.style.background = `rgba(13,26,44,${lerp(.32, .46, merge)})`;
      place(vessel, { x: lerp(155, 8, open), y: lerp(4, 128, merge), o: appear });
      place(main, { y: 19 + 15 * (1 - appear), o: appear * (1 - smooth(t, 8.32, 8.67)) });
      place(rails, { o: open * (1 - smooth(t, 8.20, 8.52)) });
      rows.forEach(({ body, label, dot }, i) => {
        const on = smooth(t, CUES[i], CUES[i] + .34);
        const labelOut = 1 - smooth(t, 8.26 + i * .06, 8.54 + i * .06);
        const gather = smooth(t, 8.44 + i * .06, 8.96 + i * .06);
        const xy = MOTION.bezier([42, 114 + i * 76], [68 + i * 30, 110 + i * 54], [165, 152], [42, 154], gather);
        // The persistent strips merge at full scale; text fades before overlap.
        place(body, { x: xy[0], y: xy[1] + 15 * (1 - on), o: on * (1 - smooth(t, 8.73 + i * .04, 9.07 + i * .04)) });
        place(label, { y: 120 + i * 76 + 15 * (1 - on), o: on * labelOut });
        const flight = smooth(t, CUES[i], CUES[i] + .55);
        const dotXY = MOTION.bezier([330, 95], [110, 95], [31, 105 + i * 76], [31, 146 + i * 76], flight);
        place(dot, { x: dotXY[0], y: dotXY[1], o: on * (1 - smooth(t, 8.23, 8.56)) });
      });
      const done = smooth(t, T.result, T.result + .28);
      place(result, { y: 155 + 15 * (1 - done), o: done });
    }
    update(0);
    return { update, audit: c.audit };
  }

  function stage(parent) {
    /* 来源：packs/stage-performance/1.0.0/units/decompose-and-consolidate.js:10、35–39
     * 保留 depth 的 perspective/rotateY、三面板错峰及聚拢路径。
     * 本轮局部改编保持文字原字号、固定真人位置，移除全景舞台与相机移动。
     */
    const c = create(parent, 'stage');
    const back = c.box(8, 4, 644, 348, 'background:rgba(13,26,44,.28);');
    const title = c.text('人＋AI', 330, 20, 60, COLOR.white, true);
    const floor = c.node('', 22, 316, 616, 2, { style: 'background:linear-gradient(90deg,transparent,rgba(104,185,255,.7),transparent);' });
    const panels = WORDS.map((word, i) => ({
      body: c.box(18 + i * 211, 159, 202, 125, `background:rgba(${i === 1 ? '47,83,119,.60' : '22,49,76,.55'});border:1px solid rgba(104,185,255,.43);`),
      label: c.text(word, 119 + i * 211, 192, 44, COLOR.white, true),
    }));
    panels.forEach(({ label }) => { label.style.zIndex = '3'; });
    const result = c.text('组织升级', 330, 180, 60, COLOR.yellow, true);
    // Direct adaptation of upstream depth(): place first, append perspective second.
    const depth = (element, state) => {
      place(element, state);
      element.style.transform += ` perspective(1600px) rotateY(${(state.ry || 0).toFixed(3)}deg)`;
      element.style.zIndex = String(state.z || 0);
    };
    function update(t) {
      c.tick(t);
      const appear = smooth(t, T.person, T.person + .35);
      place(back, { o: appear });
      place(title, { y: 20 + 18 * (1 - appear), o: appear * (1 - smooth(t, 8.30, 8.66)) });
      place(floor, { sx: appear, o: appear * (1 - smooth(t, 8.40, 8.80)) });
      panels.forEach(({ body, label }, i) => {
        const on = smooth(t, CUES[i], CUES[i] + .44);
        const settle = EZ.spring(pr(t, CUES[i], CUES[i] + .58));
        const fold = smooth(t, 8.37 + i * .06, 8.97 + i * .06);
        const labelOut = 1 - smooth(t, 8.27 + i * .04, 8.55 + i * .04);
        const recede = i < CUES.length - 1 ? smooth(t, CUES[i + 1], CUES[i + 1] + .38) : 0;
        const focusY = (-8 * on + 20 * recede) * (1 - fold);
        const expansion = i === 1 ? smooth(t, 8.64, 9.06) : 0;
        body.style.width = `${lerp(202, 608, expansion)}px`;
        body.style.height = `${lerp(125, 142, expansion)}px`;
        depth(body, { x: lerp(lerp(18 + i * 211, 229, fold), 26, expansion),
          y: 159 + 29 * (1 - settle) - 11 * fold + focusY,
          ry: ((i - 1) * 4 + (i === 0 ? -3 : 3) * recede) * (1 - fold),
          o: on * (i === 1 ? 1 : 1 - smooth(t, 8.73, 9.10)), z: i === 1 ? 2 : 1 });
        place(label, { y: 192 + 29 * (1 - settle) + focusY, o: on * labelOut });
      });
      const done = smooth(t, T.result, T.result + .30);
      place(result, { y: 180 + 14 * (1 - done), o: done });
      result.style.zIndex = '4';
    }
    update(0);
    return { update, audit: c.audit };
  }

  function editorial(parent) {
    /* 来源：packs/editorial-performance/1.0.0/units/decompose-and-consolidate.js:8–9、27–29
     * 保留 cap 遮罩、rule 线条生长、三条压合再归页；重排为左上透明局部。
     * 不复刻源版左右全屏分栏，不移动真人、不加入全屏白色底板。
     */
    const c = create(parent, 'editorial');
    const sheet = c.box(8, 4, 644, 348, 'background:rgba(13,26,44,.34);border-radius:8px;');
    const title = c.text('人＋AI', 38, 19, 60, COLOR.white);
    const seam = c.node('', 38, 99, 580, 2, { style: `background:${COLOR.blue};transform-origin:left;` });
    const rows = WORDS.map((word, i) => ({
      label: c.text(word, 58, 116 + i * 74, 46, COLOR.white),
      rule: c.node('', 58, 177 + i * 74, 546, 2, { style: 'background:rgba(104,185,255,.72);' }),
      marker: c.node('', 36, 128 + i * 74, 4, 34, { style: `background:${COLOR.blue};border-radius:2px;` }),
    }));
    const result = c.text('组织升级', 330, 158, 60, COLOR.yellow, true);
    function update(t) {
      c.tick(t);
      const appear = smooth(t, T.person, T.person + .36);
      const page = smooth(t, 8.47, 9.06);
      sheet.style.height = `${lerp(348, 150, page)}px`;
      sheet.style.borderRadius = `${lerp(8, 16, page)}px`;
      place(sheet, { y: lerp(4, 123, page), o: appear });
      place(title, { y: 19 + 22 * (1 - appear), o: appear * (1 - smooth(t, 8.27, 8.61)) });
      title.style.clipPath = `inset(${(1 - appear) * 100}% 0 0 0)`;
      place(seam, { sx: appear, o: appear * (1 - smooth(t, 8.34, 8.73)) });
      rows.forEach(({ label, rule, marker }, i) => {
        const on = smooth(t, CUES[i], CUES[i] + .38);
        const fold = smooth(t, 8.34 + i * .08, 8.91 + i * .06);
        const out = 1 - smooth(t, 8.28 + i * .04, 8.57 + i * .04);
        place(label, { y: 116 + i * 74 + 22 * (1 - on), o: on * out });
        label.style.clipPath = `inset(${(1 - on) * 100}% 0 0 0)`;
        // The same three rules travel into the final page; labels never shrink.
        place(rule, { x: 58 + 14 * fold, y: lerp(177 + i * 74, 249, fold),
          sx: smooth(t, CUES[i] + .12, CUES[i] + .72), o: on * (1 - smooth(t, 8.81, 9.13)) });
        rule.style.transformOrigin = 'left center';
        place(marker, { sy: on, o: on * out });
      });
      const done = smooth(t, T.result, T.result + .32);
      place(result, { y: 158 + 18 * (1 - done), o: done });
      result.style.clipPath = `inset(${(1 - done) * 100}% 0 0 0)`;
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
