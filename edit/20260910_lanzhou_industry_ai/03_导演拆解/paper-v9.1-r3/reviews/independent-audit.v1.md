# r3 独立机制审计

- 审阅者：`01a07f11-6782-71b1-864f-e049ccb7ee20`；计划作者：`codex-parent-director`。
- 复核完成时间：`2026-09-10T14:48:23.101Z`。
- 结论：本期六镜未发现具体 P0/P1；仅为机制计划审阅，不是实际图片、人物手部轮廓、动态或正式验收。六份 review 的生成与正式授权均为 false。
- 当前未绑定输入：[director-request.unbound.v1.json](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r3/director-request.unbound.v1.json)。
- 当前输入 SHA-256：`e0eb0eb8a515c21a5fa3abf900a832632c0bda21b068d67b993063ebb7dafbae`。
- 原稿 SHA-256：`c1ebc6f3f9f82a405a1c7c7564097a62585601c31b3ee17edd07334695dcb3b9`。

## 变更范围

实际读取本条[用户确认原稿](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/00_文稿与控制/用户确认原稿.txt)全文22段，request全部spokenLine逐段严格相等。六镜均重新对照完整对应原句及机制。
B04/B10/B11/B15/B17去掉旧semanticReview后，完整scene（含提示词）与r2深比较相同。
B07仅增加projectionContract、派生四个sweptRect并重编同源两份提示词。原句、节点文字、对象、初终态、动作类型/顺序/时长、实体合同未变。
[revision-scope](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r3/revision-scope.v1.json)、[projection-derivation](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r3/projection-derivation.v1.json)与实际差异一致；[r2不可变输入清单](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r3/r2-immutable-signed-inputs.v1.json)列出的21文件SHA全部复核相同，未改历史产物。

## B07 独立验算

公式：X=76+3.4x，Y=400+2.8y-2.6z；单位毫米，画幅1920×1080。跨组体积包含2毫米物理净空；完整三维边界投影后四边再外扩4像素。

| 动作 | 三维边界 x / y / z，毫米 | 屏幕边界 left, top, right, bottom，像素 |
| --- | --- | --- |
| A1 | 53..227 / 116..144 / 20..26 | 252.2, 653.2, 851.8, 755.2 |
| A2 | 173..347 / 116..144 / 20..26 | 660.2, 653.2, 1259.8, 755.2 |
| A3 | 305..345 / 65..85 / 20..40 | 1109, 474, 1253, 590 |
| A4 | 293..467 / 116..144 / 20..26 | 1068.2, 653.2, 1667.8, 755.2 |

独立计算结果归一化后与四个当前sweptRect逐项一致；并与派生回执完整比较相等。A3使用40×20×20毫米完整声明旋转包络，不使用初态细杆轮廓。
动作区均在内容安全区内；三段slide底边755.2距安全区底边820.8为65.6像素，支承顶面投影底边766.4距安全区底边54.4像素。字幕区始于874.8像素，动作及支承不进入。
固定标签底边329.4，最低动作顶边A3=474，间距144.6像素。三段slide顶边653.2，与lever完整投影底边590相隔63.2像素，也不与owner参考投影相交。
纸叠唯一，G2/G3/G4接纸处初始空，三段滑动同高连续支承。核对动作在整理后、讲出去前，未演成AI自行批准或自动成交。四标签是初始流程工位，不代表动作已完成；300ms实录语义限制仍须后续重绑。
首帧及动作提示词分别与当前renderMotionFirstFrame/renderMotionPrompt严格相等，未附加自由关系。

## 真实验证与删除边界

- 原投影测试命令：`node skills/koubo-remotion-director/tests/test-paper-projection-contract.mjs`，本次运行130项通过；不引用其他代理未亲自执行的测试数。
- 六份review的路径、文件SHA、原句、task/revision、真实身份和mechanism SHA全部通过原validatePaperMeaningReview。
- 仅在内存为raw request附上六份引用后，validatePreproductionRequest返回`ok=true, errors=[]`；未输出编译产物或改request。
- 只删B07投影合同：`ok=false`，含`PAPER_PROJECTION_REQUIRED:B07`及机制SHA不匹配。
- 恢复r2旧动作区：`ok=false`，四个动作均报`PAPER_PROJECTION_ACTION_RECT_MISMATCH`。
- 挪标签进入A3，同时缩小自报sweptRect：`ok=false`，仍按真实派生范围报`PAPER_PROJECTION_ACTION_LABEL_OVERLAP:A3:B07`。
- 同时删必投影名单与投影合同，并在内存重编提示词：`ok=false`，由`PAPER_SEMANTIC_REVIEW_GRAPH_MISMATCH:B07`拒绝。
- 将A3改绑owner并重新派生及重编提示词：`ok=false`，由机制SHA、投影遮字和动作遮字三处拒绝。

## 明确保留的边界

**非本期P0/P1：策略字段不是自身不可删除。** 实际负例中只删`policy.projectionRequiredBeatIds`返回`ok=true, errors=[]`。原因见[preproduction-director-core.mjs:904](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/preproduction-director-core.mjs:904)：名单未配置时不作覆盖检查。但B07现存投影合同仍被无条件校验；同时删除合同会改变已审snapshot而失败。因此当前完整输入未绕过投影，不应宣称该字段单独不可删除。后续若要锁定“必须投影的镜头名单”本身，可把名单纳入独立审阅范围摘要或受信任revision策略；本轮未修改代码。

**局部完整包络是受审声明，不是求解出的旋转轨迹。** [paper-projection-contract.mjs:75](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/paper-projection-contract.mjs:75)确认动作及障碍ID存在和覆盖，未从转轴、角度计算真实运动；本期人工核对A3绑定的是完整杆件包络。不得用此局部声明代替动态验收。

**owner不是实际轮廓。** owner参考投影边界为[1058,192,1253,506]，与第三标签预留区及A3投影存在交叉。按[模块第143行](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/paper-projection-contract.mjs:143)约定，这不单凭AABB判定真实碰撞或遮挡，也绝不表示无遮挡通过；真实人物/手部轮廓、前后层次、文字可读性及全旋转过程须另行看图和抽帧。
其余五镜未配置projectionContract，不属于本次毫米到屏幕联验范围。所有镜头保留实录重绑、300ms视觉语义检查、真实首帧及正常速度动态验收，不能从本报告晋级生产或媒体通过。

## 六份审阅文件

- [B04-mechanism-review.v1.json](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r3/reviews/B04-mechanism-review.v1.json)：`5feb14a0ad4e3866bb1c765792a3cd54ce1a8955e6707dbad9f965bacca86a00`
- [B07-mechanism-review.v1.json](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r3/reviews/B07-mechanism-review.v1.json)：`352a3dad0505a478c2d16dc64817597c3b0d0fb38918dddf253a68d4d1576c5b`
- [B10-mechanism-review.v1.json](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r3/reviews/B10-mechanism-review.v1.json)：`1a2583268bf379dd000e1e7492194ac816bdf2195acb41a2203c78b033364334`
- [B11-mechanism-review.v1.json](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r3/reviews/B11-mechanism-review.v1.json)：`a10cd193b3dc8877405f71bfc3eba58e0905b282f4301ae7bcda064f64b9a9be`
- [B15-mechanism-review.v1.json](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r3/reviews/B15-mechanism-review.v1.json)：`e8f5b575e023cd44e73384b79303f29c822b5dee5bf7f58df1f25851b67a2048`
- [B17-mechanism-review.v1.json](/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r3/reviews/B17-mechanism-review.v1.json)：`645846300a6342bda82898e1a053eaeb2ceac0e1b3c2eda732bdca8611247a96`

本次校验对应代码SHA：
- `paper-projection-contract.mjs`：`460134beffb642c59ebac5c3aa00f4c49a9a970702aa34ac85236e25415bd654`
- `preproduction-director-core.mjs`：`ddf0612bdadd9f26ed70592dfce5db7df0cdb4136eaafc1660d6da332f90d949`
- `paper-motion-contract.mjs`：`858c1127939cba284eb8a4666ca000e9e77b615bd3fd613188e558bc3e4f3c5f`
- `paper-physical-contract.mjs`：`a94448c513ce7f7549eaa2f2755b574cb191ebd816beca2afd6bd86acfde6e60`

仅写本r3/reviews目录；无生图、渲染、外部调用、提交、KB或共享文件写入。
