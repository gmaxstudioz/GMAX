const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

const out = execSync('git grep -il "gmax studioz"', { encoding: 'utf-8' });
const files = out.split('\n').filter(f => f.trim() !== '');

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  if (file.endsWith('.html') || file.endsWith('.md')) {
    content = content.replace(/GMAX Studioz/gi, 'Gmax Studioz');
  } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    let appPrefix = '';
    if (file.startsWith('admin/')) appPrefix = '@/lib/constants';
    else if (file.startsWith('api/')) appPrefix = '@/lib/constants';
    else if (file.startsWith('public/')) appPrefix = '@/lib/constants';
    
    if (appPrefix) {
      // 1. > GMAX Studioz < (JSX text)
      content = content.replace(/>\s*GMAX Studioz\s*</gi, '> {APP_NAME} <');
      content = content.replace(/>\s*Gmax Studioz\s*</gi, '> {APP_NAME} <');
      
      // 2. Exact match inside quotes: "GMAX Studioz" -> APP_NAME
      content = content.replace(/"GMAX Studioz"/gi, 'APP_NAME');
      content = content.replace(/'GMAX Studioz'/gi, 'APP_NAME');

      // 3. Inside template literals
      let parts = content.split('`');
      for (let i = 1; i < parts.length; i += 2) {
         parts[i] = parts[i].replace(/GMAX Studioz/gi, '${APP_NAME}');
         parts[i] = parts[i].replace(/Gmax Studioz/gi, '${APP_NAME}');
      }
      content = parts.join('`');

      // 4. Inside double quotes (that have other text) -> convert to template literal
      // Be careful not to replace APP_NAME itself if we just inserted it.
      // E.g. "Welcome to GMAX Studioz" -> `Welcome to ${APP_NAME}`
      content = content.replace(/"([^"\n]*?)GMAX Studioz([^"\n]*?)"/gi, '`$1${APP_NAME}$2`');

      // 5. Some stray text like © GMAX Studioz in JSX
      content = content.replace(/© (\{[^}]+\})\s*GMAX Studioz/gi, '© $1 {APP_NAME}');

      if (content !== originalContent) {
        if (!content.includes('APP_NAME')) {
          // just in case
        } else if (!content.includes(`import { APP_NAME }`)) {
          // add import after 'use client' or at top
          if (content.startsWith('"use client";') || content.startsWith("'use client';")) {
             content = content.replace(/^(["']use client["'];?)/, `$1\nimport { APP_NAME } from "${appPrefix}";`);
          } else {
             content = `import { APP_NAME } from "${appPrefix}";\n` + content;
          }
        }
      }
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
});
