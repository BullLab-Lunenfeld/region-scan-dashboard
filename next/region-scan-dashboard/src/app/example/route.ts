import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  const path = __dirname.replace(".next/server", "src"); //.next/server is the path created by the build

  //path will be location of this file by default
  const regionPath =
    path.replace(/src(.+)/, "") + `src/data/example/regionout.tsv`;
  const variantPath =
    path.replace(/src(.+)/, "") + `src/data/example/snpout.tsv`;

  const regionFile = await fs.readFile(regionPath);
  const variantFile = await fs.readFile(variantPath);
  const regionTsv = regionFile.toString();
  const variantTsv = variantFile.toString();

  return NextResponse.json({ region: regionTsv, variant: variantTsv });
}
