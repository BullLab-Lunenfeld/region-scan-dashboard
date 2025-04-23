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

export interface RegionResultRaw {
  chr: number;
  end_bp: number;
  GATES_p: number;
  LCB: number;
  LCB_df: number;
  LCB_p: number;
  maxVIF: number;
  MLCB: number;
  MLCB_df: number;
  MLCB_p: number;
  nSNPs: number;
  nSNPs_kept: number;
  PC80: number;
  PC80_df: number;
  PC80_p: number;
  region: number;
  simes_p: number;
  simpleM_df: number;
  simpleM_p: number;
  single_Wald_p: number;
  SKAT_p: number;
  SKATO_p: number;
  start_bp: number;
  Wald: number;
  Wald_df: number;
  Wald_p: number;
}

export interface RegionResult extends RegionResultRaw {
  //needed for the table
  id: number;
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
