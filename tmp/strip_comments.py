import os
import re

# Match strings, template strings, JSX comments, block comments, and line comments
TOKEN_REGEX = re.compile(
    r'(?P<DSTR>"(?:[^"\\]|\\.)*")|'
    r"(?P<SSTR>'(?:[^'\\]|\\.)*')|"
    r'(?P<TSTR>`(?:[^`\\]|\\.)*`)|'
    r'(?P<JSXCOMM>\{\s*\/\*[\s\S]*?\*\/\s*\})|'
    r'(?P<BCOMM>\/\*[\s\S]*?\*\/)|'
    r'(?P<LCOMM>\/\/[^\r\n]*)',
    re.MULTILINE
)

def strip_comments_from_code(code: str) -> str:
    def replacer(match):
        if match.group('DSTR') or match.group('SSTR') or match.group('TSTR'):
            return match.group(0)
        
        comm = match.group(0)
        # Keep essential compiler/linter directives
        if 'eslint-disable' in comm or '@ts-' in comm:
            return comm
        
        return ''

    result = TOKEN_REGEX.sub(replacer, code)
    
    # Clean up empty lines created by removing entire comment lines
    lines = result.splitlines()
    cleaned_lines = []
    prev_empty = False
    
    for line in lines:
        stripped = line.rstrip()
        is_empty = (stripped.strip() == '')
        if is_empty:
            if not prev_empty:
                cleaned_lines.append('')
                prev_empty = True
        else:
            cleaned_lines.append(stripped)
            prev_empty = False
            
    return '\n'.join(cleaned_lines) + '\n'

if __name__ == '__main__':
    target_dirs = ['src']
    modified_count = 0
    total_files = 0
    
    for target_dir in target_dirs:
        for root, _, files in os.walk(target_dir):
            for file in files:
                if file.endswith(('.ts', '.tsx')):
                    total_files += 1
                    path = os.path.join(root, file)
                    with open(path, 'r', encoding='utf-8') as f:
                        original = f.read()
                    
                    cleaned = strip_comments_from_code(original)
                    if cleaned != original:
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(cleaned)
                        modified_count += 1
                        print(f"Cleaned comments in: {path}")

    print(f"Done. Processed {total_files} files, stripped comments from {modified_count} files.")
