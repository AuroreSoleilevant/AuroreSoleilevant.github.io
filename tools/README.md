# Spica 内容脚本

所有脚本都应从项目根目录运行，并使用 Python 3.10 或更高版本。

## 安装依赖

```powershell
python -m pip install -r tools/requirements.txt
```

总入口会在显示菜单前检查内部模块、模板、主要 JSON、Pillow、Jinja2、FontTools 和 Brotli。缺失或损坏时会停止运行并说明具体文件或依赖。

## 推荐入口

```powershell
python tools/Spica.py
```

这是唯一的问答式脚本。所有输入和检查完成后，它会列出完整文件计划并进行最后确认。确认前不会修改项目内容。

## 独立命令

```powershell
python tools/md_to_html.py "D:\文章\正文.txt" -o "D:\文章\正文.html"
python tools/image_card.py "D:\图片\封面.png" "D:\图片\封面卡片.webp"
python tools/create_tag.py --zh "爱情" --slug "amour" --dry-run
python tools/create_solo.py --type article --id 090826A --title "示例" --description "简介" --image "D:\图片\封面.png" --color "rgba(48, 167, 255, 0.3)" --tags "爱情" --dry-run
python tools/create_serial_story.py --id HABC --title "示例故事" --description "简介" --image "D:\图片\封面.png" --color "rgba(48, 167, 255, 0.3)" --dry-run
python tools/create_chapters.py --story HABC --source "D:\章节" --title "第一章" --title "第二章" --dry-run
python tools/word_count.py HABC --dry-run
python tools/word_count.py ALL --dry-run
python tools/font_patch.py --dry-run
```

创建器使用 `--dry-run` 时只进行检查和显示计划。非标准 ID 必须显式添加 `--allow-nonstandard-id`；命令行中需要同时创建的新标签使用可重复的 `--new-tag "中文=法语slug"`。

字数统计严格复刻 `/js/mots.js`：提取每个页面 `<main>` 的文本，只统计同一组 Unicode 中日韩统一表意文字。文章和单页故事统计首页；普通多章故事按照章节 JSON 合计；没有章节 JSON 但含子页面的互动故事会递归合计全部 `index.html`。

字体修补器只扫描网站会渲染的文本与前端字符串，排除 HTML/JS/CSS 注释、控制台/异常消息和代码语法，并跳过母版中不存在的字符。Latin 子集保持不变；现有 Core 字符永久保留，首页首屏、页眉页脚和首页实际加载界面的新增字符进入 Core，延迟交互内容及其他站内字符进入 Extra。Core/Extra、CSS 的 `unicode-range` 与缓存版本号会在同一事务中更新；`fonts/LXGWWenKai.ttf` 只作离线母版，禁止改写或在线引用。

除标签创建器外，所有内容创建器会在提交前依次重新统计对应内容的字数并运行一次字体修补。也可在总入口选择“立刻进行全站字体修补”，或先用独立命令的 `--dry-run` 查看计划。
