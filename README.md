# 西安中轴线建筑声景 — 技术文档、使用说明与运行手册

本文档面向**开发者**（架构、部署、内容维护）与**网站访客**（功能与操作），并包含本地开发与构建发布的运行步骤。

---

## 1. 项目概述

本项目是一个以**西安地标建筑声景**为主题的沉浸式 Web 体验站点，品牌名在界面中呈现为「西安中轴线建筑声景 / City Soundscape」。主要能力包括：

- **多语言叙事**：中文 / 英文切换（`react-router-dom` 与 React 状态配合）。
- **卷轴式城市页**：视差滚动、场景分区、可点击「声学热点」弹出详情与音频可视化。
- **全景地图**：基于 Leaflet（CDN 动态加载）与 OpenStreetMap 瓦片，展示 `places.json` 中的采样点。
- **声漫步**：基于 Three.js 的粒子可视化，按地点列表顺序播放图像与关联音频。
- **开场视频**：首次访问可播放全屏介绍视频（本地 `intro.mp4`），跳过后写入 `localStorage` 以免重复播放。
- **全局环境音**：城市页与关于页可开关循环背景音（`/background.wav`，需置于 `public` 目录）。

技术栈：**Vite 5** + **React 18** + **React Router 6** + **Three.js**；样式为全局 CSS（`src/styles.css`）。

---

## 2. 技术架构

### 2.1 前端运行时

| 层级 | 说明 |
|------|------|
| 构建工具 | Vite（`@vitejs/plugin-react`），ESM、`import.meta.glob` 批量引入内容资源 |
| 路由 | `BrowserRouter`，路径见下文「路由一览」 |
| 地图 | Leaflet 1.9.4 通过 `unpkg.com` 注入脚本与样式（需网络访问 CDN） |
| 底图 | OpenStreetMap 标准瓦片 `https://{s}.tile.openstreetmap.org/...` |
| 3D / 音频 | Three.js 动态 `import("three")`；Web Audio API（Analyser、Gain 等） |

### 2.2 入口与全局状态

- 入口：`index.html` → `src/main.jsx`（挂载 `#root`，包裹 `BrowserRouter`）。
- 根组件：`src/App.jsx`  
  - 管理 `lang`（`zh` / `en`）、`bgMuted`（背景音静音）、`showIntro`（开场视频）。  
  - 城市页热点音频使用 `AudioContext` + `<audio>` + Canvas 频谱条。

### 2.3 内容数据流

1. **城市叙事页**  
   - 顺序与 slug 定义在 `src/content/cities/index.js` 的 `cityOrder`。  
   - 每个城市目录（如 `daming-palace/`）含 `meta.json`（场景、热点、文案、图片路径等）与 `note.zh.md` / `note.en.md`（构建时解析为块结构，当前主流程以 `meta.json` 的 `text` 为主）。

2. **地图与声漫步**  
   - `src/content/places.json`：经纬度、中英文名称、简介、`img_address`、`audio_address` 文件名。  
   - 图片：`src/content/img/typical/` 下文件，通过 `import.meta.glob` 匹配。  
   - 音频：`src/content/audio/*.wav`，同样通过 glob 引入。

3. **占位 / 程序化音频**  
   - `src/lib/audio.js` 的 `createWaveBlob`：当热点未配置真实 `audio` 时，根据 `sound.color` 等生成简易波形 WAV（内存 URL）。

### 2.4 静态资源路径约定

- **Vite 打包的资源**：`meta.json` 内可写 `/assets/...`（需文件存在于 `public/assets/...` 或构建流程产出）。  
- **开发时 public 根路径**：`public/background.wav` → 浏览器访问 `/background.wav`。  
- **开场视频**：`src/content/intro.mp4` 由源码侧 import，随构建进入 hashed 资源。

---

## 3. 目录结构（核心部分）

```
xian_soundscape/
├── index.html
├── package.json
├── vite.config.js
├── public/                    # 静态文件原样提供（如 background.wav 应放此处）
├── src/
│   ├── main.jsx
│   ├── App.jsx                # 路由、开场、背景音、城市页容器
│   ├── MapPage.jsx            # 全景地图
│   ├── SoundwalkPage.jsx      # 声漫步（Three.js）
│   ├── AboutPage.jsx
│   ├── VideoIntro.jsx         # 开场视频
│   ├── Footer.jsx
│   ├── styles.css
│   ├── lib/audio.js
│   └── content/
│       ├── places.json        # 地图/声漫步点位数据
│       ├── intro.mp4
│       ├── img/typical/       # 点位配图
│       ├── audio/             # 点位 wav
│       └── cities/
│           ├── index.js       # cityOrder + glob 加载各城 meta 与 note
│           ├── locations.js   # 地图中心、缩放、导航用名称
│           └── <slug>/
│               ├── meta.json
│               ├── note.zh.md
│               └── note.en.md
└── dist/                      # npm run build 输出（部署用）
```

---

## 4. 路由一览

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 重定向 | 跳转到 `/city/<cityOrder[0]>`（当前首个为 `daming-palace`） |
| `/city/:citySlug` | 城市叙事 | `citySlug` 须为 `cityOrder` 中已有项，否则重定向到默认城 |
| `/map` | 全景地图 | 不播放全局 `BackgroundAudio`（与 `App.jsx` 中 `isMapPage` 逻辑一致） |
| `/soundwalk` | 声漫步 | Three.js 粒子 + 列表音频 |
| `/about` | 关于 | 项目说明；可控制背景音与语言 |
| `*` | 兜底 | 重定向到默认城市页 |

---

## 5. 使用说明（网站访客）

1. **首次打开**  
   - 可能看到全屏介绍视频；可等待播放结束或使用界面上的跳过/进入主站按钮（以实际 UI 为准）。  
   - 浏览器若拦截自动播放，可能需用户手势后才能有声。

2. **语言**  
   - 顶部 **「中文 / EN」** 切换界面文案（部分页面标题随语言更新）。

3. **城市叙事页**  
   - 向下滚动浏览场景；热点按钮在滚入视口一定进度后高亮。  
   - 点击热点打开侧栏/弹层：图文 + 音频；部分热点为程序化生成音色。  
   - **「声音：开/关」** 控制全站循环背景音（非地图页）。  
   - **「全景」** 进入地图；**「声漫步」** 进入粒子声漫步；导航可切换大明宫 / 钟楼 / 永宁门等（以 `cityOrder` 为准）。

4. **全景地图**  
   - 拖拽、缩放浏览；点击标记弹出简介、图片与音频（数据来自 `places.json` 与 `content/img`、`content/audio`）。  
   - 需能访问 OSM 瓦片与 unpkg（Leaflet）。

5. **声漫步**  
   - 按序列体验各点位；支持静音/音量类控制（以页面控件为准）；依赖 WebGL 与音频解码。

6. **关于**  
   - **「返回」** 优先历史返回，否则回首页。

7. **再次观看开场视频**  
   - 清除站点数据或删除浏览器中本站 `localStorage` 键 `introWatched` 后刷新（具体以开发者工具为准）。

---

## 6. 运行手册（开发者）

### 6.1 环境要求

- **Node.js**：建议当前 LTS（如 18.x / 20.x），需含 `npm`。  
- **浏览器**：支持 ES Module、WebGL、Web Audio 的现代浏览器（Chrome / Edge / Firefox / Safari 新版本）。  
- **网络**：开发/运行地图页时需能访问外网 CDN 与 OSM（若离线部署需自行改 Leaflet 与瓦片方案）。

### 6.2 安装依赖

在项目根目录执行：

```bash
npm install
```

### 6.3 本地开发

```bash
npm run dev
```

默认在终端提示的本地 URL（一般为 `http://localhost:5173`）打开即可。修改 `src/` 下文件会热更新。

**建议检查：**

- `public/background.wav` 是否存在；缺失时背景音可能无效。  
- `src/content/img/typical/` 与 `src/content/audio/` 与 `places.json` 中文件名一致。  
- 城市页配图路径与 `public` 或构建资源一致，避免 404。

### 6.4 生产构建

```bash
npm run build
```

产物在 `dist/`。预览构建结果：

```bash
npm run preview
```

### 6.5 部署注意（SPA）

本项目使用 **History 模式**（`BrowserRouter`）。静态托管（如 GitHub Pages、Nginx、OSS）需将所有前端路径**回退到 `index.html`**，否则直接访问 `/map` 等会 404。

### 6.6 内容维护简要

- **新增或调整地图/声漫步点位**：编辑 `src/content/places.json`，并放入对应 `img` / `audio` 文件，文件名与字段一致。  
- **调整城市顺序或新增城市**：在 `src/content/cities/index.js` 修改 `cityOrder` 并新增 `content/cities/<slug>/` 与 `meta.json` 等（需与路由、导航一致）。  
- **地图中心与范围**：`src/content/cities/locations.js` 中 `mapCenter`、`mapZoom`；Leaflet `maxBounds` 在 `MapPage.jsx` 内写死为西安一带，若改城市需同步修改。

---

## 7. npm 脚本说明

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 生产构建至 `dist/` |
| `npm run preview` | 本地预览 `dist/` |

---

## 8. 依赖清单（package.json）

- **运行时**：`react`、`react-dom`、`react-router-dom`、`three`  
- **开发**：`vite`、`@vitejs/plugin-react`

---

## 9. 常见问题

| 现象 | 可能原因 | 处理方向 |
|------|----------|----------|
| 地图空白或报错 | 无法加载 Leaflet 或 OSM 瓦片 | 检查网络、防火墙；或改为内网托管 Leaflet 与瓦片 |
| 声漫步黑屏或卡顿 | WebGL 不可用或性能不足 | 更新驱动/浏览器；降低粒子等需改源码 |
| 热点无声音 | 音频路径错误或未配置 | 检查 `meta.json` 的 `audio` 与 `sound`；浏览器是否拦截播放 |
| 背景音无声音 | 缺少 `public/background.wav` 或处于静音 | 补全文件并点击「声音」开关 |
| 部署后子路由 404 | 服务器未配置 SPA 回退 | 配置 `try_files` 或等价规则指向 `index.html` |

---

## 10. 文档版本与仓库

- 文档随仓库 `xian_soundscape` 维护；若依赖或路径有变，请以当前 `package.json` 与 `src/` 为准同步更新本文。  
- 项目名称在 `package.json` 中为 `soundscape-city-web`，版本 `0.1.0`（仅供参考）。

---

*生成说明：本文件依据仓库源码结构与脚本整理；若与实际运行不一致，以代码为准。*
