# Day 3 補跑:給 AI 圖之後,閱讀路線變了多少(2026-09-15)

- 目的:驗「先 AST 掃、再讓 AI 搭配掃描結果總結閱讀路線」這條心法,不能只用推論。
- 環境:`Github/clean-room-day03-graph` = `apple/container` @ `d6de5694` 的新 clone,沒有 CLAUDE.md,
  多放 `graphify-out/{GRAPH_REPORT.md,graph.json}`(9/9 那次 0.9.22 純 AST 的產物,**未過濾**)。
- session:`CLAUDE_CONFIG_DIR=iso-day4 claude -p --model opus`(乾淨 config,Opus 5),prompt 見 `prompt.md`。
- 交付:`READING-PATH.md`(127 行,原文未改);`result.json` 含 cost / usage。
- 成本:**$2.53、197 秒、32 turns**;output 12,591 tokens、cache read 2.33M。

## 對照:沒給圖(9/10 那份架構文件第 5 節)vs 給圖(今天)

| 步 | 9/10 沒給圖 | 9/15 給圖 |
|---|---|---|
| 1 | README + technical-overview | 同 |
| 2 | `Application.swift` | **`Package.swift`(目錄名 ≠ target 名對照表)** ← 新 |
| 3 | `ContainerRun.swift` / `ContainerCreate.swift` | `ContainerXPC/`(XPCServer、XPCMessage) |
| 4 | `XPC+.swift`(XPCRoute) | `Application.swift` → `ContainerRun.swift` |
| 5 | `XPCServer.swift` + `XPCClient.swift` | `ContainerClient.swift` + `XPCRoute` |
| 6 | `APIServer+Start.swift` | `APIServer+Start.swift` → `ContainersHarness` / **`ContainersService`** |
| 7 | `ContainersHarness` → **`ContainersService`** | `RuntimeLinuxHelper+Start` → **`RuntimeService.bootstrap()`** |
| 8 | `RuntimeClient` → **`RuntimeService.bootstrap()`** | **`ContainerConfiguration.swift`(ContainerResource)** ← 新,引用圖上 105 條邊 |
| 9 | `Plugin.swift` + `PluginLoader.swift` | `ContainerPlugin/` + `config.toml` |

- 骨架相同:兩次都是「地圖 → 跟著 `container run` 走 → plugin 骨架」,檔案集合重疊 8/9。
- 圖帶來的差異:多了 `Package.swift`(第 2 步)與 `ContainerResource` 基礎層(第 8 步);少了獨立的 `ContainerCreate.swift`。
- Day 2 三個檔:`ContainersService` ✅、`RuntimeService` ✅、**`Parser.swift` 兩次都不在路線上**(這次在「沒把握」第 3 點提到它是 `ContainerAPIClient` 裡偏 CLI 的工具)。
- **它怎麼用圖**:「沒把握」第 1 點明說 god nodes 前 5 名(`ContainerizationError`、`Foundation`、`FileManager`、`Int`、`ParserTest`)是雜訊,
  只採信 `ContainerAPIClient`(123)與 `ContainerResource`(105),因為跟 `Package.swift` 依賴方向吻合;第 2 點指出「Surprising Connections」像符號解析錯誤。
  → 它自己做了 Day 2 那兩道過濾器做的事。

## 備註
- `result.json` 的 `session_id` / `uuid` 已遮;其餘欄位(cost、usage、permission_denials)原樣。
- `permission_denials` 有 2 筆:它想用 `find | sed | sort | uniq -c` 數各目錄的 Swift 檔數,被 `--allowedTools` 白名單擋掉(管線含 sed/awk),它改用 Glob/Read 完成。這不影響交付,但要知道路線是在這個限制下產出的。
- `stderr.txt` 只有一行「no stdin data received」警告,無關。
