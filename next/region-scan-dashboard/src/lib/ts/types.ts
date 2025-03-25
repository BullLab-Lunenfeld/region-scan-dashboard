export type FileType = "region" | "bin" | "variant";

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
