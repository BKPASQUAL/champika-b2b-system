const fs = require('fs');
const path = require('path');

const targetDir = path.join(process.cwd(), 'app', 'dashboard');
const files = fs.readdirSync(targetDir, { recursive: true, withFileTypes: true });

let modifiedCount = 0;

for (const file of files) {
  if (file.isFile() && (file.name.endsWith('.tsx') || file.name.endsWith('.ts'))) {
    const fullPath = path.join(file.parentPath, file.name);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    let original = content;
    
    const searchTarget = /if\s*\(searchTerm\s*===\s*""\)\s*return\s*true;\s*const\s*s\s*=\s*searchTerm\.toLowerCase\(\);\s*return\s*\([\s\S]*?\);\s*\}/g;

    const replacement = `if (searchTerm === "") return true;
    const searchWords = searchTerm.toLowerCase().trim().split(/\\s+/);
    for (const word of searchWords) {
      const pName = p.name ? p.name.toLowerCase() : "";
      const pSku = p.sku ? p.sku.toLowerCase() : "";
      const pCode = p.companyCode ? p.companyCode.toLowerCase() : "";
      if (!pName.includes(word) && !pSku.includes(word) && !pCode.includes(word)) {
        return false;
      }
    }
    return true;
  }`;

    content = content.replace(searchTarget, replacement);
    
    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log('Modified:', fullPath);
      modifiedCount++;
    }
  }
}
console.log('Total files fixed:', modifiedCount);
