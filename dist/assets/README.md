将你自己的素材替换到以下目录：

- `public/assets/cities/beijing`
- `public/assets/cities/shanghai`
- `public/assets/cities/hangzhou`

建议文件命名：

- `cover.jpg`
- `hotspot-1.jpg`
- `hotspot-2.jpg`
- `hotspot-3.jpg`
- `hotspot-4.jpg`（按需）
- `bg.mp3` 或 `bg.wav`（如需真实背景音乐）
- `hotspot-1.mp3`、`hotspot-2.mp3` 等（如需真实热点音频）

然后到 `src/content/cities.js` 中修改对应城市的：

- 文案
- 热点坐标
- 图片路径
- 音频路径

如果音频路径留空，页面会自动使用内置生成的环境音作为演示占位。
