import random
import os
import re
from collections import Counter

folder_path = r"c:\Users\jke36\Desktop\My Work\0.1 NEW\files\system_prompts\system_prompts_leaks"

rules = []
keywords = ["always", "never", "you must", "do not",
            "critical", "important", "ensure", "avoid"]


def is_rule(line):
    line_lower = line.lower()
    return any(line_lower.startswith(k) or f" {k} " in line_lower for k in keywords)


print(f"Scanning folder: {folder_path}")
file_count = 0
for root, dirs, files in os.walk(folder_path):
    for file in files:
        if file.endswith((".md", ".txt", ".html")):
            file_count += 1
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if len(line) > 20 and len(line) < 300 and is_rule(line):
                            rules.append(line)
            except Exception as e:
                pass

print(f"Scanned {file_count} files.")
print(f"Extracted {len(rules)} potential rules.")

# Clean and deduplicate slightly
unique_rules = list(set(rules))
unique_rules.sort(key=len)

print("\n--- Top Sample Rules ---")
random.seed(42)
for r in random.sample(unique_rules, min(50, len(unique_rules))):
    print("- " + r)
