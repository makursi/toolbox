# Toolbox

[English](./README.md)

一批单一用途的浏览器小工具。每个工具都完整地跑在你的浏览器里：不需要账号，交给它的文件不会离开你的设备。

## 开发

Node.js >= 22.12.0，以及 pnpm——pnpm 的确切版本是 `package.json` 里的 `packageManager`。

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

**请用 dev server 打印出来的那个 host 打开站点：** Next 会拒绝其他所有主机名，而且在它的 HMR socket 连上之前会一直压着 hydration 不放，所以在它不认识的主机名上打开，页面会照常渲染、然后对每一次点击都不理不睬。`apps/web/next.config.ts` 里列着本项目放行的那些主机名——`127.0.0.1` 与 `10/8` 网段，方便用手机访问 dev server——换到别的网络时，把这台机器的地址加进去。同样的原因，要验交互就值得对着生产构建来：

```bash
pnpm build
pnpm start
```

## 常用命令

| 命令                | 用途                              |
| ------------------- | --------------------------------- |
| `pnpm dev`          | 起站点                            |
| `pnpm build`        | 生产构建                          |
| `pnpm start`        | 跑生产构建                        |
| `pnpm lint`         | Oxlint，带类型信息                |
| `pnpm typecheck`    | `tsc --noEmit`                    |
| `pnpm test`         | Vitest 单元测试                   |
| `pnpm e2e`          | 浏览器门禁：Playwright 对生产构建 |
| `pnpm fmt`          | 用 Oxfmt 格式化整个仓库           |
| `pnpm fmt:check`    | 校验格式                          |
| `pnpm check:readme` | 校验两份 README 是否还对得上      |

## 配置

`SITE_URL` 是站点的正式来源，metadata、`robots.txt` 与 `sitemap.xml` 都用它。照 `apps/web/.env.example` 抄一份；不设也能跑，会退回 `http://localhost:3000`，所以本地开发不需要任何配置。

## 目录结构

```
apps/web/     唯一的可部署物：Next.js App Router、Mantine、Tailwind CSS v4
  src/        这个 App 本身：路由在 src/app，Tool 在 src/tools
  e2e/        门禁：站点「做什么」，Playwright，每个 PR 都跑
  scripts/    仪器：它「画成什么样」，以及真实可点区域有多大
  docs/       这个 App 自己的文档：design.md、adding-a-tool.md
packages/     工作区各包之间共享的代码（目前只有 tsconfig）
docs/adr/     不轻易推翻的决定
docs/agents/  agent 怎么提 issue、怎么读这些文档
CONTEXT.md    词表：Tool、Package、App、Tool Registry
```

**仪器**（instrument）只测量，**门禁**（gate）才断言；两者的界线在 `docs/adr/0012-playwright-for-the-browser-gate.md`，两个词的定义在 `CONTEXT.md`。

## 许可

仓库没有 `LICENSE` 文件，所以代码默认保留所有权利。

外部素材完全不在这份许可的范围内：fork 这个仓库不会连带得到站点标记（`apps/web/assets/brand/makursi.png` 与它的三份导出）和工具封面的使用权。见 [`apps/web/docs/design.md` 第九节](apps/web/docs/design.md)。
