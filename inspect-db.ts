// inspect-db.ts
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Manually parse env file
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join("=").trim();
        process.env[key] = val;
      }
    }
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function inspect() {
  const id = "e331921a-32a0-4caf-811b-faf01e785090"; // CBD-2564
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Find all coordinates for today
  const { data, error } = await supabase
    .from("vehicle_locations")
    .select("latitude, longitude, speed, updated_at, ignition")
    .eq("vehicle_id", id)
    .gte("updated_at", `${today}T00:00:00.000Z`)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Query failed:", error.message);
    return;
  }

  console.log(`\nTotal coordinates found for today: ${data?.length}`);
  console.log("\n--- Top 10 Most Recent Coordinates ---");
  data?.slice(0, 10).forEach((l, idx) => {
    console.log(`[#${idx+1}] Lat: ${l.latitude.toFixed(6)} | Lng: ${l.longitude.toFixed(6)} | Speed: ${l.speed.toFixed(1)} km/h | Ignition: ${l.ignition} | Time: ${new Date(l.updated_at).toLocaleTimeString()}`);
  });
}

inspect();
