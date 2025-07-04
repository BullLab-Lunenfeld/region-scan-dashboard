import { promises as fs } from "node:fs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

export const generateStaticParams = // Return a list of `params` to populate the [slug] dynamic segment
  async () =>
    [
      ...Array(23)
        .keys()
        .map((v) => `chr${v}`),
    ]
      .slice(1)
      .map((chr) => ({ chr }));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chr: string }> },
) {
  const { chr } = await params;

  const path = __dirname.replace(".next/server", "src"); //.next/server is the path created by the build

  //path will be location of this file by default
  const dataPath = path.replace(/src(.+)/, "") + `src/data/recomb/${chr}.json`;

  const fileBuffer = await fs.readFile(dataPath);
  const json = JSON.parse(fileBuffer.toString());
  return NextResponse.json(json);
}
