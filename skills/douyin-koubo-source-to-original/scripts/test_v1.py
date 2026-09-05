#!/usr/bin/env python3
"""V1 compiler/validator regression with synthetic private-KB dependencies.

The RAG CLI is a test double, not an evaluation of real knowledge retrieval.
All synthetic evidence and receipts live in a disposable temporary directory.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
TASK_ID = 'synthetic-test-v1-research-context'


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def invoke(command: list[str]) -> tuple[int, dict]:
    completed = subprocess.run(command, text=True, capture_output=True, check=False)
    if completed.stdout.strip():
        return completed.returncode, json.loads(completed.stdout)
    return completed.returncode, {'stderr': completed.stderr.strip()}


def synthetic_inputs(temp: Path) -> tuple[Path, Path, Path]:
    """Replace only external/private inputs; exercise the real production gates."""
    kb = temp / 'synthetic-kb'
    kb.mkdir()
    source = kb / '完整来源-仅合成测试.md'
    source.write_text(
        '---\nsource_completeness: complete\nrights_status: synthetic-test-only\n---\n'
        '# 合成来源\n\n来源必须回到完整转写和已确认边界；本文件不是账号事实或客户证据。\n',
        encoding='utf-8',
    )
    learning = kb / 'synthetic-learning-card.json'
    learning.write_text(json.dumps({'evidence_scope': 'synthetic-test-only'}), encoding='utf-8')
    snapshot = kb / 'synthetic-snapshot.json'
    snapshot.write_text(json.dumps({'evidence_scope': 'synthetic-test-only'}), encoding='utf-8')
    preflight = temp / 'synthetic-preflight.json'
    preflight.write_text(json.dumps({
        'taskId': TASK_ID,
        'status': 'ready-current',
        'evidence_scope': 'synthetic-test-only',
        'learningCard': {'path': str(learning), 'sha256': digest(learning)},
        'accountContext': {'snapshotPath': str(snapshot), 'snapshotSha256': digest(snapshot)},
    }, ensure_ascii=False), encoding='utf-8')
    rag = kb / '04_Claude Code日常操作/scripts/opc_rag.py'
    rag.parent.mkdir(parents=True)
    rag.write_text('''"""Synthetic retrieval CLI test double; never production evidence."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('command', choices=['search'])
parser.add_argument('--query', required=True)
parser.add_argument('--limit', type=int, required=True)
args = parser.parse_args()
assert args.query.strip() and args.limit == 5
source = Path(__file__).resolve().parents[2] / '完整来源-仅合成测试.md'
text = source.read_text(encoding='utf-8')
print(json.dumps({
    'status': 'sufficient',
    'evidence_scope': 'synthetic-test-only',
    'results': [{
        'path': str(source), 'line_start': 1, 'line_end': len(text.splitlines()),
        'heading': '合成来源', 'status': 'synthetic-test-only',
        'authority': 'synthetic-test-only', 'lifecycle_layer': 'test-fixture',
        'document_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'score': 1.0,
    }],
}, ensure_ascii=False))
''', encoding='utf-8')
    return kb, preflight, source


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
            'public_value_contract': {
                'external_audience': '兰州本地企业老板、创业者和想把 AI 用进实际工作的人。',
                'present_situation': '他们收藏了很多 AI 内容，却仍回答不了一条工具建议放到自身业务后由谁执行、如何验收。',
                'viewer_decision': '看完能先判断一条内容是在提供可验证的业务问题，还是只是在重复别人的工具结论。',
                'account_strategy_link': '把账号定位为能把来源翻成业务判断的本地 AI 实践者，为后续知识库和落地服务建立可信入口。',
                'internal_process_is_not_topic': True,
            },
            'non_claims': ['不声称已有企业客户案例。', '不承诺知识整理会带来获客或成交。'],
            'manual_selection': {'status': 'pending-user-selection'}
        }]
    }


def main() -> int:
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory).resolve()
        kb, preflight, source = synthetic_inputs(temp)
        compile_command = [
            sys.executable, str(SCRIPT_DIR / 'prepare_research_context.py'),
            '--task-id', TASK_ID, '--preflight', str(preflight), '--opcd-root', str(kb),
        ]
        confirmed_script = temp / 'confirmed-script.md'
        confirmed_script.write_text('# 已确认口播稿\n\n仅用于结构分析。\n', encoding='utf-8')
        missing_evidence_context = temp / 'missing-evidence.json'
        code, result = invoke([
            *compile_command,
            '--opcd-query', '本人确认稿 结构分析', '--source', str(confirmed_script), '--output', str(missing_evidence_context),
        ])
        assert code == 1 and '本人确认稿需通过 --source-evidence' in result.get('stderr', ''), result
        assert not missing_evidence_context.exists()
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
            *compile_command,
            '--opcd-query', '本人确认稿 结构分析', '--source-evidence', str(evidence), '--source', str(confirmed_script), '--output', str(confirmed_context),
        ])
        assert code == 0 and result['status'] == 'ready-for-candidate-review', result
        confirmed_receipt = json.loads(confirmed_context.read_text(encoding='utf-8'))
        assert confirmed_receipt['sources'][0]['evidence_type'] == 'user-confirmed-script'

        context = temp / 'context.json'
        code, result = invoke([
            *compile_command,
            '--opcd-query', 'AI内容来源重建 真实业务判断', '--source', str(source), '--output', str(context),
        ])
        assert code == 0 and result['status'] == 'ready-for-candidate-review', result
        receipt = json.loads(context.read_text(encoding='utf-8'))
        assert receipt['opcd']['root'] == str(kb)
        retrieval = receipt['opcd']['retrieval']['results'][0]
        assert retrieval['status'] == 'synthetic-test-only'
        assert retrieval['document_sha256'] == digest(source)
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

        learning = kb / 'synthetic-learning-card.json'
        learning.write_text('{"evidence_scope":"synthetic-changed"}', encoding='utf-8')
        stale_context = temp / 'stale-learning-context.json'
        code, result = invoke([
            *compile_command, '--opcd-query', '合成学习卡漂移',
            '--source', str(source), '--output', str(stale_context),
        ])
        assert code == 1 and '账号学习卡哈希已变化' in result.get('stderr', ''), result
        assert not stale_context.exists()
    print('V1任务上下文与候选包隔离合成回归：通过（不代表真实知识检索验证）')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
