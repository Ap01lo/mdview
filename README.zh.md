<p align="center">
  <img src="public/favicon.svg" alt="mdview" width="96" height="96">
</p>

<h1 align="center">mdview</h1>

<p align="center">
  <a href="./README.md">English</a> · 中文
</p>

<p align="center">
  一个便携、开箱即用的 Markdown 阅读器�?br>
  文件�?· 主题切换 · LaTeX 公式 · 系统调用原文�?· 可自定义快捷�?</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Node" src="https://img.shields.io/badge/node-%E2%89%A518-green">
  <img alt="PRs" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
</p>

---

> **为什么做 mdview�?* �?AI 时代，我们每天都会收到一大堆 Markdown —�?任务书、研究笔记、Agent 输出、对话导出。我们只�?*安静地读**这些文件，而不是打开笨重�?IDE、登录某个云端账户、或者装个浏览器扩展。市面上�?Markdown 查看器要�?*功能过剩**（比如带 Git 集成要你 commit），要么**过于简�?*（一块无样式的纯文本）�?>
> mdview 想做的，就是中间那条路：**打开任意目录，舒服地读，切主题，看公式，全程不修改文�?*。一行命令启动，浏览器自动开，跑�?`Ctrl+C` 退出，干干净净�?
<p align="center">
  <img src="docs/screenshots/screenshot-main.png" alt="mdview 主界�? width="100%">
</p>

<p align="center">
  <a href="docs/screenshots/screenshot-settings.png"><img src="docs/screenshots/screenshot-settings.png" alt="设置面板" width="48%"></a>
  <a href="docs/screenshots/screenshot-latex.png"><img src="docs/screenshots/screenshot-latex.png" alt="LaTeX 公式" width="48%"></a>
</p>

<p align="center">
  <img src="docs/screenshots/demo.gif" alt="mdview 演示" width="100%">
</p>

## 特性一�?
| | |
|--|--|
| 📂 **目录树浏�?*，键盘导�?+ 实时模糊过滤 + 一键刷�?| |
| 📖 **GFM Markdown** + 代码高亮（highlight.js�? HTML 净化（DOMPurify�?| |
| 🔢 **LaTeX 公式**（`$...$` 行内 + `$$...$$` 行间），KaTeX 渲染，可关闭 | |
| 📊 **三线�?*（学术风），文字居中 | |
| 🎨 **主题配置�?*（JSON 文件），自带 4 套主题，可替换主�?| |
| 🔠 **字体设置**�? 套预�?+ 270+ 本机字体扫描 + 12�?0px 字号 | |
| ⌨️ **快捷键自定义**�? 个动�?+ 冲突检测） | |
| ⚙️ **设置面板**挂在左下角，简洁不打扰 | |
| 🌗 **自动暗色模式**，跟�?OS | |
| 🪟 **系统级文件夹选择对话�?*（Windows / macOS / Linux 三端一致） | |
| 💾 **持久�?*：所有偏好都�?localStorage | |

## 安装

### �?npm 安装（推荐）

```bash
# 不装全局，在当前目录直接跑：
npx @ap01lo/mdview

# 或全局装一次，以后任意地方都可以用�?npm install -g @ap01lo/mdview
mdview
```

要求 Node.js **�?18**�?
### 从源码安�?
```bash
git clone https://github.com/Ap01lo/mdview.git
cd mdview
npm install
npm link          # 可选：注册全局 mdview 命令
```

### 环境要求

- Node.js **�?18**
- 现代浏览器（Chromium / Firefox / Safari / Edge�?
## 使用

```bash
mdview                       # 打开当前目录
mdview ./docs                # 打开子目�?mdview D:\projects\notes     # 打开绝对路径
mdview --port 8080           # 自定义端口（默认自动选）
mdview --theme serif-light   # 指定默认主题
mdview --no-open             # 不自动打开浏览�?mdview --host 0.0.0.0        # 绑定所有接口（局域网访问�?mdview --help                # 查看完整帮助
```

服务起来后，顶栏�?**📂** 按钮（或点当前路径文字）即可随时切换目录 —�?mdview 会弹一�?*原生文件夹选择�?*，不用重启�?
## 快捷�?
| �?| 动作 |
|--|--|
| `Ctrl/�?+ \` | 收起 / 展开侧边�?|
| `Ctrl/�?+ K` | 聚焦搜索�?|
| `Ctrl/�?+ ,` | 打开设置 |
| `↑` / `↓` | 上下移动 |
| `→` / `←` | 展开 / 折叠目录 |
| `Enter` / `Space` | 打开文件 |
| `Tab` / `Shift+Tab` | 焦点切换 |
| `Esc` | 关闭设置 / 退出搜�?|

所有快捷键都可以在设置面板�?*重新绑定**�?
## 主题

主题�?`themes/*.json` 里的纯配置。每个文件定义一�?CSS 变量，mdview 启动时把它写入文档根节点�?
```json
{
  "name": "我的主题",
  "description": "�?GitHub 基础上微�?,
  "vars": {
    "--bg": "#ffffff",
    "--fg": "#1f2328",
    "--accent": "#0969da",
    "--content-max": "720px",
    "--md-line-height": "1.75",
    "--md-table-top": "2px solid #1f2328",
    "--md-table-align": "center"
  }
}
```

往那个目录扔一个文件，下一次刷新就能在主题下拉里看到它�?*无需重启**�?
## 安全

- 文件访问严格限制在当前挂载的目录�?- 路径穿越攻击（`..`、绝对路径）一律返�?403
- 大于 5 MB 的文件返�?413
- 所有渲染到页面�?HTML 都过 DOMPurify 净�?
## 项目结构

```
mdview/
├── bin/mdview.js          CLI 入口 + Express 服务
├── public/                SPA（HTML / CSS / JS / SVG 图标�?�?  ├── index.html
�?  ├── style.css
�?  ├── app.js
�?  └── favicon.svg
├── themes/                内置主题
�?  ├── github-light.json
�?  ├── github-dark.json
�?  ├── serif-light.json
�?  └── noir.json
├── package.json
├── LICENSE
└── README.md / README.zh.md
```

## 贡献

Issue �?PR 都欢�?—�?但请尽量保持改动**单一目的**，mdview 是个有意做得小而专的工具�?
新增主题请直接在 `themes/` 下放 JSON，记得在 `vars` 里至少包�?`--bg` �?`--fg`，其它变量都有默认值�?
发版步骤�?[PUBLISHING.md](./PUBLISHING.md)�?
## 协议

MIT —�?�?[LICENSE](./LICENSE)�