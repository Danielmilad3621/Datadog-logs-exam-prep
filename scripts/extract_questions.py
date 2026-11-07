"""Convert the user's supplied text PDF into a private, structured question bank.
The categorization is a learning aid; it is not an official Datadog weighting.
Run: python scripts/extract_questions.py path/to/source.pdf
"""
import fitz, re, json, sys, pathlib, runpy, contextlib, io
root=pathlib.Path(__file__).resolve().parents[1]
if len(sys.argv)<2:
    raise SystemExit('Usage: python scripts/extract_questions.py <PDF>')
with contextlib.redirect_stdout(io.StringIO()):
    info=runpy.run_path(str(root/'scripts'/'classify_logs.py'))
assigned={qid:cat for cat, ids in info['assign'].items() for qid in ids}
labels=info['categories']
domains={
    'LF': 'Logging Fundamentals',
    'LC': 'Log Collection',
    'SF': 'Log Searching & Filtering',
    'LA': 'Log Analysis',
    'LU': 'Log Utilization',
    'LT': 'Log Troubleshooting',
    'X': 'Additional Topics',
}
pages=[]
for p in fitz.open(sys.argv[1]):
    pages.append(p.get_text(sort=True))
text='\n'.join(pages)
question_re=list(re.finditer(r'(?m)^\s*Question:\s*(\d+)\s*$',text))
assert len(question_re)==210, f'Expected 210 questions; extracted {len(question_re)}'
full=[]; issues=[]
for k,m in enumerate(question_re):
    qid=int(m.group(1)); end=question_re[k+1].start() if k+1<len(question_re) else len(text)
    body=text[m.end():end]
    body=re.sub(r'(?m)^\s*(?:www\.dumps4u\.com|Questions and Answers PDF\s*\d+/\d+)\s*$', '\n', body)
    answer_match=re.search(r'(?m)^\s*Answer:\s*([A-F](?:\s*,\s*[A-F])*)\s*$',body)
    if not answer_match:
        raise ValueError(f'Cannot find answer for Q{qid}: {body[-200:]}')
    keys=re.findall(r'[A-F]',answer_match.group(1))
    content=body[:answer_match.start()]
    chunks=list(re.finditer(r'(?m)^\s*([A-F])\.\s+',content))
    if len(chunks)<2:
        raise ValueError(f'Q{qid}: not enough options: {content[:400]}')
    prompt=' '.join(content[:chunks[0].start()].split())
    options=[]
    for j,mark in enumerate(chunks):
        e=chunks[j+1].start() if j+1<len(chunks) else len(content)
        opttext=' '.join(content[mark.end():e].split())
        options.append({'key':mark.group(1),'text':opttext})
    truefalse=len(options)==2 and {o['text'].lower().rstrip('.') for o in options}=={'true','false'}
    typ='truefalse' if truefalse else ('multi' if len(keys)>1 else 'single')
    want=re.search(r'Choose\s+(\d+)\s+answers?',prompt,re.I)
    problem=[]
    if want and int(want.group(1))!=len(keys): problem.append(f'Says choose {want.group(1)}; key has {len(keys)}')
    if len(set(keys))!=len(keys):problem.append('Duplicate answer keys')
    if any(ans not in [o['key'] for o in options] for ans in keys):problem.append('Answer not among options')
    if len(keys)==1 and want and int(want.group(1))!=1:problem.append('Multi-select instruction with single key')
    page_num=text[:m.start()].count('\n\f')+1  # fallback only; actual below
    # map question start to actual page using cumulative character positions
    total=0
    for pi,pg in enumerate(pages,1):
        total += len(pg)+1
        if m.start() < total:
            page_num=pi;break
    code=assigned[qid]
    full.append({'id':qid,'prompt':prompt,'options':options,'answers':keys,
                 'type':typ,'domain':domains['X'] if code.startswith('X') else domains[code[:2]],
                 'topic':labels[code].removeprefix('Additional: '),'topicCode':code,'sourcePage':page_num,
                 'flags':problem})
    if problem:issues.append({'id':qid,'flags':problem,'text':prompt})
if sorted(q['id'] for q in full)!=list(range(1,211)):raise AssertionError('missing questions')
path=root/'server'/'questions.json';path.write_text(json.dumps(full,ensure_ascii=False,indent=2),encoding='utf-8')
from collections import Counter
print('Extracted',len(full),'questions; types',dict(Counter(q['type'] for q in full)))
print('Question issues:',len(issues));print(json.dumps(issues,indent=2))
print('Main domain counts',dict(Counter(q['domain'] for q in full)))
print('Question bank JSON:',path)
(root/'server'/'extraction-report.json').write_text(json.dumps({'total':len(full),'typeCounts':dict(Counter(q['type'] for q in full)),'issues':issues,'domainCounts':dict(Counter(q['domain'] for q in full))},indent=2))
