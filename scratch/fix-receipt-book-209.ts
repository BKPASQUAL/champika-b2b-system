import fs from "fs";
import path from "path";

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  for (const line of envConfig.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { supabaseAdmin } from "../lib/supabase-admin";

async function fixBook209() {
  console.log("Searching for Receipt Book #209...");
  const { data: books, error } = await supabaseAdmin
    .from("receipt_books")
    .select("*")
    .or("book_number.eq.209,book_number.eq.#209,start_number.eq.20801");

  if (error) {
    console.error("Error finding book:", error);
    return;
  }

  console.log("Found books:", books);

  if (books && books.length > 0) {
    for (const book of books) {
      console.log(`Fixing book ${book.book_number} (ID: ${book.id})...`);
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("receipt_books")
        .update({
          current_number: 20803,
          status: "Active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", book.id)
        .select()
        .single();

      if (updateErr) {
        console.error("Failed to update book:", updateErr);
      } else {
        console.log("Successfully updated book:", updated);
      }
    }
  } else {
    console.log("Searching all books...");
    const { data: allBooks } = await supabaseAdmin
      .from("receipt_books")
      .select("*")
      .order("created_at", { ascending: false });
    console.log("All books count:", allBooks?.length);
    const target = allBooks?.find(b => b.book_number.includes("209") || b.start_number === 20801);
    if (target) {
      console.log("Found target book:", target);
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("receipt_books")
        .update({
          current_number: 20803,
          status: "Active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id)
        .select()
        .single();
      console.log("Updated target result:", updated, updateErr);
    }
  }
}

fixBook209();
