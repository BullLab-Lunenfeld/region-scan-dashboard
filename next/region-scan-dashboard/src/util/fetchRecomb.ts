import { AssembyInfo, UCSCRecombTrackResult } from "@/lib/ts/types";

interface UCSCResult {
  bigDataUrl: string;
  chrom: string;
  chromSize: number;
  downloadTime: string;
  downloadTimeStamp: number;
  end: number;
  genome: string;
  itemsReturned: number;
  recomb1000GAvg: Record<string, UCSCRecombTrackResult[]>;
}

/**
 * Fetch recomb track from UCSC
 * @param chr
 * @param start
 * @param end
 * @param assembly
 * @returns
 */
export const fetchRecomb = async (
  chr: number,
  start: number,
  end: number,
  assembly?: AssembyInfo["assembly"],
) => {
  const assemblyArg = assembly === "GRCh37" ? "hg19" : "hg38";
  let result: null | UCSCResult = null;
  try {
    const response = await fetch(
      `https://api.genome.ucsc.edu/getData/track?genome=${assemblyArg}&track=recomb1000GAvg&chrom=${chr}&start=${start}&end=${end}`,
      { headers: { Accept: "application/json" } },
    );

    result = await (response.json() as Promise<UCSCResult>);

    return result.recomb1000GAvg[`chr${chr}`];
  } catch (e) {
    console.error(e);
    return null;
  }
};
