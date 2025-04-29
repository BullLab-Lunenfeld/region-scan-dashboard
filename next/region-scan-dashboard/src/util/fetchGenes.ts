import { AssembyInfo, EnsemblGeneResult } from "@/lib/ts/types";

/**
 * Fetch genes from ensembl, note that maximum size is 5,000,000
 * @param chr
 * @param start
 * @param end
 * @param assembly
 * @returns
 */
export const fetchGenes = async (
  chr: number,
  start: number,
  end: number,
  assembly?: AssembyInfo["assembly"]
) => {
  if (end - start > 5e6) {
    throw "Region cannot be larger than 5MB";
  }
  const region = `${chr}:${start}-${end}`;
  const assemblyPrefix = assembly === "GRCh37" ? "grch37." : "";
  let result: null | EnsemblGeneResult[] = null;
  try {
    const response = await fetch(
      `https://${assemblyPrefix}rest.ensembl.org/overlap/region/human/${region}?feature=gene`,
      { headers: { Accept: "application/json" } }
    );

    result = await (response.json() as Promise<EnsemblGeneResult[]>);
  } catch (e) {
    console.error(e);
  }

  return result;
};
