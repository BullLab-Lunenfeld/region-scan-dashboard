import Papa from "papaparse";

export const parseTsv = <T extends Record<string, any>>(
  tsv: File
): Promise<T[]> => {
  return new Promise((resolve) =>
    Papa.parse<T>(tsv, {
      header: true,
      skipEmptyLines: true,
      complete: (v) => resolve(v.data),
    })
  );
};
