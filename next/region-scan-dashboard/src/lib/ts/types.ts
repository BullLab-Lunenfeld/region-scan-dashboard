import { BrushFilter } from "@/components/MiamiPlot";

export type FileType = "region" | "bin" | "variant" | "plink variant";

export interface EnsemblGeneResult {
  end: number;
  start: number;
  biotype: string;
  id: string;
  logic_name: string;
  external_name: string;
  assembly_name: string;
  strand: number;
  source: string;
  gene_id: string;
  canonical_transcript: string;
  feature_type: string;
  version: number;
  description: string;
  seq_region_name: string;
}

export interface LocalRecombData {
  chrom: string;
  pos: number;
  recomb_rate: number;
}

//fields common to both
export interface RegionResultRawBase {
  chr: number;
  gene?: string;
  end_bp: number;
  "GATES.p": number;
  LCB: number;
  "LCB.df": number;
  "LCB.p": number;
  LCZ?: number;
  "LCZ.df"?: number;
  "LCZ.p"?: number;
  MLCB: number;
  "MLCB.df": number;
  "MLCB.p": number;
  PC80?: number;
  "PC80.df"?: number;
  "PC80.p"?: number;
  region: number;
  "simpleM.p": number;
  "SKATO.p"?: number;
  start_bp: number;
  Wald: number;
  "Wald.df": number;
  "Wald.p": number;
}

export interface RegionResultRawNew extends RegionResultRawBase {
  maxVIF: number;
  "SKAT.p": number;
  MLCZ?: number; //these three are not always there
  "MLCZ.df"?: number;
  "MLCZ.p"?: number;
  nSNPs: number;
  "nSNPs.kept": number;
  "simpleM.df": number;
  "single_Wald.p": number;
}

export interface RegionResultRawOld extends RegionResultRawBase {
  "max.VIF": number;
  MLCZ: number;
  "MLCZ.df": number;
  "MLCZ.p": number;
  SKAT: number;
  "SKAT.pDavies": number;
  "SKAT.pLiu": number;
  "GATES.df": number;
}

export type RegionResultRaw = (RegionResultRawOld | RegionResultRawNew) & {
  id?: number;
};

//new fields
export interface RegionResult {
  id: number; //needed for the table
  chr: number;
  end_bp: number;
  GATES_p: number;
  gene?: string;
  LCB: number;
  LCB_df: number;
  LCB_p: number;
  LCZ?: number;
  LCZ_df?: number;
  LCZ_p?: number;
  maxVIF: number;
  MLCB: number;
  MLCB_df: number;
  MLCB_p: number;
  MLCZ?: number; //these three are not always there
  MLCZ_df?: number;
  MLCZ_p?: number;
  nSNPs?: number | null; //new
  nSNPs_kept?: number | null; //new
  PC80: number;
  PC80_df: number;
  PC80_p: number;
  region: number;
  simpleM_p: number;
  simpleM_df: number | null; //new
  single_Wald_p: number | null; //new
  SKATO_p?: number;
  start_bp: number;
  Wald: number;
  Wald_df: number;
  Wald_p: number;
  SKAT_p: number;
}

interface VariantResultRawBase {
  chr: number;
  gene?: string;
  region: number;
  "start.bp": number;
  "end.bp": number;
  bin: number;
  variant: string;
  maf: number;
  "major.allele": number;
  "minor.allele": number;
}

export interface VariantResultRawOld extends VariantResultRawBase {
  "glm.beta": number;
  "glm.pval": number;
  "glm.se": number;
  "glmbin.beta": number;
  "glmbin.pval": number;
  "glmbin.se": number;
  LCBbin: number;
  LCBbin_glmByBin: number;
  "LCBbin_glmByBin.p": number;
  "LCBbin.p": number;
  LCZbin: number;
  LCZbin_glmByBin: number;
  "LCZbin_glmByBin.p": number;
  "LCZbin.p": number;
  "MLC.flip": number;
  multiallelicSNP: number;
  pos: number;
  "sg.beta": number;
  "sg.pval": number;
  "sg.se": number;
  VIF: number;
  vifbin: number;
}

export interface VariantResultRawNew extends VariantResultRawBase {
  bp: number;
  multiallelic: number;
  "MLC.codechange": number;
  "mglm.vif": number;
  "mglm.beta": number;
  "mglm.se": number;
  "mglm.pvalue": number;
  "sglm.beta": number;
  "sglm.se": number;
  "sglm.pvalue": number;
  ref: string;
  alt: string;
  "LC.codechange": number;
}

export type VariantResultRaw = VariantResultRawNew | VariantResultRawOld;

export interface VariantResult {
  chr: number;
  gene?: string;
  region: number;
  start_bp: number;
  end_bp: number;
  bin: number;
  variant: string;
  maf: number;
  major_allele?: number;
  minor_allele?: number;
  bp: number;
  maxVIF: number;
  multiallelic: number;
  MLC_codechange: number;
  mglm_vif: number;
  mglm_beta: number;
  mglm_se: number;
  mglm_pvalue: number;
  sglm_beta: number;
  sglm_se: number;
  sglm_pvalue: number;
  ref?: string; //these are in new but not old
  alt?: string;
  LC_codechange?: number;
}

export interface MiamiData {
  data: (RegionResult | VariantResult)[];
  upperVariable: keyof RegionResult | keyof VariantResult;
  lowerVariable: keyof RegionResult | keyof VariantResult;
  setBrushFilterHistory: (f: BrushFilter) => void;
}

export interface AssembyInfo {
  assembly: "GRCh37" | "GRCh38";
  lengths: Record<string, number>;
}

export interface SelectedRegionDetailData {
  bpRange: [number, number];
  data: RegionResult[];
  region: RegionResult | VariantResult;
  regions: number[];
}

//note here that `.` is NA, we'll convert to null at upload
export interface PlinkVariant {
  chrom: number;
  pos: number | null;
  id: string | null;
  ref: string | null;
  alt: string | null;
  a1: string | null;
  test: string | null;
  obst_ct: number | null;
  beta: number | null;
  se: number | null;
  t_stat: number | null;
  p: number | null;
  errcode: number | null;
}

export const isRegionResult = (
  obj: RegionResult | VariantResult,
): obj is RegionResult => !!(obj as RegionResult).id;

const regionKeys: (keyof RegionResult)[] = [
  "id",
  "chr",
  "end_bp",
  "GATES_p",
  "LCB",
  "LCB_df",
  "LCB_p",
  "LCZ",
  "LCZ_df",
  "LCZ_p",
  "maxVIF",
  "MLCB",
  "MLCB_df",
  "MLCB_p",
  "MLCZ",
  "MLCZ_df",
  "MLCZ_p",
  "nSNPs",
  "nSNPs_kept",
  "PC80",
  "PC80_df",
  "PC80_p",
  "region",
  "simpleM_p",
  "simpleM_df",
  "single_Wald_p",
  "SKATO_p",
  "start_bp",
  "Wald",
  "Wald_df",
  "Wald_p",
  "SKAT_p",
];

export const isKeyOfRegionResult = (
  key: keyof RegionResult | keyof VariantResult,
): key is keyof RegionResult => regionKeys.includes(key as keyof RegionResult);
