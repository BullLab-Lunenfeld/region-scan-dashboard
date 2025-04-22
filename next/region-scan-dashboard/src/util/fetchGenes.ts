import { EnsemblGeneResult } from "@/lib/ts/types";

export const fetchGenes = async (chr: number, start: number, end: number) => {
  if (end - start > 10e6) {
    throw "Region cannot be larger than 10MB";
  }

  const region = `${chr}:${start}-${end}`;
  let result: null | EnsemblGeneResult[] = null;
  try {
    const response = await fetch(
      `https://rest.ensembl.org/overlap/region/human/${region}?feature=gene`,
      { headers: { Accept: "application/json" } }
    );

    result = await (response.json() as Promise<EnsemblGeneResult[]>);
  } catch (e) {
    console.log(e);
  }

  return result;
};
