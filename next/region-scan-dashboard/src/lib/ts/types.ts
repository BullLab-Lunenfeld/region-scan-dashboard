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

interface VariantResultRawBase {
  chr: number;
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
  region: number;
  start_bp: number;
  end_bp: number;
  bin: number;
  variant: string;
  maf: number;
  major_allele: number;
  minor_allele: number;
  bp: number;
  multiallelic: number;
  MLC_codechange: number;
  mglm_vif: number;
  mglm_beta: number;
  mglm_se: number;
  mglm_pvalue: number;
  sglm_beta: number;
  sglm_se: number;
  sglm_pvalue: number;
  ref?: string; //these are in old but not new
  alt?: string;
  LC_codechange?: number;
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
