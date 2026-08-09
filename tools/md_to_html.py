import os
import sys

def ask_path(prompt):
    path = input(prompt).strip()
    if (path.startswith('"') and path.endswith('"')) or (path.startswith("'") and path.endswith("'")):
        path = path[1:-1]
    return path

def main():
    print("=== 文本行自动 <p></p> 包裹器（忽略空行） ===")

    in_path = ask_path("请输入要处理的 md 或 txt 文件路径：")

    if not os.path.isfile(in_path):
        print("输入的文件不存在，请检查路径。")
        sys.exit(1)

    out_path = ask_path("请输入输出文件路径（留空则输出到桌面）：")

    if out_path == "":
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        out_path = os.path.join(desktop, "wrapped_output.html")

    if not out_path.lower().endswith(".html"):
        out_path += ".html"

    with open(in_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    wrapped_lines = []
    for line in lines:
        line = line.rstrip("\n")
        if line.strip() == "":
            continue  # 忽略空行
        wrapped_lines.append(f"<p>{line}</p>")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(wrapped_lines))

    print(f"处理完成！已输出到：{out_path}")

if __name__ == "__main__":
    main()
