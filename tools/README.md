# Spica 内容脚本

所有脚本都应从项目根目录运行，并使用 Python 3.10 或更高版本。

## 安装依赖

```powershell
python -m pip install -r tools/requirements.txt
```

总入口会在显示菜单前检查内部模块、模板、主要 JSON、Pillow 和 Jinja2。缺失或损坏时会停止运行并说明具体文件或依赖。

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
```

创建器使用 `--dry-run` 时只进行检查和显示计划。非标准 ID 必须显式添加 `--allow-nonstandard-id`；命令行中需要同时创建的新标签使用可重复的 `--new-tag "中文=法语slug"`。

字数统计严格复刻 `/js/mots.js`：提取每个页面 `<main>` 的文本，只统计同一组 Unicode 中日韩统一表意文字。文章和单页故事统计首页；普通多章故事按照章节 JSON 合计；没有章节 JSON 但含子页面的互动故事会递归合计全部 `index.html`。

字体修补脚本目前仅提供后处理接口。创建器会先把新内容的 `word_count` 初始化为 `0`，随后在同一事务中调用字数统计并写入最终数值。
