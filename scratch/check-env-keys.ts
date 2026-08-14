import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const keys = envContent
    .split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => line.split("=")[0].trim());
  console.log("Env keys in .env.local:", keys);
}
