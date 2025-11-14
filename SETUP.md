## Developer Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <repo-name>
```

### 2. Install dependencies

```bash
pip install -r requirements.txt

# If using JavaScript/HTML validation
bun install  # If you have package.json
# OR install globally:
bun install -g eslint eslint-config-standard husky lint-staged prettier commitlint/config-conventional commitlint/cli
```

### 3. Run run lint manually to check for problems

```bash
bun run lint
```

```bash
pre-commit run --all-files
```
