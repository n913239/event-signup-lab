# 架構文件:`container`

> 這份文件是從原始碼本身讀出來的,刻意沒有參考 `Package.swift` / `Package.resolved`。
> 讀的版本是 repo 當下的 HEAD `d6de569`,約 444 個 `.swift` 檔。
> 凡是「推論」而非「讀到」的地方,我都標了 **[不確定]**。

---

## 1. 這個專案在做什麼

`container` 是一個 macOS(Apple silicon)上的命令列工具,用來建立與執行 Linux 容器。它消費與產出標準 OCI image,所以可以跟任何 registry 互通。

它跟 Docker Desktop 那類工具最大的架構差異寫在 `docs/technical-overview.md`,而且在程式碼裡看得到:**它不是開一台共用的 Linux VM 再在裡面切容器,而是每一個容器一台輕量 VM**。`Sources/Services/RuntimeLinux/Server/RuntimeService.swift` 的類別註解直接寫著 "An XPC service that manages the lifecycle of a **single** VM-backed container",而 `ContainersService.bootstrap()` 每建一個容器就向 launchd 註冊一份新的 helper 實例 —— 這是整份程式碼最核心的設計後果,後面幾乎所有複雜度都源自於此。

值得先講清楚的是**這個 repo 的定位**:真正低階的 VM 開機、rootfs 解包、OCI 解析,都來自外部的 `Containerization` Swift package(程式碼裡到處 `import Containerization` / `ContainerizationOCI` / `ContainerizationEXT4` / `ContainerizationOS`,但 `Sources/` 底下找不到它們)。**本 repo 是蓋在那個 package 上的產品層**:CLI、常駐服務、plugin 機制、網路、DNS、映像檔庫存、build 管線、Kubernetes 與 container machine 的封裝。看程式碼時如果覺得「關鍵那一步怎麼跳掉了」,答案通常在外部 package 裡。

---

## 2. 模組拆法

### 2.1 先講一個會絆倒人的地方:目錄名 ≠ 模組名

`import` 的名稱跟 `Sources/` 的資料夾名對不起來。例如程式碼裡大量 `import ContainerAPIClient`,但沒有 `Sources/ContainerAPIClient/`;實際內容在 `Sources/Services/ContainerAPIService/Client/`。同樣的對應還有:

| import 名稱 | 實際目錄 |
|---|---|
| `ContainerAPIClient` | `Sources/Services/ContainerAPIService/Client` |
| `ContainerAPIService` | `Sources/Services/ContainerAPIService/Server` |
| `ContainerImagesServiceClient` | `Sources/Services/ContainerImagesService/Client` |
| `ContainerRuntimeClient` | `Sources/Services/Runtime/RuntimeClient` |
| `ContainerRuntimeLinuxServer` | `Sources/Services/RuntimeLinux/Server` |
| `ContainerNetworkClient` / `ContainerNetworkServer` | `Sources/Services/Network/{Client,Server}` |
| `ContainerNetworkVmnetServer` | `Sources/Services/NetworkVmnet/Server` |
| `MachineAPIClient` / `MachineAPIService` | `Sources/Services/MachineAPIService/{Client,Server}` |

**[不確定]** 這張表是我拿每個目錄底下的 `import` 清單、跟各目錄實際定義的 public 型別交叉比對推出來的,不是讀 manifest。方向我有把握,但個別名稱可能有出入。

`Sources/Services/*` 一律是 `Client/` + `Server/` 兩半,而且是**兩個獨立模組**:client 半邊定義 route 常數與呼叫端封裝,server 半邊實作。這個切法讓 CLI 可以只連結 client 而不會把 daemon 的實作拖進來。

### 2.2 可執行檔(從 `@main` 讀出來的,共 7 個)

| 二進位 | 來源 | 角色 |
|---|---|---|
| `container` | `Sources/CLI` → `ContainerCommands/Application` | 使用者用的 CLI |
| `container-apiserver` | `Sources/APIServer` | 常駐 daemon,launch agent |
| `container-core-images` | `Sources/Plugins/CoreImages` | core plugin:image / content store |
| `machine-apiserver` | `Sources/Plugins/MachineAPIServer` | core plugin:container machine API |
| `container-network-vmnet` | `Sources/Plugins/NetworkVmnet` | network plugin:vmnet 網路 |
| `container-runtime-linux` | `Sources/Plugins/RuntimeLinux` | runtime plugin,**一個容器一份實例** |
| `container-k8s` **[不確定名稱]** | `Sources/Plugins/K8s` | 純 CLI plugin |

注意 `Sources/Plugins/*` 每一個都很小(84–180 行),它們只是 `AsyncParsableCommand` 外殼 + `config.toml`,真正的邏輯在 `Sources/Services/*/Server` 或 `Sources/ContainerK8s`。K8s 是唯一的例外:它的 `config.toml` 沒有 `servicesConfig` 區塊,依 `PluginConfig.isCLI` 的定義就是純 CLI plugin,不開任何 XPC 服務。

### 2.3 前端

- **`ContainerCommands`**(88 檔、8.3k 行)—— 整棵 ArgumentParser 命令樹,依 `Container/ Image/ Machine/ Network/ Volume/ Registry/ System/ Builder/` 分子目錄。`Application.swift` 是根節點,把子命令分組。
- **`TerminalProgress`** —— 進度條與終端渲染。
- **`ContainerK8s`** —— `container k8s` 的全部邏輯(建 kind node container、跑 kubeadm、抽 kubeconfig)。

### 2.4 服務層(`Sources/Services/`,16k 行,最大的一塊)

`ContainerAPIService`(容器、網路、磁碟用量、kernel、volume、plugin、健康檢查)、`ContainerImagesService`(image / content / snapshot)、`MachineAPIService`、`Network`(通用網路抽象)、`NetworkVmnet`(vmnet 實作)、`Runtime`(runtime client 契約)、`RuntimeLinux`(Linux VM runtime 實作)。

### 2.5 基礎設施

- **`ContainerXPC`** —— 自製的 XPC 訊息 / server / client 抽象,**整個系統的溝通骨幹**。
- **`ContainerPlugin`** —— plugin 探索、`config.toml` 解析、launchd plist 產生、`ServiceManager` 註冊。
- **`ContainerPersistence`** —— `ContainerSystemConfig`(TOML)、`EntityStore`、路徑工具。
- **`ContainerResource`** —— 跨程序共用的資料型別(container / image / network / volume / registry)。
- **`DNSServer`**、**`SocketForwarder`**、**`ContainerLog`**、**`ContainerOS`**、**`ContainerVersion`**,以及兩個 C shim:`CVersion`(版本字串)、`CAuditToken`(取 XPC 對端的 audit token)。
- **`ContainerBuild`** —— gRPC + protobuf,build 管線的 host 端。
- **`ContainerTestSupport`** + `Tests/`(15 個測試 target,含 `IntegrationTests`)。

---

## 3. 模組之間怎麼走

### 3.1 一切都是 XPC route

`ContainerXPC` 定義了一個極簡的 RPC:

- `XPCServer(identifier:routes:log:)`,`routes` 是 `[String: RouteHandler]`,handler 型別是 `(XPCMessage, XPCServerSession) async throws -> XPCMessage`。
- route 字串放在訊息的 `com.apple.container.xpc.route` 欄位,payload 幾乎一律是 `JSONEncoder` 後塞進具名 key。
- **安全邊界只有一道**:`XPCServer.handleMessage()` 取 audit token 比對 euid,client euid 必須等於 server euid,否則直接回 `unauthorized request`。這就是為什麼要有 `CAuditToken` 這個 C shim。

route 定義散在各模組的 client 半邊:`XPCRoute`(apiserver,`Sources/Services/ContainerAPIService/Client/XPC+.swift`)、`RuntimeRoutes`、`ImagesServiceXPCRoute`、`MachineRoutes`、`NetworkRoutes`。key 名集中在 `XPCKeys` 這個 enum,目前已經長到一百多個 case —— 這是弱型別邊界的代價,加欄位時 client / server 兩邊要各自對齊,編譯器幫不上忙。

### 3.2 啟動順序

```
container system start
  → 寫 launchd plist(label com.apple.container.apiserver)
  → ServiceManager.register()
  → container-apiserver 起來
      → ConfigurationLoader.load()  # appRoot 優先於 installRoot,first-match-wins
      → PluginLoader 掃兩個目錄(user-plugins、libexec/container/plugins)
      → PluginsService.loadAll(shouldBoot 的 plugin)  # 即 loadAtBoot=true 的 core plugin
      → 組出 [XPCRoute: RouteHandler] 表
      → XPCServer.listen()  +  兩個 DNSServer(2053 容器名稱、1053 localhost)
  → CLI 端 ClientHealthCheck.ping() 確認活著
  → 再 ping machine API server
  → 視需要下載預設 kernel 與 init image
```

### 3.3 一個 CLI 指令的完整路徑

```
Command.run()                      (ContainerCommands)
  → ContainerClient / ClientImage  (ContainerAPIClient)  ← XPCClient
  → XPCServer route dispatch       (container-apiserver)
  → XxxHarness                     ← 只做 XPC 訊息拆解 / 組裝與參數驗證
  → XxxService (actor)             ← 真正的業務邏輯與狀態
```

`Harness` / `Service` 這組配對是全 repo 最一致的樣式,每個 domain 都有一份(`ContainersHarness`/`ContainersService`、`ImagesServiceHarness`/`ImagesService`、`NetworksHarness`/`NetworksService`……)。Harness 是 `struct` 而且無狀態;Service 幾乎一律是 `actor`,狀態放在裡面,再用一個 `AsyncLock` 保護跨 await 的複合操作(光有 actor 隔離不夠,因為 `create` / `bootstrap` 中間會 await 別的服務)。

### 3.4 `container run` 實際發生什麼

1. **create**:`ContainersService.create()` 檢查 id 衝突、hostname 衝突、runtime plugin 存在、記憶體下限 200 MiB,然後把 `RuntimeConfiguration` 寫到 `<appRoot>/containers/<id>/`。**此時還沒有任何 VM,也沒有 helper 程序**,只有磁碟上一包設定。
2. **bootstrap**:
   - 先跟 `NetworksService` 要每個網路對應的 plugin,組成 `[NetworkBootstrapInfo]`。
   - `registerService()` 幫這個容器**單獨**向 launchd 註冊一份 `container-runtime-linux`,label 是 `com.apple.container.<runtime>.<containerId>`,參數 `start --root <bundle> --uuid <id>`。
   - `RuntimeClient.create(id:runtime:)` 連上 mach service `com.apple.container.runtime.<runtime>.<id>`,先送 `createEndpoint`,拿回一個 `xpc_endpoint_t`,再用 `xpc_connection_create_from_endpoint` 換成一條**專屬連線**。（第一條連線只是用來要 endpoint。）
   - `runtimeClient.bootstrap(stdio:...)`,三個 stdio 的 `FileHandle` **直接當 XPC 欄位傳過去** —— 這是 XPC 少數幾個能傳 fd 的地方,也是 `container run -it` 能直接接終端的原因。
3. **runtime 端**:`RuntimeService.bootstrap()` 建 bundle、讀 kernel(補上 `oops=panic`、`lsm=...` 這類預設 kernel arg,但使用者用 `--kernel-arg` 指定過的 key 不覆蓋)、建 `VZVirtualMachineManager` 與 `LinuxContainer`,開機。
4. **網路**:runtime 自己拿 `NetworkBootstrapInfo` 去連 network plugin,呼叫 `allocate(hostname:macAddress:session:)` 拿 `Attachment`。注意 allocate 帶 `XPCServerSession` —— 分配的生命週期綁在連線上,runtime 程序死掉時 session 斷開,位址自然回收。
5. **發佈埠**:`RuntimeService.startSocketForwarders()` 用 `SocketForwarder` 的 `TCPForwarder` / `UDPForwarder` 在 host 上接,轉進 VM。

### 3.5 image 與 build

apiserver **自己不管 image**。image 全部轉給 core plugin `container-core-images`,裡面是 `ImagesService` + `ContentStoreService` + `SnapshotStore`(用 `EXT4Unpacker` 把 layer 解成 ext4 block file;init image 給 512 MiB,一般 image 給 512 GiB 的稀疏容量)。

build 更繞:`container builder start` 會啟動一個**普通容器**,id 固定叫 `buildkit`,image 來自 `containerSystemConfig.build.image`(預設 `ghcr.io/apple/container-builder-shim/builder:<version>`)。之後 `ContainerBuild` 用 **gRPC over 一個已連線的 socket fd** 跟裡面的 Go builder shim 對話。`BuildPipelineHandler.swift` 的註解把三層講得很清楚:

- **host 端**負責打包 build context 成 tar(`BuildFSSync`)、代理 content store 的 blob(`BuildRemoteContentProxy`)、解析 base image(`BuildImageResolver`)、轉送 stdio(`BuildStdio`),並用 `openat(O_NOFOLLOW)` 逐層下降來擋 context 目錄外的路徑穿越;
- **builder shim**(Go,在 VM 裡)橋接 host stream 與 BuildKit 的 filesync;
- **BuildKit** 真正跑 build。

所以 build 的資料流是**反過來的**:BuildKit 在 VM 裡「拉」,host 在外面「餵」。

### 3.6 進度回報:反向 XPC

`ProgressUpdateClient` / `ProgressUpdateService` 是這裡少見的雙向樣式:CLI 端先建一條匿名 connection、`xpc_endpoint_create` 出 endpoint、把它塞進 request;server 端收到後用那個 endpoint 反向連回來推送進度事件。因為 XPC 本身是 request/reply,長時間操作(pull、build、unpack)需要這個機制才能即時更新進度條。

---

## 4. 關鍵抽象

**`Plugin` / `PluginConfig`(`Sources/ContainerPlugin/`)** —— 整個系統的擴充骨架,也是最值得先讀懂的一段。`DaemonPluginType` 有四種:`runtime`(每個容器一份實例)、`network`(每個網路一份實例)、`core`(單例,生命週期跟 apiserver 綁在一起)、`auxiliary`(保留)。命名慣例是硬約定:plugin **必須**在 `com.apple.container.<type>.<name>[.<instanceId>]` 上開 mach service。搭配 `PluginLoader`(掃目錄、同名 shadow 警告、產 launchd plist)與 `ServiceManager`(register / deregister),就構成了「多程序但不需要自己寫 supervisor」的整套機制 —— **程序監督外包給 launchd**。

**`Network` / `NetworkService` / `InterfaceStrategy`** —— 網路的三個 protocol 是明確留的擴充點。`Network.variant` 尤其有意思:它是一個回傳給 runtime 的「操作提示」,runtime 用 `(plugin name, variant)` 這組值去挑對應的 `InterfaceStrategy`(目前有 `IsolatedInterfaceStrategy` / `NonisolatedInterfaceStrategy`,對應 macOS 15 與 26 在 vmnet 上的能力差異)。

**`ManagedResource`(`Sources/ContainerResource/Common/`)** —— 所有使用者可見資源(container / image / network / volume / registry)的共同 protocol:`id` / `name` / `creationDate` / `labels` / `generateId()` / `nameValid()`。它把 CLI 的 list、filter、label 這些橫向功能統一掉(見 `ListDisplayable`、`ResourceLabels`)。`ManagedContainer` 特意覆寫了 `generateId()` 用小寫 UUID 而不是預設的 64 位 hex,註解直說是為了跟既有行為一致 —— 這種「抽象已經有了但現實不完全服從」的痕跡,值得留意。

**`ContainerConfiguration` vs `ContainerSnapshot` vs `ManagedContainer`** —— 三個很像但不同的型別,新手最容易搞混:`ContainerConfiguration` 是持久化的意圖(寫在磁碟上),`ContainerSnapshot` 是 apiserver 跨 XPC 回給 client 的當下狀態,`ManagedContainer` 是 CLI 端把 snapshot 包成 `ManagedResource` 的呈現層。

**`EntityStore` / `FilesystemEntityStore`(`ContainerPersistence`)** —— 泛型的檔案系統持久化:每個 entity 一個目錄、裡面一個 `entity.json`,記憶體索引在 actor 裡。`ContainersService` 其實沒用它(它自己管 `<appRoot>/containers/<id>` 的 bundle),volume / machine 這些才用。**[不確定]** 我沒有逐一確認哪些 service 用了 `EntityStore`、哪些自己來。

**`ContainerSystemConfig`(TOML)** —— 分層設定:`appRoot` 的使用者設定壓過 `installRoot` 的預設值,first-match-wins。每個區段的 `init(from:)` 都手寫,缺鍵就退回硬編碼預設值。

**`AsyncLock`** —— 到處都在用,而且會帶 `logMetadata` 記錄誰持有鎖。**[不確定]** 這個型別我沒找到定義,推測來自外部 `ContainerizationExtras`。

---

## 5. 新人該從哪裡開始讀

建議照這條「跟著一個 `container run` 走一遍」的路線,大約半天可以把主幹打通:

1. `README.md` + `docs/technical-overview.md` —— 先建立 one-VM-per-container 的心智模型,那張 `docs/assets/functional-model-light.svg` 值得看。
2. `Sources/ContainerCommands/Application.swift` —— 命令樹長什麼樣。
3. `Sources/ContainerCommands/Container/ContainerRun.swift` 與 `ContainerCreate.swift` —— 使用者輸入怎麼變成 `ContainerConfiguration`。
4. `Sources/Services/ContainerAPIService/Client/XPC+.swift` —— **一定要看**,`XPCRoute` 和 `XPCKeys` 是整個系統的 API 目錄。
5. `Sources/ContainerXPC/XPCServer.swift` + `XPCClient.swift` —— RPC 機制本身,包括那道 euid 檢查。
6. `Sources/APIServer/APIServer+Start.swift` —— daemon 怎麼把所有東西接起來,這一支檔案的資訊密度最高。
7. `Sources/Services/ContainerAPIService/Server/Containers/ContainersHarness.swift` → `ContainersService.swift` 的 `create()` 與 `bootstrap()` —— harness/service 分工的範本。
8. `Sources/Services/Runtime/RuntimeClient/RuntimeClient.swift` → `Sources/Services/RuntimeLinux/Server/RuntimeService.swift` 的 `bootstrap()` —— 跨程序 + 跨 VM 邊界的那一跳。
9. `Sources/ContainerPlugin/Plugin.swift` + `PluginLoader.swift` —— 讀懂之後,`Sources/Plugins/*` 底下每個小殼子就一目瞭然了。

之後再依需要分支:build 看 `Sources/ContainerBuild/BuildPipelineHandler.swift`(檔頭註解本身就是一篇小架構文件);網路看 `Sources/Services/Network/Server/`;測試看 `Tests/IntegrationTests/`,它是理解「一個功能完整流程長怎樣」最快的路。

---

## 6. 我沒把握的地方

老實列出來,不要當成已驗證的事實:

- **模組名 ↔ 目錄對應表(2.1 節)** 是推論。我沒讀 manifest,靠 import 名稱與型別定義位置反推。方向應該對,個別名稱可能錯。
- **`container-k8s` 這個二進位名稱**是猜的。K8s plugin 的 `config.toml` 沒有 abstract 以外的線索,`K8sCommand` 我也沒展開讀。
- **`Containerization` package 內部完全沒看**。`LinuxContainer`、`VZVirtualMachineManager`、`ImageStore`、`ContentStore`、`AsyncLock`、`EXT4Unpacker` 全都在外部,凡是講到「開機」「解包」的細節,我只讀到本 repo 呼叫它的那一行。
- **錯誤處理、崩潰復原、重啟語意**我只掃到表面。`ExitMonitor`、`handleContainerExit`、`loadAtBoot` 的 reap 邏輯我看到存在,但沒有追完各種失敗路徑。
- **`container machine` 與 `container k8s` 兩個子系統**我只看了型別與命令清單,沒讀完流程。從 `MachineConfiguration.UserSetup`、`create-user.sh`、`Resources/init` 看得出它做了首次開機 provisioning 並把 host 使用者映射進去,但細節我沒把握。
- **`Sources/Services/Network` 與 `NetworkVmnet` 的職責切分**我理解成「通用抽象 vs vmnet 實作」,但 `AllocationOnlyVmnetNetwork` 與 `ReservedVmnetNetwork` 兩者的取捨(對應 macOS 15 / 26)我只從 `@available(macOS 26, *)` 與 `variant` 字串推測。
- **完全沒有編譯、沒有執行過**。所有行為描述都來自靜態閱讀,任何「執行期會怎樣」的敘述都應該當成待驗證。
