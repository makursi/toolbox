# rich-text-editor · 设计规则（工具级）

> **管什么**：这个 Tool 自己的设计规则与词汇：页面结构、文档模型、本地草稿、命令表、键盘、工具栏、斜杠菜单、Markdown 输入规则、浮动工具栏、导入、导出、占位符、可访问名与命中区。**只约束 rich-text-editor；站点级规则**（外壳、设计语言、CSP、门禁量具、Tool 契约）在 `apps/web/docs/design.md` 与 `apps/web/docs/design/`，两者不互相重复。站点文档只装站点级规则，一个工具的私有规则住在这里，见 `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`。**和它一起读**：`README.md`（怎么工作、手工清单）、`docs/agents/design-notes.md`（这棵树为什么这样长）、issue #205（spec）、#206（画布）、#207（工具栏与命令表）、#208（斜杠菜单、输入规则、浮动工具栏）、#209（本地草稿）、#210（导出与文件名）、#211（导入）。

## 词汇

站点术语表（`CONTEXT.md`）只定义站点词；下面几个是本工具的领域词，本站其它文档不继承它们的含义：

- **文档（document）**：一次编辑的全部内容。规范形式是 ProseMirror JSON；标题块是它的第一个节点，正文段接在后面。
- **画布（canvas）**：文档的编辑区，一块约 **720px** 的阅读度量。标题就是它的第一行，没有第二个标题输入框。
- **标题块（title block）**：文档的第一个节点，一个 H1。它在页面里是画布的第一行，在导出文件里是文档标题。
- **文档标题（document title）**：文档顶层**第一个 heading** 的文字，取不到就是空串。它进 HTML 的 `<title>` 与导出文件名；正文里后来加的标题不是它。
- **正文段（body paragraph）**：标题块之后的段落；一次回车产生一个新的段落。
- **草稿（draft）**：这台浏览器里保存的那一份文档。一个 IndexedDB 数据库、一个对象仓库、一个键下的一条记录，记录里是 schema 版本、ProseMirror JSON 文档与写入时间戳。每台浏览器只有一份，没有文档列表。
- **保存状态（save status）**：工具栏右端那四个状态：**未保存**（有改动，800ms 的防抖窗口还没关）、**保存中**（写入正在进行）、**已保存到本机**（记录已经提交）、**保存失败**（浏览器拒绝了这次写入，旁边出现「重试」）。状态句来自 `core/copy.ts`。
- **命令表（command table）**：`core/commands.ts` 里的那一份列表，工具栏、斜杠菜单与浮动工具栏都从它渲染。它只描述命令，不执行命令。
- **执行表（executor map）**：`editor/execute.ts` 里把每个命令 id 映射到一条 TipTap 链的对象，三个命令面共用它。`Record<Exclude<CommandId, "link">, ...>` 让「表里有、执行表里没有」成为 `tsc` 错误；链接是唯一有界面而没有链的命令，它由 `link-control/link-control.tsx` 负责。
- **工具栏（toolbar）**：画布上方那一行命令，按组排列：撤销重做、块类型、行内标记、列表、插入动作，右端是保存状态与文件菜单。它是页面级的命令条，不是画布的一部分。
- **斜杠菜单（slash menu）**：在段落开头输入 `/` 打开的块命令列表，行是命令表过滤出来的；上下键移动、回车应用、Esc 关闭，位置跟着光标。
- **浮动工具栏（selection toolbar）**：选区非空时出现在选区旁边的那一行，内容是五个行内标记加链接动作。它和钉在画布上方的那条工具栏是两件东西：那一条常驻，这一条只在有选区时存在。
- **导出（export）**：把规范文档派生成一种可下载文件的过程。两种格式：`markdown`（GFM，扩展名 `.md`）与 `html`（完整独立文档，扩展名 `.html`）。**导出不是文档的第二种源**：文档始终是 ProseMirror JSON。
- **导入（import）**：把一个 `.md` 或 `.html` 文件读成文档、替换当前草稿的过程。**导入也不是第二种源**：Markdown 读成 JSON，HTML 先消毒再交给 TipTap 的解析器，最终文档仍是编辑器自己的 JSON。
- **消毒（sanitise）**：`core/html-import.ts` 的 `sanitizeHtml`。丢掉脚本、样式、`<head>` 与编辑器没有节点/标记的元素与属性，留下编辑器认识的元素；导入与粘贴走同一条规则。
- **占位（replace）**：导入会替换整份文档。草稿里有内容时先问（「替换当前文档？」），取消什么都不改；草稿为空时直接替换。
- **导出文件名（export filename）**：`<sanitised title>-YYYY-MM-DD.<ext>`，标题部分最多 40 个字符；标题为空或全是不合法字符时用 `文档` 替代。界面里没有文件名输入框。

## 页面结构

- 本页是**外壳 + 一条工具栏 + 一块画布**。返回首页、标题「富文本编辑器」、描述与 `metadata` 来自站点级 `ToolPage` 外壳（`src/components/tool-page/`），不在本文件职权内。
- 工具栏是**内容列宽（960px 上限）**，画布是它下面的 **720px 阅读度量**。工具栏是页面级的命令条，不是画布的一部分，所以它允许比文字所在的度量宽；画布仍在 960px 列里居中。
- 工具栏是**一条常驻的行，不吸顶、不浮动**：它「钉」在画布上方，和 #208 那个跟着选区浮动的工具栏是两件东西。站点页头本身也不吸顶（`apps/web/docs/design/components.md`），一条随页面滚走的命令条不会盖住正在写的字。
- 工具栏的外框与画布同一套：发丝边框、8px 圆角、画布色底。画布在工具栏下方 `mt-6`，工具栏本身在页面标题下方 `mt-10 sm:mt-12`。
- 编辑器还没水合时，工具栏的位置由一个同高的占位块占着（44px 控件加两层 4px 内距 = 60px），所以编辑器到达时画布不会跳一下。
- **窄屏上中间的组横向滚动，右端的保存状态与文件菜单不动**：滚动区是一个 `min-w-0 flex-1 overflow-x-auto` 的兄弟，保存状态与文件菜单在它外面、`shrink-0`。这是 #207 的验收项，但读它的是**命中区量具**的 `toolbar-scroll-end`（它把滚动区滚到底再读两边），不是门禁：位置是几何，几何归 `scripts/`（`apps/web/docs/design/instruments.md`、`docs/adr/0012-playwright-for-the-browser-gate.md`）。门禁在 390px 只做行为的那一半——按「文件」还能打开菜单、四项都在。页面横向溢出由量具的 `horizontal-overflow` 读，同样不是门禁的事。
- `data-slot="rich-text-toolbar"` 是工具栏的指纹锚点，`data-slot="rich-text-canvas"` 是画布的，`data-slot="rich-text-save-status"` 是保存状态的；工具栏里的滚动区另有 `data-slot="rich-text-toolbar-scroll"`，供命中区量具的 `toolbar-scroll-end` 读滚动行为，不进指纹声明。保存状态单独成锚点：它的句子在四个状态之间改变宽度，把它引起的变化读成状态自己的移动，而不是整个工具栏变形。

## 文档模型

- **规范文档是 ProseMirror JSON**。Markdown 与 HTML 都是导出时从它派生出来的，不是源（#205 的 Implementation Decisions）。
- 初始文档是**两个空节点**：一个 H1 标题块与一个段落。它现在住在 `core/document.ts`（`EMPTY_DOCUMENT`），因为编辑器从它开始，文件菜单的「清空」也回到它；两处各写一份就是两个「空文档」的定义。同文件里的 `documentTitle` 是文档标题的唯一取法（顶层第一个 heading 的文字），HTML 的 `<title>` 与导出文件名都从它来。
- **持久化的是同一份 JSON**：草稿记录里不存 Markdown、不存 HTML，也不存编辑器的 DOM。细节见下面的「草稿与保存」。
- 编辑器**只在客户端创建**（`immediatelyRender: false`），而且**要等草稿读出来之后才创建**：服务端只发出一个空的画布，编辑器的内容与工具栏都不进服务端 HTML；如果先给编辑器一份空文档、再把草稿 `setContent` 进去，晚到的恢复就会盖在访客已经敲下的字和光标上。外层因此先渲染占位，读到记录（或确认没有）后才挂载编辑器。
- 编辑器自己收着文档，没有从 props 重新灌入内容的路径；`initialContent` 只在挂载时读一次。所以页面重渲染不会重置文档，门禁读的就是这一条。
- **组件的表面是「文档的两端 + 本工具自己的草稿控制」，不是一个宿主配置对象**。页面里那个 `RichTextEditor` 不接任何 prop；它挂载的编辑面接 `initialContent` 与 `onChange`（文档的两端），再向工具栏交出 `saveStatus`、`onRetry`、`onClear` 三枚草稿控制，三者都从 `useDraft` 来、只在这个 Tool 里存在。`#205` 的「surface is `initialContent` and `onChange` only」说的是**给宿主的**面：save/upload/readOnly 回调与配置对象仍然等到有真宿主时再说，这三枚草稿控制不是它们——它们不描述宿主要什么，而是这一页没有宿主时草稿自己的三个动作（状态、重试、清空）。把两者混成一句话，会让下一个人以为这里已经有一个宿主 API。

## 草稿与保存

- **存储形状**：一个 IndexedDB 数据库（`rich-text-editor`）、一个对象仓库（`drafts`）、一个键（`draft`）下的一条记录。记录是 `{ version, document, savedAt }`：`version` 是记录自己的 schema 版本（`DRAFT_SCHEMA_VERSION = 1`），`document` 是 ProseMirror JSON，`savedAt` 是写入时间戳。每台浏览器只有一份草稿，没有文档列表，也没有按文档分键。
- **手写、无依赖**：四件事（打开、读、写、删）由 `draft/draft-store.ts` 直接对着 IndexedDB 写完；没有包装库，因为这一层需要的接口比任何一个包装都小。连接懒打开，导入时不碰 `indexedDB`，否则预渲染的服务端没有这个对象。
- **读回来的记录先过 guard**：`core/draft.ts` 的 `isStoredDraft` 只接受本版本、有数字时间戳、`type: "doc"` 且 `content` 是数组的值。旧版本、半截记录、别的类型都按「没有草稿」处理，不猜、不修。读失败也只是一块空画布：没有写入被拒绝，也就没有要访客回答的失败。
- **恢复是静默的**：挂载时读一次，有记录就作为编辑器的初始内容，没有就回到 `EMPTY_DOCUMENT`。**不弹提示、不问要不要打开**，界面里也没有「恢复草稿」按钮。
- **保存状态机是纯的**（`core/save.ts`）。四个状态：`dirty`（未保存，防抖窗口开着）、`saving`（保存中，写入进行中）、`saved`（已保存到本机）、`failed`（保存失败）。**改动**把 revision 加一并开一个 800ms 的窗口；**窗口关闭**或**页面变 hidden** 才进入 `saving`；写入结果带着自己开始时的 revision 回来，revision 对不上就丢弃。所以「在旧写入还没回来时又敲了一个字」不会被旧结果画成已保存。
- **两个计数器各管一件事**：`revision` 是文档的代，`run` 是写入的代。改动只动 `revision`；开始一次写才动 `run`。`run` 也是重试能重新触发写入的原因（失败 → `saving` → `run + 1`），而不需要把同一份文档再当成一次改动。
- **防抖 800ms**（`SAVE_DEBOUNCE_MS`）：每次改动重置窗口。`visibilitychange` 在 `document.visibilityState === "hidden"` 时**立刻写**，不等窗口关闭；已保存的页面被隐藏时什么都不做，正在写的页面被隐藏时也不并发开第二个写。
- **失败与重试**：只有浏览器拒绝写入才会到 `failed`。失败句是 `core/copy.ts` 的 `SAVE_STATUS_TEXT.failed`（「保存失败，草稿还在页面上。」），旁边出现「重试」。重试**重放失败的那次操作**：写入失败就用失败时的那份文档，删除失败就再删一次。画布上的内容不因为失败而丢。
- **清空是删除，不是写空文档**：文件菜单的「清空」用 `setContent(EMPTY_DOCUMENT, { emitUpdate: false })` 换掉画布，并调用 `removeDraft` 删记录。`emitUpdate: false` 防止空文档被当成一次改动而重新写回一条记录；revision 加一让任何在途写入过期；IndexedDB 的事务顺序保证删除排在那次写入之后。所以重新加载后画布和仓库都是空的。
- **不设文档大小上限**：没有长度、节点数或字节数的检查。唯一的边界是浏览器的配额拒绝，它走 `failed` 那条路。
- **句子在纯层**：四个状态句与「重试」标签都在 `core/copy.ts`，由 Vitest 盯住措辞与标点；工具栏只决定画哪一句。

## 命令表

- `core/commands.ts` 是**编辑器命令的唯一清单**，字段是 `id`、`label`、`group`、`keywords`、`block`、`icon`。`group` 就是工具栏的分组（`history` / `block` / `mark` / `list` / `insert`）；`block` 是命令作用的文档构造（块命令是节点名，行内命令是 mark 名，撤销重做是 `document`）；`keywords` 同时收中文与英文，供斜杠菜单过滤。
- **文件菜单的四项不在这张表里，这是有意的窄口**：导入与两次导出是围着文档做文件 I/O，不改变文档；清空是草稿仓库的删除，不是 `setContent(EMPTY_DOCUMENT)`，所以它没有一条编辑器链可写。把它们塞进表就得给执行表开第四个例外，而声明「表里的每一行都有执行器」比声明「菜单也渲染表」更值钱——所以在 `file-menu/file-menu.tsx` 里就这一次，`CommandGroup` 里也没有 `file` 这一档，表里更没有一行没人渲染的 `clear`。表曾经有过那一行，它指向第二个 `setContent(EMPTY_DOCUMENT)` 的定义，且用的是默认 update（会把清空当成一次改动写回一条空记录）；那条死定义已经删掉，清空只有「草稿与保存」一节里那一条活的路径。
- **纯的部分是数据加过滤函数**：`filterCommands(query)` 按 label 与 keywords 做大小写不敏感的子串匹配，空查询返回整张表，命中结果保持表的顺序。`commandsInGroup(group)` 给工具栏按组取命令，同样保持顺序。
- **执行不是这张表的事**。`editor/execute.ts` 的执行表把 id 映射到一条 TipTap 链（`toggleBold`、`toggleHeading({ level })`、`toggleTaskList`、`setHorizontalRule`……），`Record<Exclude<CommandId, "link">, ...>` 让漏掉的命令在 `tsc` 就红，而不是变成一个点不动的按钮。命令**是否真的生效**由浏览器门禁回答，组件自己证明不了。
- **表的单测只到数据，应用是门禁的**（#207 复审，spec 的那条「each command applied to a document produces the expected document」）：`core/__tests__/commands.test.ts` 盯 id 唯一、label 与 keywords 非空、组内顺序、过滤与斜杠菜单的谓词；**没有一条单测真的把命令作用到文档上**。原因是这一层没有无 DOM 的路：执行器是 TipTap 的链，TipTap 建编辑器要 `document`、`window` 与可编辑元素，而本仓的单测是 Node、无 DOM（`docs/adr/0003-vitest-for-unit-tests.md`）；要在这里跑它就得引 jsdom（新依赖）或在纯层重写一遍 TipTap 的行为（那是第二份实现，不是测试）。所以「命令生效」由门禁按坐标与键盘逐条按出来，纯层只保证表本身没有缺口。
- **链接是唯一有界面没有链的命令**：`runCommand` 对它返回 `false`，调用方知道这个动作要开一个输入框；`link-control/link-control.tsx` 是那唯一的输入框，工具栏与浮动工具栏都用它。
- **三个命令面从同一张表渲染**：钉住的工具栏、斜杠菜单、浮动工具栏。加一条命令是一处编辑：表里加一行，执行表里加一个 handler；三处不需要各改一次。文件菜单是第四个面**而不**从表渲染，理由在上面那一条。

## 键盘

- **user story 9 的整套快捷键**：撤销/重做 `Mod-Z` / `Mod-Shift-Z`，五个标记 `Mod-B` / `Mod-I` / `Mod-U` / `Mod-Shift-X` / `Mod-E`，标题 `Mod-Alt-1/2/3`，三个列表 `Mod-Shift-7/8/9`。除了链接之外**全部是 StarterKit 自带的 keymap**（History、Heading、BulletList、OrderedList、TaskList、Underline、Strike、Code），所以这里一条扩展都不加：再加一份就是同一条规则的第二份定义，而版本与默认配置在 `RichTextEditor.tsx` 的注释里。
- **`Mod-K` 是这一片自己接的那一个**：链接是唯一「有界面没有链」的命令，地址框是 React 的，TipTap 的 keymap 打不开它。`editorProps.handleKeyDown` 先接住 `Mod-K`（`preventDefault`，所以那个 `k` 不会落进文档），把一次请求计数交给工具栏的 `LinkControl`（`openRequest`），由它打开地址框并预填现有的链接；计数而不是布尔值，是为了第二次按还是第二次打开。
- 门禁真的按了这些键：`Control+B`、`Control+K`（链接的字段出现、应用后文档里有那个 `a`）、`Control+Alt+1`（标题）与 `Control+Shift+8`（项目符号列表），外加 `Control+Z` / `Control+Shift+Z`。只在工具栏上证明过的快捷键不算证明。

## 工具栏

- 工具栏从表渲染，不另写一份控件清单：撤销/重做、块类型菜单、五个行内标记、三个列表、四个插入动作，右端是保存状态与文件菜单。
- **保存状态在工具栏右端、文件菜单左边**：它是这一行里唯一不靠访客点击就会变的东西，所以和文件菜单一起留在不滚动的 `shrink-0` 区。句子来自纯层的 `SAVE_STATUS_TEXT`，用 `<output>`（隐式 `role="status"`）加 `aria-live="polite"` 播报；`min-w-[6em]` 让「未保存」「保存中」「已保存到本机」之间切换时不把文件菜单推来推去。失败句更长，允许它自己撑宽；「重试」是 44px 的文字按钮，只在失败时存在。
- **状态来自 `useEditorState`**（`hooks/use-editor-command-state/`）：光标处的 mark、列表、块类型都由编辑器的 state 读出来，组件里没有一份「加粗是不是开着」的副本。`pressed` 是 `Record<CommandId, boolean>`，所以新命令不会悄悄没有状态。这个 hook 也是浮动工具栏读状态的地方，两处不是两份。
- **会切换的按钮带 `aria-pressed`**：五个行内标记、三个列表、引用与代码块是 Radix 的 `Toggle`，由 `pressed` 控制；读屏读到的是「已按下 / 未按下」，门禁读的也是这个属性。撤销、重做、分隔线、链接是动作按钮，不带 `aria-pressed`。
- **按下的状态是墨色实心，并且只有一个组件**：`command-toggle/command-toggle.tsx` 是那枚按钮（墨色开态、44px 自己的框、`shrink-0`），工具栏与浮动工具栏都用它，所以同一状态在两处的画法与命中区只有一份。注册表 `Toggle` 自己的开态是 hover 表面（1.1:1），「开着」会看起来像「鼠标停着」；本站只有一个实心控件语言（`Button` 的默认变体：纸在墨上），所以开态复用它，hover 时也保持墨色。
- **块类型菜单显示当前块**：触发器上写「正文」或「标题 1–3」，无障碍名是 `块类型：<当前块>`。菜单里当前块那一项带一个勾，其余项留出同样的位置。选中一项后菜单关闭，状态随光标走。
- **链接是一个小弹出层**：一个「链接地址」输入框、一个「应用」、以及链接存在时出现的「移除」。它设置、编辑、移除选区上的链接；输入框在打开时预填当前链接的地址，所以第二次打开是编辑而不是重设。字段的 id 来自 `useId`，因为工具栏与浮动工具栏的两个实例可以同时存在。`StarterKit` 的 Link 扩展以 `openOnClick: false` 配置：在 contenteditable 里点链接是把光标放进去，不是离开一份还没保存的文档。
- **文件菜单是「导入 / 导出 Markdown / 导出 HTML / 清空」，并且是它自己的一块**（`file-menu/file-menu.tsx`）：四项都是带文字的菜单按钮，各占 44px 高的一行；导入在最上面，两次导出在中间，清空在最后一条分隔线之下。它从 451 行的 `toolbar.tsx` 里被切出来，因为它和工具栏的其余部分没有共享状态——它带着自己的文件输入、待处理导入与确认框，工具栏只传一个 `onClear`。导入打开一个 `sr-only` 的 `input[type=file]`（`accept` 收 `.md` / `.markdown` / `.html` / `.htm` 与两种 MIME），输入框选完清空 `value`，所以同一个文件选第二次照样触发。导出把规范文档交给对应写手生成下载文件（见「导出」）；清空调用的就是「草稿与保存」里那一条活路径（`setContent(EMPTY_DOCUMENT, { emitUpdate: false })` 换回画布并删掉 IndexedDB 里的记录），占位符随之回来。没有文件名输入框：文件名由导出规则派生。导入见「导入」。
- **撤销与重做灰掉时说明原因**：这两枚是这条工具栏里唯一天生就会禁用的控件（空文档没有可撤销的步骤），而 `apps/web/docs/design/components.md` 要每一枚禁用的控件都说清缺的是哪一步。两句句子在 `core/copy.ts` 的 `HISTORY_DISABLED_REASON`（「没有可撤销的步骤。」/「没有可重做的步骤。」），由单测盯住措辞与标点；**它们挂在控件自己身上**：`title` 给指针，`aria-describedby` 指向一段 `sr-only` 的说明给读屏。挂在控件上而不是在行下面加一行，是因为这是一条 44px 的常驻行，一行动态出现的说明会在第一次击键时把画布往下推——而这条规矩要防的是「灰了不说」，不是「必须换行」。
- **任务列表的复选框名是中文**：`TaskItem` 的 `a11y.checkboxLabel` 写成「未完成：… / 已完成：…」，因为扩展的默认名是英文，而这一页的界面是中文。任务项嵌套由 `nested: true` 打开。

## 斜杠菜单

- **触发是「段落开头」而不是「句子里」**：`@tiptap/suggestion` 以 `char: "/"`、`startOfLine: true` 配置，`allow` 再收一道口子，只认文档第一层的 `paragraph`。标题块里的 `/` 和嵌套块（列表项、引用里）里的 `/` 都是普通字符。
- **它只列块命令**：行来自 `slashCommands(query)`，也就是 `filterCommands(query)` 再按 `block` 字段筛出能「产生一个块」的行（`paragraph`、`heading`、三个列表、`blockquote`、`codeBlock`、`horizontalRule`，共十条）。标记需要选区，链接需要选区加输入框，撤销/重做作用于整份文档，所以它们不进行列；这条谓词写在 `core/commands.ts` 里，不是组件里的第二份清单。清空根本不在表里，见「命令表」。
- **键位**：上下键在行间循环，回车应用（`/query` 先被删掉，命令再作用在那个空块上），Esc 关闭。Esc 是建议插件自己消费的：它先调用组件的 `onKeyDown`，再关闭菜单，所以组件对 Esc 返回 `false`，不重复处理。
- **空格结束匹配**：`/标题 ` 里的空格让匹配结束、菜单关闭，`/标题` 留在文档里；只有真按了回车，`/query` 才会被当作过滤词删掉。这条是「输入不被吃掉」的实现，门禁里有对应断言。
- **位置由插件的 `mount` 负责**：它把菜单元素挂到 body，用插件自己的 `clientRect`（光标处的矩形）在下方 4px 处定位，滚动与缩放由 Floating UI 跟随。菜单组件由 `ReactRenderer` 画进那个元素，所以它不在页面自己的 React 树里；键位通过 ref 句柄转进去，光标始终留在文档里。
- **行是菜单项而不是标签页**：外层 `role="menu"` 名为「插入内容」，每行是 `role="menuitem"` 的按钮（图标 + 标签），当前行带 `aria-current="true"`，`tabIndex={-1}` 是故意的，焦点不离开文档；没有命中时显示「没有匹配的命令」（句子在 `core/copy.ts`）。每行是 44px 自己的框并带 `.touch-target`。

## Markdown 输入规则

- **本片没有新增任何扩展**，这是查过的结论而不是省略：`#` / `##` / `###`（Heading）、`-`（BulletList）、`1.`（OrderedList）、`>`（Blockquote）、围栏反引号（CodeBlock）、反引号对（Code，行内）、`---`（HorizontalRule）、`**` / `*` / `~~`（Bold / Italic / Strike），**全部由 StarterKit 自带**，版本与它的默认配置见 `RichTextEditor.tsx` 的注释。再加一条扩展就是同一条规则的第二份定义。
- **规则只在完整构造出现时触发**：`#` 后面要有空格，`**`、`~~`、反引号都要有收尾，`---` 要正好是整段文本。所以以这些字符开头但不成规则的段落仍是文字（`#没有空格`、`>没有空格`、`-没有空格`、`1.没有空格`、未闭合的反引号、未闭合的 `**`），门禁逐条断言两端。
- **`---` 在第三个 `-` 落下时就是分隔线**：这是 Markdown 自己的行为，不是把文字吃掉；`---abc` 这种「先成规则再继续打字」的路径不成立，因为规则在第三个字符时已经生效。

## 浮动工具栏

- **只在选区非空时存在**：组件在选区为空时直接不渲染，所以文档里没有一排隐藏的按钮。这是命中区量具的要求：`.touch-target` 是它的标记，一排 `visibility: hidden` 的按钮会被量成「哪里都点不到」的控件。
- **内容是同一张表的行内标记加链接**：五个标记来自 `commandsInGroup("mark")`，链接来自 `commandById("link")`，没有第二份清单；标记按钮与工具栏共用 `CommandToggle`，链接输入框与工具栏共用 `LinkControl`。
- **位置来自选区自己的矩形**：`coordsAtPos(from)` 与 `coordsAtPos(to)` 取两个角，行底放在「选区顶 − 8px」；上方放不下时翻到「选区底 + 8px」；左右夹在视口边缘内 8px。两个方向都只碰选区的边，不盖住字。用编辑器的位置而不是 `window.getSelection`，是因为按下其中一个按钮之后浏览器选区已经不在，而文档里的选区还在，命令作用的正是后者。
- **两遍：先画、再量、再定位**。第一遍用已知的宽高（首帧是 0）放置，`useLayoutEffect` 在浏览器绘制前量到真实高度并落位，所以没有「先盖住再跳开」的一帧。**「不盖住选中的字、也不跑出视口」由命中区量具的 `selection-toolbar-clearance` 读**（它自己造一段选区，再读两边的盒子）；门禁只按行里的加粗按钮，不再比较 `boundingBox`。
- **滚动与缩放只重算、不动画**：行是 `position: fixed`，页面一滚它就会离开选区，所以要重算位置。重算**不监听 `window` 的 `scroll`**（`apps/web/docs/design/motion.md` 明令禁止那个写法，它是滚动驱动动画溜进来的入口），而是 `document` 上一个 `passive` 的 `scroll` 监听（捕获阶段，所以页面自己的滚动与页内滚动区都看得见）加一个 `resize`，两者都只把 `requestAnimationFrame` 排一次——一帧最多重画一次，滚动本身永远不被阻塞。这里没有动画，只有「行跟着走」。
- **为什么不用 `@tiptap/extension-floating-menu`**：它的插件在 `show()` 之前先算位置、再把元素挂回文档，React 画的这一行会在「还没有内容的盒子」上定位，行会落在选区上（也就是这条规则要防的那件事）。它的 React 绑定 `@tiptap/react/menus` 同样用不了：那个入口为了同文件的 `BubbleMenu` 静态 import 了本工具没有声明的 `@tiptap/extension-bubble-menu`。**这个依赖已经删掉**（#207 复审）：声明了却没有 import 是一个没人用的依赖，而行是页面里一个 `position: fixed` 的普通 `div`，不是任何插件的 portal。理由写在 `selection-toolbar/selection-toolbar.tsx` 顶部。
- **无障碍名是「选中文本的格式」**，每个按钮的名字来自命令表；读屏读到的是第二个工具栏区域，而不是一排和上面重名的按钮。

## 导出

- **规范文档仍然是 ProseMirror JSON**，Markdown 与 HTML 都是导出时从它派生出来的纯函数：`core/markdown.ts` 与 `core/html.ts` 只吃 JSON、吐字符串，不碰 DOM，也不把导出结果回灌成文档。
- **Markdown 是 GFM**：标题、段落、嵌套的项目符号/编号/任务列表、引用、带语言的围栏代码块、分隔线、链接，以及加粗、斜体、删除线、行内代码。**下划线没有 GFM 形式，写成内联 HTML `<u>`**，这是本工具唯一一处内联 HTML。
- 任务项写成 `- [ ]` / `- [x]`；**嵌套缩进到父标记的内容列**（`- ` 是 2，`1. ` 是 3，`- [ ] ` 是 6），而不是固定两格，因为 CommonMark 的嵌套以内容列为准。
- 文本**按 GFM 的要求转义**：行内语法字符（`\`、反引号、`*`、`_`、`[`、`]`、`<`、`>`、`~`、`&`）在任何位置转义，块起始字符（`#`、`>`、`-`、`+`、`=`、`1.`）在行首转义；行首守卫只发生在段落第一段文本与硬换行之后，标题、列表项与引用都有各自的标记挡在前面。代码内容不转义，围栏长度超过代码里最长的反引号串。
- **空文档导出空字符串**，而不是一个孤零零的换行：两者都是合法 GFM，`""` 才是「文档里什么都没有」的那个。非空文档以恰好一个换行结尾。
- **HTML 是完整独立文档**：doctype、`lang="zh-CN"`、`<meta charset="utf-8">`、viewport、文档标题进 `<title>`、`<style>` 内嵌样式，正文是 `<article>` 里的语义元素。样式只用系统字体栈，不引任何外部资源：一个被发出去的文件不能因为打开而向外请求。标题为空时 `<title>` 写「无标题」（编辑器里的占位符也是这句）。空文本块不产出空标签。
- **文件名规则在 `core/naming.ts`**：清洗标题（去控制字符与 `<>:"/\|?*`、压缩空白、去尾部点与空格）、截到 40 个字符、拼上本地日期 `YYYY-MM-DD` 与格式扩展名（`.md` / `.html`）；标题为空或清洗后为空时用 `文档`。40 是**标题**的上限，不是整个文件名的上限，日期与扩展名永远不会被截掉。**40 这个数是设计会话里定下的决定，不是实现里随手挑的一个数**，所以它同时写在这里与 `docs/agents/design-notes.md` 的分支 10；`#205` 与那份笔记原先都漏了它，于是「标题最多 40 字」变成一个没人问过的问题（#207 复审把它补上）。门禁与单测都按这个数断言（长标题被截、日期与扩展名完整）。
- 工具栏只做三件事：取 `editor.getJSON()`、调对应写手、把字符串变成 blob 并触发下载。blob URL 在下一轮任务里 revoke，避免字节还没被浏览器取走就失效。
- 导出的文件名与字节由门禁读回来断言；写手的 GFM/HTML 语义由 Vitest 用 JSON 字面量断言。两处都**不调用序列化器自己的 helper 来造期望值**，否则期望值和实现会一起对。
- 不用新依赖，不用 `document.execCommand`，不请求任何 origin。

## 导入

- **入口是文件菜单里的「导入」一行**：它是一个真 `<button>`，只做一件事，点开旁边 `sr-only` 的 `input[type=file]`（`apps/web/docs/design/components.md` 记的「文件按钮加隐藏输入框」形状）。输入框是真正收文件的东西，门禁按坐标先按「导入」这一行、再由文件选择器交出文件；`accept` 是 `core/import.ts` 的 `IMPORT_ACCEPT`。选完清空 `value`，同一个文件第二次也能导入。
- **格式先看扩展名，再看内容**：`.md` / `.markdown` 是 Markdown，`.html` / `.htm` 是 HTML；名字没有可用扩展名时才嗅内容（doctype、`<html>`、`<body>` 或一个块级开头元素），再认不出就按 Markdown。理由写在 `core/import.ts`：Markdown 是本工具写的格式，而且它的解析器最宽容，所以它是「猜错也安全」的那一边。
- **Markdown 读成 JSON，HTML 读成消毒过的片段，而这是一处记录在案的偏差**。`#205` 的 Implementation Decisions 说这个工具有一个「import parser for Markdown and HTML」，且「nothing in it touches the DOM」。Markdown 那一半是真的：`core/markdown-import.ts` 不碰 DOM，直接产出 ProseMirror JSON，在 Vitest 的 Node 里用 fixture 测。HTML 那一半**不是**一个纯 JSON 解析器：`core/html-import.ts` 只负责**消毒**并返回 HTML 字符串，最后一步 DOM 解析是 `editor.commands.setContent` 里 TipTap 自己的解析器。**理由**：把 HTML 变成文档要回答的是「这个元素在**当前 schema** 里是什么节点、这个属性是不是这个 mark 的合法 attrs」，而 schema 的唯一权威是 TipTap 的；在纯层再写一份映射就是第二个 schema 知识来源，schema 一改它就悄悄漂移，而这正是本工具一直在防的东西（`EMPTY_DOCUMENT` 与命令表都是同一条道理）。**消毒器负责什么**：它有自己的 tokenizer 与片段解析器（`parseFragment`，不依赖 DOM）、元素与属性的白名单、两种任务列表写法归一、实体解码与再转义，以及「丢掉 `<script>`、样式、`<head>`、图片与 `javascript:` 链接」；这些都有单测（`html-import.test.ts`），所以「HTML 进不来脚本」与「导出的 HTML 能再导入」是纯层的断言。**它不负责什么**：任何 HTML 到 ProseMirror JSON 的映射。**未来若有一条不依赖 DOM 的纯 JSON 路径**：它要自带一份与 TipTap schema 同步的节点/标记表，并且最好由 TipTap 的 schema 生成而不是手抄；在那之前，把消毒器说成解析器只会让这条偏差消失而不是被修好。
- **Markdown 解析器只认本工具导出的那套 GFM**：标题、段落、嵌套的项目符号/编号/任务列表、引用、带语言的围栏代码块、分隔线、链接、强调、删除线、行内代码，以及导出里唯一的内联 HTML 构造 `<u>`（下划线）。**不认识的语法保持文字**：表格、引用式链接、图片语法、未闭合的强调或链接都不报错、不吞段落；任何输入都不抛异常。
- 列表按**标记的内容列**嵌套（`- ` 是 2，`1. ` 是 3，`- [ ] ` 是 6），所以导出写出的六格缩进读回来仍是嵌套任务列表；一个列表里只要有一项带 `[ ]` / `[x]`，整张表就是任务列表，其余项读成未勾选（schema 不允许两种 item 混在一张表里）。
- **HTML 消毒器丢掉的东西**：`<script>`、`<style>`、`<title>`、`<head>` 子树、注释、doctype、事件处理属性、`style` 属性、图片（编辑器没有图片节点）、`javascript:` / `data:` 链接（链接退成文字），以及所有编辑器没有节点或标记的包裹元素（`div`、`section`、`span`、表格……只保留里面的字）。**保留的东西**：标题 1–6、段落、引用、围栏代码块（`pre > code` 的语言类）、分隔线、三种列表、`strong` / `em` / `u` / `s` / `code` / `a href` / `br`。
- 任务的两种写法都认：导出写的 `<ul class="task-list">` + `<input type=checkbox>`，和编辑器自己的 `ul[data-type=taskList]` + `li[data-type=taskItem][data-checked]`。读回来统一写成编辑器那一种，所以**导出的 HTML 能再导入**。
- 文本实体在入口解码、在出口转义，所以 `&amp;` 进来是 `&`、出去还是 `&amp;`，不会变成 `&amp;amp;`。
- **粘贴走同一条消毒**：编辑器在 `editorProps.transformPastedHTML` 里调用 `sanitizeHtml`，ProseMirror 解析之前脚本就没了，而不是指望 schema 去拒绝它。这也是「粘贴的 HTML 被消毒」这条验收的实现。
- **草稿非空时先问**：`isEmptyDocument`（`core/document.ts`）判断的是「有没有可失去的内容」：任何非空文本、任何 `horizontalRule` 都算；两个空块、空标题、只有空行不算。窗口是一个生成的 `AlertDialog`（`radix-ui` 的 `AlertDialog`，`alert-dialog.tsx`），标题「替换当前文档？」，说明「导入的文件会替换当前文档，取消则保持原样。」，按钮「取消」与「替换」，各 44px 并带 `.touch-target`；这四句在 `core/copy.ts`，由 Vitest 盯住措辞与标点。取消关闭弹窗、文档一个字节都不动，替换才 `setContent`。焦点、Escape 与焦点陷阱由 Radix 负责。
- **导入的结果是一次普通改动**：`setContent` 默认发出 update，所以 #209 的防抖保存照常工作；导入后的文档可编辑、可继续排版、导出规则完全一样，没有任何「导入模式」标志。
- 导入与粘贴都**不请求任何 origin**，也不新增依赖；文件读取用 `File.text()`，解析是纯函数。

## 占位符

- 空标题块显示「无标题」；文档的**第一个正文块**（初始文档里的那一段）显示「开始写吧，输入 `/` 插入内容」。两句原文在 `RichTextEditor.tsx` 的常量里，门禁读的是**画出来的** `::before` 内容，不是 DOM 文本。
- **「无标题」只挂在文档的第一个节点上**（`pos === 0` 的 heading）。#207 之后正文里也能造标题，一个空标题 2 不是标题块，不能跟着说「无标题」。
- 正文那句**只挂在文档的第一个正文块上**，不是挂在每个空段落上：它说的是「这份文档还是空的」，而访客按回车造出来的空行不是再开始写一遍的地方。空行因此不画占位符。
- 两个占位符**同时**显示（Placeholder 的 `showOnlyCurrent: false`）：标题是一个独立的空块，正文正在被写的时候，标题仍然是空的，所以标题的句子不能藏起来。
- 正文段的**第一次击键**让它的占位符消失；标题的占位符留到标题自己被写为止。这不是一条「空态」开关，而是两个空块各自的状态。
- 占位符是 CSS 的 `::before` + `content: attr(data-placeholder)`，不是文案节点：它进不了选区、不属于文档、也不会被导出。颜色取占位符 token（`--site-placeholder`），实测对比度在 `apps/web/docs/design/colour.md` 的表里。
- 标题占位符的字号跟着标题块走（34px / 1.3），所以「无标题」读起来就是标题，而不是一行小字。

## 可访问名与命中区

- 编辑面的无障碍名是「文档内容」（`aria-label`）。编辑器元素的角色是 TipTap 自己写的 `textbox`，所以读屏读到的是「文档内容，可编辑文本」而不是一个匿名的输入区。
- **画布不带 `.touch-target`**：它不是一个小可点控件，而是编辑面本身，命中区就是整块 720px 阅读度量。给它挂伪元素遮罩会把一层东西盖在文本上，而平台自己的内层命中（这里是光标放置）正是 `#172` 的 range 滑块丢掉的那一半。
- **工具栏的每个控件都是 44×44 自己的框，并且带 `.touch-target`**：图标按钮 `size-11`，块类型触发器 `h-11`，文件菜单触发器 `size-11`。`.touch-target` 在这里是量具的标记，不是把 36px 撑到 44 的遮罩，所以不会有遮罩被滚动容器裁掉的问题（`overflow-x: auto` 会裁掉垂直方向多出来的那 4px）。按钮之间 `gap-2.5`（10px），相邻遮罩不重叠，量具从中心向外走时读得到 43。
  **`shrink-0` 不是装饰**：滚动区是一个 flex 容器，注册表 `Toggle` 自己的样式里没有 `shrink-0`，窄屏上它会被压回 `min-w-9` 的 36px，于是画出来 36×44、可点 35×45（2026-11-27 的实测，116 条失败全是这一个原因）。44px 的声明在 flex 里只是起点，`shrink-0` 才让它立住。
- 工具栏的无障碍名是「格式工具栏」（`role="toolbar"`）。每个图标按钮有自己的 `aria-label`（撤销、加粗、项目符号列表……）；块类型触发器是 `块类型：<当前块>`；文件菜单是「文件」；保存状态是 `role="status"`（`<output>`）的礼貌播报。弹出层里的项（正文/标题 1–3、应用、移除、导入、导出、清空）是带文字的按钮，打开后才存在。
- **导入确认是一个带名字的弹窗**：`role="alertdialog"`，标题「替换当前文档？」与说明各有一份，所以读屏读到的是一个完整的问句而不是两个孤立的按钮；「取消」与「替换」是弹窗自己的按钮，各 44px。焦点由 Radix 放进弹窗并限制在其中，Escape 等于取消。
- **保存状态本身不是控件，不带 `.touch-target`**：它没有可点的框，就是一行字。失败态的「重试」才是控件，带 `.touch-target`、`h-11`，门禁在失败后按它的坐标按。
- **斜杠菜单与浮动工具栏各有名字**：「插入内容」（`role="menu"`）与「选中文本的格式」（`role="toolbar"`）；行与按钮的名字来自命令表。两者都是**指针加键盘的组合**而不是 Tab 顺序里的一站：斜杠菜单的行 `tabIndex={-1}`，焦点留在文档里，读屏用户靠工具栏的同一批命令完成同一件事。
- 编辑面自己**不画焦点环**：编辑面拿到焦点时，画布那条发丝线换成 ink（卡片上的 `focus-within:border-ring`），也就是站点「选中只换线、不换色」的那条规矩（格式卡是同一种写法）。

## 量具

- **指纹（`ui-fingerprint.mjs`）按页声明**外壳的四个锚点、`tool-page`、`rich-text-toolbar`、`rich-text-canvas` 与 `rich-text-save-status`。工具栏、画布与保存状态是三个区域：工具栏移动时读数应该显示工具栏移动，而不是画布变形；保存状态的句子换宽度时，读数也应该显示状态自己的移动。
- **命中区量具（`touch-targets.mjs`）按名字声明本页常驻的控件**：外壳的两个（`切换到`、`返回首页`）与工具栏的十六个（`撤销`、`重做`、`块类型`、五个标记、三个列表、四个插入动作、`文件`）。保存状态是句子而不是控件，不进点名清单；失败态才出现的「重试」也不进，因为量具打开的是页面的正常态，声明一个不存在的名字会让正常页面变红。弹出层与弹窗里的项只在被打开后才存在，包括 #211 的「导入」、#210 的两个导出项与「清空」、以及确认框的「取消」/「替换」；量具不替页面打开它们，这一点是 #210 明确接受、#211 沿用的退路，由门禁按坐标按、再读回下载的字节或导入后的块。它们照样带 `.touch-target`，所以打开时任何一次扫描都能量到 44px；`重试` 由门禁在注入一次失败后按坐标按。**这条量具还读两个状态**：`selection`（探针字进标题块、再套选区）让 `selection-toolbar-clearance` 读浮动行的位置，`scrolling` 让 `toolbar-scroll-end` 在窄屏把中间滚到底再读右端——它读之前会把滚动区的 `scrollLeft` 放回 0，因为同一趟扫描里 `hit-areas` 的 `scrollIntoView` 会把它拨走。
- **#208 的斜杠菜单仍不进 `controls` 清单**：它只在输入 `/` 到应用之间存在，而这份清单是「加载时就该在」的清单。它每个按钮都带 `.touch-target`，要量得先给量具一个「输入斜杠」的钩子，本片没有加，因为门禁已经按坐标按过它（先例是 `convert`）。**浮动工具栏现在进了量具**：`selection` 钩子把一行探针字送进标题块、再把选区套上去，`selection-toolbar-clearance` 读它的盒子与选区自己的盒子；`selection-toolbar` 的按钮仍然不在 `controls` 清单里（它们不在加载状态中存在），但那个面的位置这句话已经由量具回答，不再由门禁回答。
- **两个占位符是画的句子，门禁读它们，而这是站点级例外**：它们是 `::before` 的 `content: attr(data-placeholder)`，`ui-fingerprint` 刻意不读伪元素、`touch-targets` 只读盒子与命中区域，所以这一条由门禁读 `getComputedStyle(el, "::before").content`。理由与「未来钩子需要什么」写在 `apps/web/docs/design/instruments.md` 的「量具够不到的那一条」里，不是这里的第二份规则。
- **门禁只管行为**：按下一个控件之后文档变成什么、导出的字节、存下的记录、导入后的块、快捷键真的落下什么。位置、命中区域、滚动与「有没有东西动过」全在 `scripts/` 的两个量具里（`docs/adr/0012-playwright-for-the-browser-gate.md`）。

## 推迟（不在本片范围内）

- 封面：它在 #212 落地，属于首页卡片与站点素材规则，不进本页的规则。
- 把编辑器抽成 Package：页面是第一个消费者，第二个消费者出现之前不抽。
