#!/usr/bin/env python3
"""Replace teal/emerald palette with indigo/violet across all frontend files."""
import os, re

replacements = [
    # Gradients (must come first - most specific)
    ("from-emerald-600 to-teal-600", "from-indigo-600 to-violet-600"),
    ("from-emerald-600 to-teal-500", "from-indigo-600 to-violet-500"),
    ("from-emerald-500 to-teal-500", "from-indigo-500 to-violet-500"),
    ("from-emerald-50 via-white to-teal-50", "from-indigo-50 via-white to-violet-50"),
    # Backgrounds
    ("bg-emerald-600", "bg-indigo-600"),
    ("bg-emerald-500", "bg-indigo-500"),
    ("bg-emerald-100", "bg-indigo-100"),
    ("bg-emerald-50",  "bg-indigo-50"),
    ("bg-teal-600",    "bg-violet-600"),
    ("bg-teal-500",    "bg-violet-500"),
    # Text colors
    ("text-emerald-600", "text-indigo-600"),
    ("text-emerald-500", "text-indigo-500"),
    ("text-emerald-400", "text-indigo-400"),
    ("text-emerald-300", "text-indigo-300"),
    ("text-teal-600",    "text-violet-600"),
    ("text-teal-500",    "text-violet-500"),
    ("text-teal-400",    "text-violet-400"),
    # Borders
    ("border-emerald-600", "border-indigo-600"),
    ("border-emerald-200", "border-indigo-200"),
    ("border-teal-600",    "border-violet-600"),
    # Hover
    ("hover:bg-emerald-700",   "hover:bg-indigo-700"),
    ("hover:text-emerald-700", "hover:text-indigo-700"),
    # Focus
    ("focus:ring-emerald-500", "focus:ring-indigo-500"),
    # Gradient from/to individual tokens
    ("from-emerald-600", "from-indigo-600"),
    ("from-emerald-500", "from-indigo-500"),
    ("to-teal-600",      "to-violet-600"),
    ("to-teal-500",      "to-violet-500"),
    # Dark mode
    ("dark:text-emerald-400",    "dark:text-indigo-400"),
    ("dark:bg-emerald-900/20",   "dark:bg-indigo-900/20"),
    ("dark:bg-emerald-900/30",   "dark:bg-indigo-900/30"),
    ("dark:bg-emerald-900",      "dark:bg-indigo-900"),
    ("dark:border-emerald-800",  "dark:border-indigo-800"),
]

src_dir = "/Users/akshay/Desktop/workspace/ProductOS/frontend/src"
changed = 0

for root, dirs, files in os.walk(src_dir):
    dirs[:] = [d for d in dirs if d not in ["node_modules", ".next"]]
    for fname in files:
        if not (fname.endswith(".tsx") or fname.endswith(".ts")):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, "r") as f:
            content = f.read()
        new_content = content
        for old, new in replacements:
            new_content = new_content.replace(old, new)
        if new_content != content:
            with open(fpath, "w") as f:
                f.write(new_content)
            changed += 1
            print(f"  ✅ {fpath.replace(src_dir+'/', '')}")

print(f"\nUpdated {changed} files.")

# Verify
remaining = []
for root, dirs, files in os.walk(src_dir):
    dirs[:] = [d for d in dirs if d not in ["node_modules", ".next"]]
    for fname in files:
        if not fname.endswith(".tsx"):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath) as f:
            content = f.read()
        if "emerald" in content or ("teal" in content and "teal-" in content):
            lines = [(i+1, l.strip()) for i, l in enumerate(content.splitlines())
                     if "emerald" in l or "teal-" in l]
            remaining.extend([(fpath.replace(src_dir+"/",""), ln, l) for ln, l in lines])

if remaining:
    print(f"\n⚠️  Still has emerald/teal ({len(remaining)} lines):")
    for f, ln, l in remaining[:10]:
        print(f"  {f}:{ln}  {l[:80]}")
else:
    print("\n✅ All emerald/teal colors replaced!")
