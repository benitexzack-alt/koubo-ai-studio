#!/usr/bin/env python3
"""End-to-end regression for the V1 research context and candidate pack gates."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = Path(__file__).resolve().parent
SOURCE = Path('/Users/pc/Documents/个人知识库/01_项目实战/抖音知识中台/来源库/2026/08/抖音-7673119173723098419.md')
PREFLIGHT = ROOT / 'workflow/account-performance-preflights/task-20260819T022553Z-92ad7b23.json'
TASK_ID = 'task-20260819T022553Z-92ad7b23'


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def invoke(command: list[str]) -> tuple[int, dict]:
    completed = subprocess.run(command, text=True, capture_output=True, check=False)
    if completed.stdout.strip():
        return completed.returncode, json.loads(completed.stdout)
    return completed.returncode, {'stderr': completed.stderr.strip()}


def candidate_pack(context: Path, source_id: str, retrieval: dict) -> dict:
    return {
        'schema_version': 1,
        'task_id': TASK_ID,
        'public_copy_generated': False,
        'research_context': {'path': str(context), 'sha256': digest(context)},
        'candidates': [{
            'id': 'candidate:knowledge-needs-rebuild',
            'topic': '为什么你每天收藏AI内容，最后还是讲不出自己的判断？',
            'real_scene': '一个本地创业者刷到AI案例、收藏很多，却要面对老板追问它放进自己业务到底怎么做。',
            'audience_conflict': '来源越多，越容易把别人的结论当成自己的经验。',
            'original_judgment': '企业AI信任内容不是搬运工具结论，而是把来源重建成有边界、能回到真实工作的问题。',
            'evidence_gap': '需要补充一段本人实际如何把一条来源转成业务问题或验证任务的记录；缺少前不得写成教学案例。',
            'source_ids': [source_id],
            'opcd_read_refs': [{
                'path': retrieval['path'],
                'document_sha256': retrieval['document_sha256'],
                'application': '只把其中关于来源必须回到真实转写与已确认边界的提醒作为风险检查，不把该文档中的案例或结论迁移为本条事实。'
            }],
            'hook_options': [
                {'id': 'h1', 'text': '你收藏的AI视频越多，可能越讲不出自己的东西。', 'concrete_anchor': '收藏夹和老板追问', 'promise': '解释为什么输入不能直接变成企业判断'},
                {'id': 'h2', 'text': '老板问AI能干什么时，最怕你把博主的答案原样念一遍。', 'concrete_anchor': '老板当面提问', 'promise': '给出把来源翻成业务问题的判断'},
                {'id': 'h3', 'text': '一条AI视频看完，先别急着让AI替你总结。', 'concrete_anchor': '看完视频后的第一步', 'promise': '说清重建和实践为什么不能省'}
            ],
            'outline_spine': [
                {'function': 'hook', 'statement': '用收藏很多却讲不出来的场景提出矛盾。'},
                {'function': 'correction', 'statement': '区分看过、收藏和真正能解释、能迁移。'},
                {'function': 'mechanism', 'statement': '先复述，再质疑，再放进自己的业务条件。'},
                {'function': 'evidence', 'statement': '只使用本轮完整来源说明其结构功能，不冒充本人实践。'},
                {'function': 'boundary', 'statement': '没有本人实际记录时，只能给待验证问题，不能教企业照做。'},
                {'function': 'callback', 'statement': '回到老板追问，收束为先把来源翻成自己的问题。'}
            ],
            'long_term_trust_path': '展示超哥如何区分来源、判断和真实业务证据，为企业知识库与AI陪跑建立可信入口。',
            'non_claims': ['不声称已有企业客户案例。', '不承诺知识整理会带来获客或成交。'],
            'manual_selection': {'status': 'pending-user-selection'}
        }]
    }


def main() -> int:
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        confirmed_script = temp / 'confirmed-script.md'
        confirmed_script.write_text('# 已确认口播稿\n\n仅用于结构分析。\n', encoding='utf-8')
        missing_evidence_context = temp / 'missing-evidence.json'
        code, _ = invoke([
            sys.executable, str(SCRIPT_DIR / 'prepare_research_context.py'),
            '--task-id', TASK_ID, '--preflight', str(PREFLIGHT), '--opcd-query', '本人确认稿 结构分析', '--source', str(confirmed_script), '--output', str(missing_evidence_context),
        ])
        assert code == 1, '本人确认稿缺少哈希证据清单时必须阻断'
        evidence = temp / 'source-evidence.json'
        evidence.write_text(json.dumps({
            'schema_version': 1,
            'records': [{
                'path': str(confirmed_script),
                'sha256': digest(confirmed_script),
                'evidence_type': 'user-confirmed-script',
                'source_completeness': 'complete',
                'allowed_use': '仅用于本人已确认口播的结构分析。',
            }],
        }, ensure_ascii=False), encoding='utf-8')
        confirmed_context = temp / 'confirmed-context.json'
        code, result = invoke([
            sys.executable, str(SCRIPT_DIR / 'prepare_research_context.py'),
            '--task-id', TASK_ID, '--preflight', str(PREFLIGHT), '--opcd-query', '本人确认稿 结构分析', '--source-evidence', str(evidence), '--source', str(confirmed_script), '--output', str(confirmed_context),
        ])
        assert code == 0 and result['status'] == 'ready-for-candidate-review', result
        confirmed_receipt = json.loads(confirmed_context.read_text(encoding='utf-8'))
        assert confirmed_receipt['sources'][0]['evidence_type'] == 'user-confirmed-script'

        context = temp / 'context.json'
        code, result = invoke([
            sys.executable, str(SCRIPT_DIR / 'prepare_research_context.py'),
            '--task-id', TASK_ID, '--preflight', str(PREFLIGHT), '--opcd-query', 'AI内容来源重建 真实业务判断', '--source', str(SOURCE), '--output', str(context),
        ])
        assert code == 0 and result['status'] == 'ready-for-candidate-review', result
        receipt = json.loads(context.read_text(encoding='utf-8'))
        pack = temp / 'candidate-pack.json'
        pack.write_text(json.dumps(candidate_pack(context, receipt['sources'][0]['id'], receipt['opcd']['retrieval']['results'][0]), ensure_ascii=False), encoding='utf-8')
        code, result = invoke([sys.executable, str(SCRIPT_DIR / 'validate_candidate_review_pack.py'), str(pack)])
        assert code == 0 and result['status'] == 'ready-for-manual-selection', result

        bad = candidate_pack(context, receipt['sources'][0]['id'], receipt['opcd']['retrieval']['results'][0])
        bad['public_copy_generated'] = True
        bad_path = temp / 'candidate-pack-invalid.json'
        bad_path.write_text(json.dumps(bad, ensure_ascii=False), encoding='utf-8')
        code, result = invoke([sys.executable, str(SCRIPT_DIR / 'validate_candidate_review_pack.py'), str(bad_path)])
        assert code == 1 and result['status'] == 'blocked', result
    print('V1任务上下文与候选包端到端回归：通过')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
