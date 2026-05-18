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
    
    // Update useState type for customers
    content = content.replace(/useState<\{\s*id:\s*string;\s*name:\s*string\s*\}\[\]>/g, 'useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>');
    content = content.replace(/useState<\{\s*id:\s*string;\s*name:\s*string;\s*businessId\?:\s*string\s*\}\[\]>/g, 'useState<{ id: string; name: string; businessId?: string; phone?: string; ownerName?: string; }[]>');
    content = content.replace(/useState<\{\s*id:\s*string;\s*name:\s*string;\s*businessId\?:\s*string;\s*\}\[\]>/g, 'useState<{ id: string; name: string; businessId?: string; phone?: string; ownerName?: string; }[]>');
    
    // Some might be formatted slightly differently (e.g. across multiple lines)
    // Let's use a more robust regex if needed, but let's try the simple ones first
    
    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log('Modified:', fullPath);
      modifiedCount++;
    }
  }
}
console.log('Total files fixed:', modifiedCount);
