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
    
    // 1. Update customer mapping (handle both businessId cases and without)
    content = content.replace(/name:\s*c\.shopName\s*,?\s*businessId:\s*(.*?)\s*\}/g, 'name: c.shopName, phone: c.phone || "", ownerName: c.ownerName || "", businessId: $1 }');
    content = content.replace(/name:\s*c\.shopName\s*,?\s*\}/g, 'name: c.shopName, phone: c.phone || "", ownerName: c.ownerName || "" }');
    
    // 2. Update CommandItem value for customer
    content = content.replace(/value=\{customer\.name\}/g, 'value={`${customer.name} ${customer.phone || ""} ${customer.ownerName || ""}`}');
    
    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log('Modified:', fullPath);
      modifiedCount++;
    }
  }
}
console.log('Total files fixed:', modifiedCount);
