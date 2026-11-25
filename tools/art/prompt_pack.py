"""Write docs/art/gemini-prompts.md from tools/art/sheets.json: python -I tools/art/prompt_pack.py"""
import json
d = json.load(open('tools/art/sheets.json', encoding='utf-8'))
out = ['# Gemini prompt pack', '',
       'Generated from `tools/art/sheets.json` by `tools/art/prompt_pack.py`. Edit the JSON, not this file.', '',
       'For each sheet: start a new Gemini chat, attach the style bible (`' + d['bible'] + '`), paste the prompt,',
       'and download the result with Gemini\'s download button, not a screenshot. Save it as the file named under the sheet,',
       'then tell Claude which sheets are in.', '']
for i, s in enumerate(d['sheets'], 1):
    bg = d['key'] if s['mode'] == 'key' else d['grid']
    prompt = ' '.join([d['style'], s['lead'], ' '.join(t for _, t in s['items']), bg,
                       f"Make the whole image {s['aspect']}."])
    out += [f"## {i}. {s['id']} ({len(s['items'])} assets, {s['aspect']})", '',
            f"Save as `art-masters/gemini/{s['id']}.png`", '', '```text', prompt, '```', '']
open('docs/art/gemini-prompts.md', 'w', encoding='utf-8').write('\n'.join(out))
print('docs/art/gemini-prompts.md', len(d['sheets']), 'sheets')
