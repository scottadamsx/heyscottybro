// Plain-assertion tests for priceImport.js. Run: node src/lib/priceImport.test.js
import { parseCsv, rowsToPriceItems, parsePriceDataset, checksumOf, slugKey } from "./priceImport.js";

let pass = 0, failCount = 0;
const ok = (cond, label) => { if (cond) pass++; else { failCount++; console.error("FAIL:", label); } };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

eq(slugKey("Coleman's"), "colemans", "slug strips apostrophes");

const csv = 'store,product_name,price_cad\n"Coleman\'s, Merrymeeting","Bacon, Smoked",6.99\n';
const parsed = parseCsv(csv);
eq(parsed.length, 1, "csv parses one data row");
eq(parsed[0].store, "Coleman's, Merrymeeting", "csv keeps commas inside quotes");
eq(parsed[0].product_name, "Bacon, Smoked", "csv quoted product name");

const datasetRow = {
  store: "Coleman's (Merrymeeting Road, St. John's)",
  product_name: "Spalding Naturally Smoked Bacon",
  brand: "Spalding",
  size_text: "500 gm",
  price_cad: 6.99,
  price_with_tax_cad: 6.99,
  size_g: 500,
  price_per_100g: 1.398,
  price_per_100g_with_tax: 1.398,
  url: "https://shop.colemans.ca/p/1564405684712585592",
  category: "Meats > Processed Meat > Bacon",
  capture_date: "2026-10-21",
};
const { items, rejected, capturedAt } = rowsToPriceItems([datasetRow]);
eq(rejected.length, 0, "dataset row accepted");
eq(capturedAt, "2026-10-21", "capture date read");
eq(items[0].store_key, "colemans", "store key from name head");
eq(items[0].external_product_key, "1564405684712585592", "product key from URL tail");
eq(items[0].unit_kind, "mass", "size_g maps to mass");
eq(items[0].package_quantity_milliunits, 500000, "500 g in milliunits");
eq(items[0].package_price_cents, 699, "price in cents");
eq(items[0].source_price_per_100_cents, 139.8, "per-100 rate in cents");

const taxed = rowsToPriceItems([{ ...datasetRow, price_cad: 10.0, price_with_tax_cad: 11.5 }]);
eq(taxed.items[0].package_price_cents, 1150, "with-tax price wins (Scott's costing rule)");

const noSize = rowsToPriceItems([{ ...datasetRow, size_g: "", size_text: "variable weight" }]);
eq(noSize.items.length, 0, "row without a package size is not imported");
eq(noSize.rejected[0].reason, "no usable package size", "rejection reason recorded");
const noDate = rowsToPriceItems([{ ...datasetRow, capture_date: "" }]);
eq(noDate.capturedAt, null, "missing capture date surfaces");
const eachRow = rowsToPriceItems([{ ...datasetRow, size_g: "", size_text: "1 ea", url: "" }]);
eq(eachRow.items[0].unit_kind, "count", "1 ea maps to count");
eq(eachRow.items[0].package_quantity_milliunits, 1000, "1 each in milliunits");
ok(eachRow.items[0].external_product_key.startsWith("colemans-"), "fallback product key is slugged");

const json = JSON.stringify([datasetRow]);
const fromJson = parsePriceDataset(json, "prices.json");
eq(fromJson.items.length, 1, "JSON dataset parses");

let threw = false;
try { parsePriceDataset("store,product_name\nX,Y\n", "bad.csv"); } catch { threw = true; }
ok(threw, "a dataset with no capture date is refused");

eq(checksumOf("abc"), checksumOf("abc"), "checksum is stable");
ok(checksumOf("abc") !== checksumOf("abd"), "checksum differs by content");

console.log(`${pass} passed, ${failCount} failed`);
if (failCount) process.exit(1);
