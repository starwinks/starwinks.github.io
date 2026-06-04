# macOS Browser Edition — 重构计划

## Context

当前项目有 18 个文件、~4300 行代码，实现了完整的 macOS 桌面模拟 + 8 个 App。但存在以下结构性问题：

1. **desktop.js 过于臃肿**（718 行）— 窗口管理、渲染、菜单、快捷键、通知、IPC 全部混在一个文件
2. **无服务抽象层** — App 直接通过 `window.parent.dbManager` 访问数据库，耦合严重
3. **Shell 是硬编码的大 switch** — terminal.html 中 300+ 行 switch-case，无命令注册/分发机制
4. **菜单 action 是静态映射** — `MENU_ACTIONS` 对象无法扩展，自定义 action 需要改核心代码
5. **无事件总线** — 组件间通过直接函数调用通信，无法解耦
6. **进程管理不存在** — `ps`/`top` 在 Terminal 里是随机数，没有真正的进程抽象

**目标**：重构为服务化架构，提取清晰接口，重点强化 Shell 命令系统，保留现有 UI 逻辑不变。

---

## Target Architecture

```
macos/
├── index.html                      ← Thin shell (基本不改)
├── css/
│   ├── desktop.css                 ← 基本不改
│   └── app-common.css              ← 基本不改
├── config/
│   ├── apps.yaml                   ← 基本不改
│   ├── dock.yaml                   ← 基本不改
│   └── system.yaml                 ← 扩展：增加 shell aliases、startup 脚本定义
│
├── js/
│   ├── kernel.js                   ← [NEW] 系统内核：启动序列、服务注册/发现
│   ├── event-bus.js                ← [NEW] 发布/订阅事件系统
│   ├── ipc.js                      ← [NEW] iframe ↔ desktop 通信协议
│   │
│   ├── services/
│   │   ├── window-manager.js       ← [EXTRACT] 从 desktop.js 提取窗口管理
│   │   ├── dock-service.js         ← [EXTRACT] 从 desktop.js 提取 Dock
│   │   ├── menubar-service.js      ← [EXTRACT] 从 desktop.js 提取菜单栏
│   │   ├── desktop-service.js      ← [EXTRACT] 从 desktop.js 提取桌面图标
│   │   ├── notification-service.js ← [EXTRACT] 通知系统独立
│   │   ├── clipboard-service.js    ← [NEW] 系统剪贴板
│   │   ├── config-service.js       ← [REFACTOR] 合并 js/config.js，增加设置持久化
│   │   └── settings-service.js     ← [NEW] 系统偏好读/写接口
│   │
│   ├── shell/                       ← ★ 核心重构：Shell 命令系统
│   │   ├── shell.js                ← [NEW] Shell 引擎
│   │   ├── parser.js               ← [NEW] 命令解析器（tokenizer、引号、变量展开）
│   │   ├── command-registry.js     ← [NEW] 命令注册/分发中心
│   │   ├── executor.js             ← [NEW] 命令执行器
│   │   ├── environment.js          ← [NEW] 环境变量管理
│   │   └── commands/               ← [NEW] 每个命令一个模块
│   │       ├── index.js            ← 导出所有命令的注册列表
│   │       ├── fs-cmds.js          ← ls, cd, pwd, mkdir, touch, rm, cp, mv, cat, head, tail, wc
│   │       ├── sys-cmds.js         ← ps, top, df, du, free, uptime, uname, whoami, hostname
│   │       ├── util-cmds.js        ← echo, date, cal, clear, help, history, which, env, type
│   │       ├── proc-cmds.js        ← kill, jobs, fg, bg, nice
│   │       └── ext-cmds.js         ← python3, node, curl, ssh (toy implementations)
│   │
│   ├── fs/
│   │   └── filesystem.js           ← [REFACTOR] 从 db.js 提取文件系统 API
│   │
│   ├── process/
│   │   └── process-manager.js      ← [NEW] 模拟进程管理
│   │
│   ├── db/                         ← [REFACTOR] 拆分 db.js 为职责单一的 store
│   │   ├── database.js             ← sql.js 初始化、持久化、表创建
│   │   ├── note-store.js           ← Notes 数据操作
│   │   ├── fs-store.js             ← 文件系统存储操作
│   │   └── settings-store.js       ← 设置存储操作
│   │
│   ├── utils/
│   │   ├── dom.js                  ← [NEW] DOM 工具函数
│   │   └── markdown.js             ← 保留，基本不改
│   │
│   └── desktop.js                  ← [REFACTOR] 缩减为引导入口，组装各服务
│
├── apps/                           ← 现有 HTML，逻辑迁移到 js/shell 和 js/services
│   ├── terminal.html               ← [REFACTOR] 使用 Shell 引擎，移除内联 switch
│   ├── finder.html                 ← 轻微改动
│   ├── notes.html                  ← 基本不改
│   ├── settings.html               ← 基本不改
│   ├── calculator.html             ← 不改
│   ├── textedit.html               ← 基本不改
│   ├── monitor.html                ← 基本不改
│   └── browser.html                ← 不改
│
└── docs/
    └── api-reference.md            ← [NEW] 服务接口文档
```

---

## Phase 1: 接口定义（接口先行，不写实现）

### 1.1 IWindowManager
```js
// js/services/window-manager.js
const IWindowManager = {
  open(appKey, opts)         → winObj | null     // 打开 App 窗口
  close(id)                  → void               // 关闭窗口
  focus(id)                  → void               // 聚焦窗口
  minimize(id)               → void               // 最小化
  restore(id)                → void               // 恢复最小化
  toggleMaximize(id)         → void               // 最大化/还原
  getActive()                → winObj | null      // 当前活跃窗口
  getWindows()               → winObj[]           // 所有窗口
  setTitle(id, title)        → void               // 设置窗口标题
  on(event, handler)         → void               // 事件监听
}
```

### 1.2 ICommand（Shell 命令接口）★
```js
// js/shell/command-registry.js
const ICommand = {
  name:        string,          // 命令名（如 'ls', 'cd'）
  description: string,          // 简短描述
  usage:       string,          // 用法示例
  category:    'fs'|'sys'|'util'|'proc'|'net'|'ext',
  
  // 执行函数
  // args: string[]     — 参数列表
  // ctx: ExecutionContext — 包含 env, fs, proc, shell 引用
  // 返回: { stdout: string, stderr: string, exitCode: number }
  execute(args, ctx),
}
```

### 1.3 ExecutionContext（传递给每个命令的上下文）
```js
{
  env:    IEnvironment,     // 环境变量 ($HOME, $PATH, $PWD...)
  fs:     IFileSystem,      // 文件系统操作
  proc:   IProcessManager,  // 进程管理
  shell:  IShell,           // Shell 自身（用于管道、重定向等）
  tty:    ITerminal,        // 终端输出接口（write stdout/stderr）
}
```

### 1.4 IFileSystem
```js
// js/fs/filesystem.js
const IFileSystem = {
  list(path)                    → FileEntry[]
  getEntry(path)                → FileEntry | null
  read(path)                    → string | null       // 读文件内容
  write(path, content)          → boolean
  mkdir(path)                   → boolean
  touch(path)                   → boolean
  remove(path)                  → boolean              // 删除文件/目录
  exists(path)                  → boolean
  resolvePath(base, relative)   → string              // 路径解析
}
```

### 1.5 IShell
```js
// js/shell/shell.js
const IShell = {
  execute(input)               → Promise<CommandResult>
  registerCommand(cmd)         → void                 // 注册命令
  unregisterCommand(name)      → void                 // 注销命令
  getCommands()                → ICommand[]           // 列出所有命令
  getHistory()                 → string[]
  setEnv(key, value)           → void
  getEnv(key)                  → string | null
}
```

### 1.6 IProcessManager
```js
// js/process/process-manager.js
const IProcessManager = {
  spawn(name, pid)             → Process
  kill(pid)                    → boolean
  list()                       → Process[]
  get(pid)                     → Process | null
}
// Process: { pid, name, cpu%, mem, status, user, startTime }
```

### 1.7 Other Services
```js
// 剪贴板
IClipboard: { copy(text), paste()→string, clear() }

// 通知
INotification: { show(title, body), list()→Notification[] }

// 设置
ISettings: { get(key)→string, set(key,val), getAll()→{} }

// 事件总线
IEventBus: { on(event, handler), emit(event, data), off(event, handler) }
```

---

## Phase 2: 核心实现（按依赖顺序）

### 2.1 事件总线（`js/event-bus.js`）
所有服务间通信的基础设施。
- `emit(eventName, data)` — 发布事件
- `on(eventName, handler)` — 订阅事件
- `off(eventName, handler)` — 取消订阅
- 预定义事件：`window:opened`, `window:closed`, `window:focused`, `app:launched`, `clipboard:changed`, `settings:changed`

### 2.2 数据库拆分（`js/db/`）
从单一 `js/db.js` 拆分为：
- `database.js` — 保留 sql.js 初始化和持久化逻辑
- `note-store.js` — Notes 表 CRUD
- `fs-store.js` — fs_entries 表 CRUD
- `settings-store.js` — settings 表 CRUD

### 2.3 文件系统抽象（`js/fs/filesystem.js`）
在 fs-store 之上包装一层路径解析逻辑，提供 IFileSystem 接口。
- 支持绝对路径和相对路径（基于 cwd）
- 支持 `~` 展开、`.` 和 `..` 处理

### 2.4 窗口管理器独立（`js/services/window-manager.js`）★
从 desktop.js 提取所有窗口管理函数，包装为服务对象。
- desktop.js 中保留 DOM 渲染逻辑
- window-manager 只负责状态管理和坐标计算

### 2.5 Shell 命令系统（`js/shell/`）★★★ 最高优先级

#### 2.5.1 `command-registry.js` — 命令注册中心
```js
class CommandRegistry {
  register(cmd: ICommand)           // 注册单个命令
  registerAll(cmds: ICommand[])     // 批量注册
  get(name) → ICommand | null       // 查找命令
  list(category?) → ICommand[]      // 列出命令（可按类别过滤）
  has(name) → boolean
}
```

#### 2.5.2 `parser.js` — 输入解析器
```js
function parse(input: string) → ParsedCommand
// ParsedCommand: { command: string, args: string[], raw: string }
// 处理：引号（"hello world"、'it\'s'）、反斜杠转义、环境变量展开（$HOME）
// 注意：Phase 2 先实现基础解析，Phase 4 再加管道/重定向
```

#### 2.5.3 `executor.js` — 命令执行器
```js
async function execute(parsed: ParsedCommand, ctx: ExecutionContext) → CommandResult
// CommandResult: { stdout: string, stderr: string, exitCode: number }
// 流程：查找命令 → 验证参数 → 调用 cmd.execute(args, ctx) → 返回结果
```

#### 2.5.4 `environment.js` — 环境变量
```js
class Environment {
  constructor()  // 初始化 HOME, PATH, USER, SHELL, PWD, LANG 等
  get(key) → string | null
  set(key, value)
  getAll() → {}
  expand(input) → string  // 展开 $VAR 和 ${VAR}
}
```

#### 2.5.5 `shell.js` — Shell 引擎（组装层）
```js
class Shell {
  constructor(eventBus, fs, proc)
  async execute(input: string, tty: ITerminal) → void
  // 流程：
  // 1. parser.parse(input)
  // 2. env.expand(args)
  // 3. 检查是否为内置命令
  // 4. executor.execute(parsed, ctx)
  // 5. tty.write(stdout/stderr)
  registerCommand(cmd)
  getHistory()
}
```

#### 2.5.6 `commands/` — 命令实现

**fs-cmds.js**（9 个命令）:
| 命令 | 实现方式 | 难度 |
|------|---------|------|
| `ls` | IFileSystem.list() + 格式化（-l 长格式、-a 显示隐藏） | 中 |
| `cd` | 更新 Environment.PWD，路径解析 | 低 |
| `pwd` | 输出 Environment.PWD | 低 |
| `mkdir` | IFileSystem.mkdir(path) | 低 |
| `touch` | IFileSystem.touch(path) | 低 |
| `rm` | IFileSystem.remove(path)，-r 递归删除 | 中 |
| `cp` | 读源文件 → 写目标文件 | 中 |
| `mv` | 复制 + 删除源，或直接 update fs_entries | 中 |
| `cat` | IFileSystem.read(path)，-n 行号 | 低 |
| `head`/`tail` | 读文件 → 取前/后 N 行 | 低 |
| `wc` | 读文件 → 统计行/词/字符数 | 低 |

**sys-cmds.js**（8 个命令）:
| 命令 | 实现方式 | 难度 |
|------|---------|------|
| `ps` | IProcessManager.list() + 格式化表格 | 中 |
| `df` | 模拟磁盘使用（可用 settings 表存容量） | 低 |
| `du` | 递归计算目录大小 | 中 |
| `free` | 模拟内存信息（随机 + 基线） | 低 |
| `uptime` | 记录 kernel 启动时间 → 计算差值 | 低 |
| `uname` | 输出静态系统信息（-a 全量） | 低 |
| `whoami` | 输出 env.USER | 低 |
| `hostname` | 输出系统配置中的 hostname | 低 |

**util-cmds.js**（8 个命令）:
| 命令 | 实现方式 |
|------|---------|
| `echo` | 输出 args 拼接（支持 -n） |
| `date` | `new Date().toString()` |
| `cal` | 日历算法（已有实现） |
| `clear` | 终端清屏 |
| `help` | 遍历 CommandRegistry.list() 输出 |
| `history` | Shell.getHistory() |
| `which` | 在 PATH 中查找命令 |
| `env` | 输出所有环境变量 |
| `type` | 判断命令是 builtin/alias/external |

**proc-cmds.js**（5 个命令）:
| 命令 | 实现方式 |
|------|---------|
| `kill` | IProcessManager.kill(pid)，支持信号名 |
| `jobs` | 列出 Shell 后台任务 |
| `fg`/`bg` | 前后台切换（模拟） |
| `nice` | 修改进程优先级（模拟） |

**ext-cmds.js**（4 个命令）:
| 命令 | 实现方式 |
|------|---------|
| `python3` | Toy REPL：识别 `print()` |
| `node` | Toy REPL：识别 `console.log()` |
| `curl` | 模拟 HTTP 响应 |
| `ssh` | 模拟连接失败 |

### 2.6 IPC 协议定义（`js/ipc.js`）
标准化 iframe App 与 Desktop 的通信协议：
```js
// App → Desktop 消息类型
{
  'window:set-title':  { title: string }
  'window:close':      {}
  'window:minimize':   {}
  'window:maximize':   {}
  'notification:show': { title: string, body: string }
  'clipboard:copy':    { text: string }
  'clipboard:paste':   {} → 返回 { text: string }
  'shell:exec':        { command: string }  ← Terminal 专用
}
```

### 2.7 进程管理器（`js/process/process-manager.js`）
- 维护一个进程列表（Array）
- 启动时自动创建 kernel_task(pid=0), launchd(pid=1), WindowServer, Dock 等
- 打开 App 时 spawn 对应进程
- 关闭 App 时 kill 对应进程
- 提供 CPU/内存使用率的模拟更新（周期性）

### 2.8 剪贴板服务（`js/services/clipboard-service.js`）
- 内存存储（文本）
- 事件：`clipboard:changed`
- 可用于 Edit 菜单的 Copy/Paste 实现真正的复制粘贴
- 快捷键 `⌘C`/`⌘V` 在全局层拦截并写入/读取剪贴板

### 2.9 内核引导（`js/kernel.js`）
```js
// js/kernel.js
const Kernel = {
  async boot() {
    // 1. 加载配置 (config-service)
    // 2. 初始化数据库 (database.js)
    // 3. 注册所有服务到 service registry
    // 4. 发布 'kernel:ready' 事件
    // 5. 渲染 UI
    // 6. 自动启动默认 App
  },
  services: new Map(),   // key → service instance
  register(name, instance),
  get(name),
}
```

---

## Phase 3: App 适配

### 3.1 terminal.html ★（最大改动）
- 移除所有内联 switch-case 命令实现
- 改为调用 Shell 引擎：
  ```js
  const shell = window.parent.kernel.get('shell');
  const result = await shell.execute(input, myTTY);
  ```
- TTY 接口正确输出 stdout/stderr 到 DOM
- 保留：提示符渲染、输入处理、历史记录导航、Ctrl-C 处理

### 3.2 finder.html（轻微改动）
- 已有的 `DB.listDir()` 调用 → 改用 `window.parent.kernel.get('fs')` 接口
- 文件操作通过 IFileSystem 而不是直接调 DB

### 3.3 notes.html（基本不改）
- 已有 DB CRUD 继续工作
- 但可以通过 EventBus 发 `note:created`/`note:updated` 事件

### 3.4 settings.html（基本不改）
- 已有 DB 读写继续工作
- 通过 ISettings 服务读写（包装 DB）

### 3.5 textedit.html（轻微改动）
- 增加 `⌘C`/`⌘V` 使用 IClipboard 服务
- 增加 `⌘S` 保存到文件系统（通过 IFileSystem）

### 3.6 monitor.html（中等改动）
- 使用 IProcessManager 获取真实进程列表
- 使用 EventBus 订阅 `process:updated` 事件更新图表

### 3.7 calculator.html / browser.html（不改）

---

## Phase 4: 高级特性（可选，暂不实现）

### 4.1 Shell 高级特性
- 管道 `|`（连接两个命令的 stdout → stdin）
- 重定向 `>` `>>` `<` `2>`
- 后台执行 `&`
- 命令替换 `` `cmd` `` 和 `$(cmd)`
- 脚本文件支持（.sh 文件执行）
- alias 定义（`alias ll='ls -l'`）

### 4.2 Spotlight 搜索
- `⌘Space` 触发 Spotlight 搜索框
- 搜索 App、文件、设置项
- 快速启动/打开

### 4.3 拖放支持
- 文件在 Finder 中拖放移动
- Dock 图标接受文件拖放打开
- 桌面图标拖放排列

---

## 文件变更清单

### 新建文件（~22 个）
```
js/kernel.js                     ← 系统引导
js/event-bus.js                  ← 事件系统
js/ipc.js                        ← IPC 协议
js/services/window-manager.js    ← 窗口管理
js/services/dock-service.js      ← Dock
js/services/menubar-service.js   ← 菜单栏
js/services/desktop-service.js   ← 桌面图标
js/services/notification-service.js
js/services/clipboard-service.js
js/services/config-service.js    ← 合并 config.js
js/services/settings-service.js
js/shell/shell.js                ← Shell 引擎 ★
js/shell/parser.js               ← 命令解析器 ★
js/shell/command-registry.js     ← 命令注册中心 ★
js/shell/executor.js             ← 命令执行器 ★
js/shell/environment.js          ← 环境变量 ★
js/shell/commands/index.js       ← 命令导出 ★
js/shell/commands/fs-cmds.js     ← 文件系统命令 ★
js/shell/commands/sys-cmds.js    ← 系统命令 ★
js/shell/commands/util-cmds.js   ← 工具命令 ★
js/shell/commands/proc-cmds.js   ← 进程命令 ★
js/shell/commands/ext-cmds.js    ← 外部命令 ★
js/fs/filesystem.js              ← 文件系统 API
js/process/process-manager.js    ← 进程管理
js/db/database.js                ← 从 db.js 拆分
js/db/note-store.js
js/db/fs-store.js
js/db/settings-store.js
js/utils/dom.js
docs/api-reference.md
```

### 修改文件（~8 个）
```
js/desktop.js          ← 大幅缩减，改为 kernel.boot() 入口 + 组装层
js/config.js           ← 合并到 config-service.js
js/db.js               ← 拆分为 db/*.js
js/markdown.js         ← 移到 js/utils/markdown.js
index.html             ← 更新 <script> 引用路径
apps/terminal.html     ← 使用 Shell 引擎，移除内联命令 ★
apps/finder.html       ← 使用 IFileSystem 接口
apps/monitor.html      ← 使用 IProcessManager
apps/textedit.html     ← 使用 IClipboard
```

### 不修改的文件（~8 个）
```
css/desktop.css, css/app-common.css
config/apps.yaml, dock.yaml, system.yaml
apps/calculator.html, browser.html, notes.html, settings.html
```

---

## Implementation Order

```
Phase 2.1  → event-bus.js (30 min)
Phase 2.9  → kernel.js (20 min)  
Phase 2.2  → db/ 拆分 (30 min)
Phase 2.3  → js/fs/filesystem.js (30 min)
Phase 2.4  → window-manager.js (40 min)   ← 从 desktop.js 提取
Phase 2.6  → ipc.js (20 min)
Phase 2.8  → clipboard-service.js (15 min)
Phase 2.7  → process-manager.js (30 min)
            ↑ 以上全部完成后，desktop.js 应缩减至 ~200 行

Phase 2.5  → shell/ 全部 (2-3h) ★★★
            ← parser → command-registry → executor → environment → commands/ → shell.js
            ← terminal.html 适配

Phase 3    → finder.html, monitor.html, textedit.html 适配 (1h)
```

---

## Verification

### 每阶段验证方式
```bash
cd /home/starwink/proj/tmp/macos
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

### Shell 验证 checklist
1. 打开 Terminal → 提示符正确显示 `starwink@MacBook-Pro ~ $`
2. `ls` → 列出 Home 目录文件（从 DB 读取）
3. `ls -l` → 长格式显示权限/大小/日期
4. `cd /Users/starwink/Desktop` → 切换目录
5. `pwd` → 输出当前路径
6. `mkdir testdir` → DB 中创建目录，刷新后 `ls` 仍可见
7. `touch newfile.txt` → DB 中创建文件
8. `cat newfile.txt` → 输出空
9. `echo "hello" > test.txt` — Phase 2 暂不支持重定向，先验证 echo
10. `rm newfile.txt` → 文件被删除
11. `ps` → 显示进程列表（含 Finder, Terminal 等活跃 App）
12. `help` → 列出所有已注册命令
13. `history` → 显示命令历史
14. `uname -a` → 输出完整系统信息
15. `neofetch` → 显示 ASCII art 系统信息
16. 刷新页面 → `ls` 输出仍包含 `mkdir` 创建的目录 → 持久化验证 ✓

### 事件系统验证
- 打开 Terminal → `window:opened` 事件触发
- 在 TextEdit `⌘C` → `clipboard:changed` 事件
- 在 TextEdit `⌘V` → 读取剪贴板内容并插入

### 回归验证
- 所有原有功能正常：窗口拖拽/缩放、Dock 点击、菜单下拉、桌面图标双击
- 8 个 App 全部能正常打开和交互
