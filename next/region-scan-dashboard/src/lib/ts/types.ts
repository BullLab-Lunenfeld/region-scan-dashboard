export type FileType = "region" | "bin" | "variant";

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

export interface UCSCRecombTrackResult {
  start: number;
  end: number;
  value: number;
}

//fields common to both
export interface RegionResultRawBase {
  chr: number;
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

// this is a union of the old and new types, the new will be a subset
export type RegionResultRaw = (RegionResultRawOld | RegionResultRawNew) & {
  id?: number;
};

//new fields
export interface RegionResult {
  id: number; //needed for the table
  chr: number;
  end_bp: number;
  GATES_p: number;
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

export interface VariantResultRow {
  bin: number;
  chr: number;
  end_bp: number;
  glm_beta: number;
  glm_pval: number;
  glm_se: number;
  glmbin_beta: number;
  glmbin_pval: number;
  glmbin_se: number;
  LCBbin: number;
  LCBbin_glmByBin: number;
  LCBbin_glmByBin_p: number;
  LCBbin_p: number;
  LCZbin: number;
  LCZbin_glmByBin: number;
  LCZbin_glmByBin_p: number;
  LCZbin_p: number;
  maf: number;
  major_allele: number;
  minor_allele: number;
  MLC_flip: number;
  multiallelicSNP: number;
  pos: number;
  region: number;
  sg_beta: number;
  sg_pval: number;
  sg_se: number;
  start_bp: number;
  variant: string;
  VIF: number;
  vifbin: number;
}

export interface AssembyInfo {
  assembly: "GRCh37" | "GRCh38";
  lengths: Record<string, number>;
}

export interface SelectedRegionDetailData {
  bpRange: [number, number];
  data: RegionResult[];
  region: RegionResult;
  regions: number[];
}
