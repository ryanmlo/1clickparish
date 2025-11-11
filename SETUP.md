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
npm install  # If you have package.json
# OR install globally:
npm install -g eslint eslint-config-standard
```

### 3. Install pre-commit hooks
```bash
pre-commit install
```

### 4. (Optional) Run hooks manually on all files
```bash
pre-commit run --all-files
```
