#!/bin/zsh
# Replace teal/emerald with indigo/violet across all frontend TSX/TS files

cd /Users/akshay/Desktop/workspace/ProductOS/frontend/src

FILES=$(find . -name "*.tsx" -o -name "*.ts")

for f in $FILES; do
  sed -i '' \
    -e 's/from-emerald-600 to-teal-600/from-indigo-600 to-violet-600/g' \
    -e 's/from-emerald-600 to-teal-500/from-indigo-600 to-violet-500/g' \
    -e 's/from-emerald-500 to-teal-500/from-indigo-500 to-violet-500/g' \
    -e 's/bg-gradient-to-r from-emerald-600 to-teal-600/bg-gradient-to-r from-indigo-600 to-violet-600/g' \
    -e 's/bg-gradient-to-br from-emerald-600 to-teal-600/bg-gradient-to-br from-indigo-600 to-violet-600/g' \
    -e 's/bg-emerald-600/bg-indigo-600/g' \
    -e 's/bg-emerald-500/bg-indigo-500/g' \
    -e 's/bg-emerald-100/bg-indigo-100/g' \
    -e 's/bg-emerald-50/bg-indigo-50/g' \
    -e 's/bg-teal-600/bg-violet-600/g' \
    -e 's/bg-teal-500/bg-violet-500/g' \
    -e 's/text-emerald-600/text-indigo-600/g' \
    -e 's/text-emerald-500/text-indigo-500/g' \
    -e 's/text-emerald-400/text-indigo-400/g' \
    -e 's/text-emerald-300/text-indigo-300/g' \
    -e 's/text-teal-600/text-violet-600/g' \
    -e 's/text-teal-500/text-violet-500/g' \
    -e 's/text-teal-400/text-violet-400/g' \
    -e 's/border-emerald-600/border-indigo-600/g' \
    -e 's/border-emerald-200/border-indigo-200/g' \
    -e 's/border-teal-600/border-violet-600/g' \
    -e 's/hover:bg-emerald-700/hover:bg-indigo-700/g' \
    -e 's/hover:text-emerald-700/hover:text-indigo-700/g' \
    -e 's/focus:ring-emerald-500/focus:ring-indigo-500/g' \
    -e 's/from-emerald-600/from-indigo-600/g' \
    -e 's/to-teal-600/to-violet-600/g' \
    -e 's/dark:text-emerald-400/dark:text-indigo-400/g' \
    -e 's/dark:bg-emerald-900\/20/dark:bg-indigo-900\/20/g' \
    -e 's/dark:bg-emerald-900/dark:bg-indigo-900/g' \
    -e 's/dark:border-emerald-800/dark:border-indigo-800/g' \
    -e 's/bg-clip-text text-transparent.*emerald/bg-clip-text text-transparent from-indigo/g' \
    "$f"
done
echo "Done"
