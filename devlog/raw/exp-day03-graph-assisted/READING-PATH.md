# 新人閱讀路線:apple/container

這是 Apple 的 `container`——用 Swift 寫的 macOS 容器工具,每個容器跑在一台獨立的輕量 Linux VM 裡。
底層 VM / OCI 操作交給另一個套件 [Containerization](https://github.com/apple/containerization);
**這個 repo 本身主要是「多 process 的控制平面」**:一支 CLI、一個常駐 API server、幾個 XPC helper。

先記住這條主線,後面每一步都在為它填細節:

```
container run alpine echo hello
   │  (CLI process)
   ▼ XPC  route = containerCreate / containerBootstrap
container-apiserver  (launchd agent, 常駐)
   │  透過 launchd 為「這一個容器」拉起一支 helper
   ▼ XPC  route = bootstrap / start / wait ...
container-runtime-linux  (每個容器一支 process)
   │
   ▼ Containerization 套件 → Virtualization.framework
Linux VM ── 裡面跑容器
```

路線共 9 步,前 3 步是地圖,4–7 步順著 `container run` 走一遍,8–9 步補橫向概念。
建議每步不要求讀完整檔,先抓「這個檔案在主線上的位置」。

---

## 1. `README.md` + `docs/technical-overview.md`(含 `docs/assets/functional-model-light.svg`)

**為什麼先看它**:technical-overview 的「How does `container` run my container?」一節用四段話把 process 模型講完
(CLI → `container-apiserver` → `container-core-images` / `container-network-vmnet` / 每個容器一支 `container-runtime-linux`)。
這是整個 repo 唯一一份「上帝視角」說明,之後看程式碼時所有目錄名都能對回這張圖。

## 2. `Package.swift`

**為什麼先看它**:這個 repo 有 40 幾個 target,**目錄名和 target 名經常不一致**,不先看這份對照表會迷路。幾個最容易踩的:

| 目錄 | 實際 target | 角色 |
|---|---|---|
| `Sources/CLI` | `container` | CLI 執行檔(只有 24 行,真正內容在 ContainerCommands) |
| `Sources/APIServer` | `container-apiserver` | 常駐 daemon 執行檔 |
| `Sources/Plugins/{CoreImages,NetworkVmnet,RuntimeLinux,MachineAPIServer,K8s}` | `container-core-images` / `container-network-vmnet` / `container-runtime-linux` / `machine-apiserver` / `k8s` | 5 支 helper/plugin 執行檔,每個都只是薄薄的 `main` |
| `Sources/Services/ContainerAPIService/Client` | **`ContainerAPIClient`** | CLI 用來打 apiserver 的 client 函式庫(AST 報告裡 123 條邊的那個 hub) |
| `Sources/Services/ContainerAPIService/Server` | `ContainerAPIService` | apiserver 的業務邏輯 |
| `Sources/Services/RuntimeLinux/Server` | `ContainerRuntimeLinuxServer` | 單一容器 runtime 的業務邏輯 |

看完可以得出一個規律:**每個 process = `Sources/Plugins/*` 或 `Sources/APIServer` 的薄執行檔 + `Sources/Services/*/Server` 的 library**,
client 端則放在 `Sources/Services/*/Client`。

## 3. `Sources/ContainerXPC/`(5 個檔,先看 `XPCServer.swift` 前 60 行與 `XPCMessage.swift`)

**為什麼先看它**:所有 process 之間都用 XPC 講話,而這個模組是全 repo 唯一的 IPC 抽象。
核心只有一個型別:`RouteHandler = (XPCMessage, XPCServerSession) async throws -> XPCMessage`,
server 就是 `[String: RouteHandler]` 的字典。理解這個之後,每個 helper 的 `+Start.swift` 都變成同一種形狀:「建 service actor → 把方法註冊成 routes → `listen()`」。

## 4. `Sources/ContainerCommands/Application.swift` → `Sources/ContainerCommands/Container/ContainerRun.swift`

**為什麼先看它**:`Application.swift` 是 CLI 的根(swift-argument-parser 的子命令樹,一眼看完全部命令);
`ContainerRun.swift` 是最常用命令,183 行就走完「組 `ContainerConfiguration` → `ContainerClient().create()` → `client.bootstrap()` → 接 stdio 等結束」。
它是主線的起點,也是理解 CLI 層慣例的樣板(`AsyncLoggableCommand`、`Flags.*` OptionGroup、`Utility.containerConfigFromFlags`)。

順便看 `DefaultCommand.swift`:未知子命令會轉去找 plugin 執行檔(`k8s` 就是這樣被掛進 CLI 的)。

## 5. `Sources/Services/ContainerAPIService/Client/ContainerClient.swift` + 同目錄 `XPC+.swift` 的 `enum XPCRoute`

**為什麼先看它**:這是 CLI 與 daemon 的**契約**。`XPCRoute` 列舉(`containerCreate`、`containerBootstrap`、`networkCreate`、`volumeList`、`ping`……)
等於 apiserver 的完整 API 目錄;`ContainerClient` 則示範 client 端怎麼把 `Codable` 型別塞進 `XPCMessage`。
要新增一個功能,幾乎一定是從這裡加一個 route 開始。

## 6. `Sources/APIServer/APIServer+Start.swift` → `Sources/Services/ContainerAPIService/Server/Containers/{ContainersHarness,ContainersService}.swift`

**為什麼先看它**:`APIServer+Start.swift` 的 `run()`(前 100 行)是 daemon 的裝配線:載入 plugin、逐一初始化 Containers / Networks / Volumes / Kernel / DiskUsage 各 service、把 routes 湊成一張表、再開兩個 DNS server。
接著 `ContainersHarness` 是「XPCMessage ⇄ Swift 型別」的轉接層,`ContainersService`(actor,1200 行)才是真正的狀態機。
重點讀 `ContainersService.create()` 與 `bootstrap()`:後者透過 `ServiceManager.registerService` 用 **launchd** 為該容器拉起一支 `container-runtime-linux`,再用 `RuntimeClient` 對它下 `bootstrap`。
這裡是「一個容器一個 process」在程式碼中的落點。

`Harness` / `Service` 這對命名在 Networks、Volumes、Kernel、Images、Machines 都重複出現,看懂這一對就看懂其他的。

## 7. `Sources/Plugins/RuntimeLinux/RuntimeLinuxHelper+Start.swift` → `Sources/Services/RuntimeLinux/Server/RuntimeService.swift`(先讀 `bootstrap()`)

**為什麼先看它**:這是主線的終點,也是這個 repo 和 Containerization 套件的交界。
`+Start.swift` 150 行,展示 helper 開兩個 XPC server(一個 mach service 給 apiserver 找到它、一個匿名 endpoint 跑真正的 routes)。
`RuntimeService.bootstrap()` 從 bundle 讀回 `ContainerConfiguration` 與 kernel、向 network plugin 要 IP、建 `VZVirtualMachineManager`、組 `LinuxContainer`——
**這個 repo 自己不碰 Virtualization.framework,全部委託給 Containerization**,所以看到 `import Containerization` 的地方就是邊界。

## 8. `Sources/ContainerResource/Container/ContainerConfiguration.swift`(順帶掃同目錄其他檔)

**為什麼先看它**:`ContainerConfiguration` 是貫穿三個 process 的核心資料型別——CLI 組它、apiserver 存它(JSON 寫進 bundle 目錄)、runtime helper 讀它。
它的 `init(from:)` 手寫了每個欄位的預設值,是相容舊版持久化資料的機制,改欄位時必看。
`ContainerResource` 整個模組(Container / Image / Network / Volume / Registry)都是這種「純 Codable、無邏輯」的共用型別,AST 報告裡 105 條邊也印證它是被所有模組 import 的基礎層。

## 9. `Sources/ContainerPlugin/{Plugin,PluginConfig,PluginLoader,ServiceManager}.swift` + 各 `Sources/Plugins/*/config.toml`

**為什麼先看它**:前面出現的「helper 怎麼被找到、怎麼被 launchd 拉起、mach service 名稱怎麼來」全在這裡。
`config.toml` 只有十幾行,宣告 plugin 的 `type`(`core` / `network` / `runtime`)、`loadAtBoot`、`runAtLoad`;
`Plugin.getMachService()` 把它組成 `com.apple.container.<type>.<name>[.<instanceId>]` 這種字串,和第 5、7 步看到的 service identifier 對得上。
**這個 repo 的擴充機制就是「放一支執行檔 + 一份 toml」**,machine-apiserver、k8s 都是這樣掛上去的第一方範例。

---

## 之後想深入時的分支(不在主線,依興趣挑)

- **映像/registry**:`Sources/Services/ContainerImagesService/{Client,Server}` + `Sources/Plugins/CoreImages`,同樣的 Harness/Service/Routes 模式。
- **網路**:`Sources/Services/Network*`、`Sources/Plugins/NetworkVmnet`、`Sources/DNSServer`(apiserver 內嵌兩個 DNS resolver)。
- **build**:`Sources/ContainerBuild` 用 gRPC 而非 XPC,是全 repo 唯一的例外,對接一個 BuildKit shim(版本見 `Package.swift` 頂部 `builderShimVersion`)。
- **container machine**:`docs/container-machine.md` → `Sources/ContainerCommands/Machine` → `Sources/Services/MachineAPIService`,較新的功能,走獨立的 `machine-apiserver` plugin。
- **驗證理解**:`Tests/IntegrationTests/Run/TestCLIRunCommand.swift` 用 `ContainerTestSupport` 的 fixture 真的跑 CLI;讀完主線後拿它當習題。
- **建置**:`BUILDING.md` + `Makefile`(`make all` 會順便下載 init-block 與 kernel)。

---

## 我沒把握的地方

1. **AST 報告的 god nodes 大半是雜訊**。前 5 名是 `ContainerizationError`、`Foundation`、`FileManager`、`Int`、`ParserTest`,都是「被 import / 被用作型別」而非架構中心;我只採信了 `ContainerAPIClient`(123)與 `ContainerResource`(105)這兩個,因為和 `Package.swift` 的依賴方向吻合。331 個 community 沒有命名、cohesion 普遍 < 0.2,我沒有用它們來決定路線。

2. **AST 報告的「Surprising Connections」看起來是符號解析錯誤**。例如 `VolumesService --references--> ContainerPersistence` 被指到 `Tests/IntegrationTests/System/TestCLIKernelSetSerial.swift`,`StatsSnapshot --references--> ContainerResource` 指到 `Tests/K8sPluginTests/K8sListTests.swift`;這些應該是同名 module 與某個測試檔裡的符號撞名。我把它們當作「報告的跨檔邊不可靠」的證據,沒有採用。

3. **`ContainerAPIClient` 是否真的是「CLI 專用」client**:它同時被 `container-apiserver`、`ContainerAPIService`、`ContainerK8s` 依賴(見 `Package.swift`),裡面也放了 `Utility`、`Parser`、`ProgressUpdateClient` 等看起來偏 CLI 的工具。我在第 5 步把它稱作「CLI 與 daemon 的契約」,但它的職責邊界可能比這個說法更混。

4. **runtime helper 的兩個 XPC server 之間的握手細節**。`RuntimeLinuxHelper+Start.swift` 開了一個 mach service(只有 `createEndpoint` route)和一個匿名 connection(其他 routes);我推測 apiserver 先透過 mach service 拿到匿名 endpoint 再用它下命令,但沒有追 `RuntimeClient.create()` 確認。

5. **machine 與 k8s 的定位**。`machine-apiserver` 的 `config.toml` 是 `type = "core"`、`loadAtBoot = true`,所以它是 apiserver 開機時就拉起的常駐 helper;`k8s` 的 toml 沒有 `servicesConfig`,應該是純 CLI plugin。這兩者是近期加入的功能(git log 可見大量 K8s / Machine commit),我把它們放在分支而非主線,但如果你的目標是貢獻這兩塊,主線第 6–7 步可以略讀。

6. **`ContainerBuild` 走 gRPC 的原因**我只從依賴列表推斷(接的是 BuildKit 這類外部程式,所以不能用 XPC),沒有讀 proto 或 pipeline 程式碼驗證。

7. **macOS 15 vs 26 的分支**散在程式碼裡(`#available(macOS 26, *)`,例如 `Application.otherCommands()`、`RuntimeLinuxHelper+Start.swift` 的 interface strategy),README 說只支援 26。路線裡我一律以 macOS 26 路徑為準,15 的相容分支沒有考慮。

8. **這份路線假設讀者的目標是「理解容器生命週期」**。如果你要做的是 image/registry 或 networking,第 4–7 步可以換成對應的 Client/Harness/Service 三件組,結構是一樣的,但我沒有逐一驗證那些模組是否真的同構。
