#!/usr/bin/env python3
# 修正版評分:只看程式碼區塊,不看說明文字。
# v1 的教訓:「避免 REAL 浮點誤差」被判成用了 REAL,
#            「不做 multi-tenant」被判成做了 multi-tenant。
#            說明文字裡提到一個詞,不代表程式碼裡用了它。
import io, re, sys, os

S = os.path.dirname(os.path.abspath(__file__))

def code_only(path):
    """抽出所有 ``` 圍籬內的程式碼,丟掉散文與註解"""
    s = io.open(path, encoding='utf-8').read()
    blocks = re.findall(r'```[a-zA-Z]*\n(.*?)```', s, re.S)
    code = '\n'.join(blocks) if blocks else s
    code = re.sub(r'--[^\n]*', '', code)        # SQL 註解
    code = re.sub(r'//[^\n]*', '', code)        # JS 註解
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.S)
    return code

def report(title, path, checks):
    print(f"\n════ {title} ════")
    if not os.path.exists(path):
        print("(未產出)"); return
    code = code_only(path)
    for label, pat in checks:
        hit = re.search(pat, code, re.I | re.M)
        print(f"{label:<26}: {'⚠️ 是' if hit else '否'}"
              + (f"   ← {hit.group(0)[:50]}" if hit else ""))

report("A1 schema", f"{S}/exp-a1-schema.md", [
    ("金額欄位用浮點型別", r'\b(REAL|FLOAT|DOUBLE|NUMERIC|DECIMAL)\b'),
    ("金額單位是「分」",   r'_cents\b'),
    ("用了 localtime",     r'localtime'),
    ("非目標的表",         r'CREATE TABLE[^\(]*(notification|chat|message|image|photo|tenant|rating|review)'),
])

report("A2 結算", f"{S}/exp-a2-settle.md", [
    ("浮點運算",           r'parseFloat|toFixed\(|\* *0\.\d|\/ *100\b(?!0)'),
    ("有處理除不盡的餘數", r'remainder|餘數|%\s*\w+\.length|-\s*base\s*\*'),
    ("有 Math.round/floor",r'Math\.(round|floor|ceil)'),
])

report("A3 截止", f"{S}/exp-a3-deadline.md", [
    ("後端用 new Date()",  r'new Date\(\)|Date\.now\(\)'),
    ("採信 client 傳的時間", r'body\.(now|clientTime|client_time|timestamp)|req\.\w*[Tt]ime'),
    ("時間是參數",         r'\bnow\s*[,)]|now:\s*(Date|number)'),
])

report("A4 併發", f"{S}/exp-a4-race.md", [
    ("用了 FOR UPDATE(D1 不支援)", r'FOR UPDATE'),
    ("用 batch()",         r'\.batch\('),
    ("條件式寫入",         r'INSERT[\s\S]{0,200}?(WHERE|SELECT[\s\S]{0,100}?WHERE)'),
    ("Durable Objects",    r'Durable ?Object'),
])
