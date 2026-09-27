# 用法:python3 mcpcall.py '<json: [[tool, args], ...]>'  —— 同一個 session 依序呼叫,印每個回應
import json,subprocess,sys,os,time,select,re
pid=subprocess.check_output("pgrep -f 'Xcode_275beta.app/Contents/MacOS/Xcode' | head -1",shell=True).decode().strip()
p=subprocess.Popen(['/Applications/Xcode_275beta.app/Contents/Developer/usr/bin/mcpbridge'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,env=dict(os.environ,MCP_XCODE_PID=pid))
def send(o): p.stdin.write((json.dumps(o)+'\n').encode()); p.stdin.flush()
def recv(i,t=900):
    end=time.time()+t
    while time.time()<end:
        r,_,_=select.select([p.stdout],[],[],1)
        if r:
            m=json.loads(p.stdout.readline())
            if m.get('id')==i: return m
    return None
send({"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}); recv(0,30)
send({"jsonrpc":"2.0","method":"notifications/initialized"})
if sys.argv[1]=='schema':
    send({"jsonrpc":"2.0","id":1,"method":"tools/list"}); r=recv(1,60)
    for t in r['result']['tools']:
        if t['name'] in sys.argv[2:]: print(t['name'],json.dumps(t['inputSchema'],ensure_ascii=False))
else:
    for n,(tool,args) in enumerate(json.loads(sys.argv[1]),start=1):
        if tool=='__switch_sim':   # 從同一個 session 的 XcodeListRunDestinations 結果挑模擬器,再切過去
            send({"jsonrpc":"2.0","id":1000+n,"method":"tools/call","params":{"name":"XcodeListRunDestinations","arguments":{"tabIdentifier":args['tab']}}})
            lst=json.dumps(recv(1000+n)); titles=re.findall(r'displayTitle\\?": ?\\?"([^"\\]+)',lst)
            pick=[x for x in titles if args['match'] in x]; print('== destinations:',titles[:8],'→',pick[:1])
            send({"jsonrpc":"2.0","id":2000+n,"method":"tools/call","params":{"name":"XcodeSwitchRunDestination","arguments":{"tabIdentifier":args['tab'],"displayTitle":pick[0]}}})
            print(json.dumps(recv(2000+n),ensure_ascii=False)[:400]); continue
        if tool=='__shell':
            print('== shell:',args); print(subprocess.run(args,shell=True,capture_output=True,text=True).stdout); continue
        t0=time.time(); send({"jsonrpc":"2.0","id":n,"method":"tools/call","params":{"name":tool,"arguments":args}})
        r=recv(n); print(f'== {tool} ({time.time()-t0:.1f}s)'); print(json.dumps(r,ensure_ascii=False)[:3000])
p.kill()
