async function main() {
  try {
    const res = await fetch("http://localhost:3000/api/reports/suppliers/prediction?supplier=China");
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response text:", text.slice(0, 1000));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
main();
