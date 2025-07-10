"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Grid2 as Grid,
  IconButton,
  MenuItem,
  Typography,
} from "@mui/material";
import { schemeTableau10 } from "d3-scale-chromatic";
import { scaleOrdinal } from "d3-scale";
import { extent, groups } from "d3-array";
import { DeselectSharp, UndoSharp } from "@mui/icons-material";
import {
  MiamiPlot,
  NumberInput,
  PaginatedTable,
  PvarCheckbox,
  QQPlot,
  RegionPlot,
  ShortTextField,
} from "@/components";
import { parseTsv, transformRegionVariants, unique } from "@/lib/ts/util";
import {
  AssembyInfo,
  isKeyOfRegionResult,
  isRegionResult,
  RegionResult,
  RegionResultRaw,
  SelectedRegionDetailData,
  VariantResult,
} from "@/lib/ts/types";
import { RegionResultCols } from "@/util/columnConfigs";
import { BrushFilter } from "@/components/MiamiPlot";
import { chromLengths37, chromLengths38 } from "@/util/chromLengths";
import { transformRegionUpload } from "@/components/Header";
import { VisualizationDataContext } from "@/components/AppContainer";

const VARIANT_PVAL: keyof VariantResult = "sglm_pvalue";

export default function Visualization() {
  const [assemblyInfo, setAssemblyInfo] = useState<AssembyInfo>({
    assembly: "GRCh38",
    lengths: chromLengths38,
  });

  const [brushFilterHistory, setBrushFilterHistory] = useState<BrushFilter[]>(
    [],
  );

  const [miamiData, setMiamiData] = useState<(RegionResult | VariantResult)[]>(
    [],
  );

  const [lowerThresh, setLowerThresh] = useState<number>(5e-6);
  const [lowerVariable, setLowerVariable] = useState<
    keyof RegionResult | keyof VariantResult | ""
  >("");

  const [qqVariables, setQqVariables] = useState<
    (keyof RegionResult | keyof VariantResult)[]
  >([]);

  const [selectedRegion, setSelectedRegion] = useState<
    RegionResult | VariantResult
  >();
  const [selectedRegionDetailData, setSelectedRegionDetailData] =
    useState<SelectedRegionDetailData>();

  const [upperThresh, setUpperThresh] = useState<number>(5e-6);
  const [upperVariable, setUpperVariable] = useState<
    keyof RegionResult | keyof VariantResult | ""
  >("");

  const { regionData, regionVariantData, setRegionData, setRegionVariantData } =
    useContext(VisualizationDataContext);

  useEffect(() => {
    if (regionData) {
      resetVisualizationVariables();
    }
  }, [regionData]);

  const miamiChartContainerRef = useRef<HTMLDivElement>(null);

  const qqChartContainerRef = useRef<HTMLDivElement>(null);

  const pvalScale = useMemo(() => {
    if (regionData.length) {
      return scaleOrdinal<string, string>()
        .range(schemeTableau10)
        .domain(
          Object.keys(regionData[0])
            .concat(regionVariantData.length ? "sglm_pvalue" : [])
            .filter((k) => k.toLowerCase().endsWith("_p"))
            .map((k) => k)
            .filter((k, i, a) => a.findIndex((d) => d === k) === i) as string[],
        );
    }
  }, [regionData, regionVariantData]);

  // save where the regions restart (~centromeres)
  const regionRestartPoints = useMemo(() => {
    const mapping: Record<number, number> = {};
    if (regionData.length) {
      const grouped = groups(regionData, (d) => d.chr);
      for (let i = 0; i < grouped.length; i++) {
        const chr = grouped[i][0];
        grouped[i][1].sort().forEach((d, j) => {
          if (j > 1 && d.region === 1) {
            mapping[chr] = d.start_bp;
          }
        });
      }
    }

    return mapping;
  }, [regionData]);

  const tableData = useMemo(() => {
    let data: RegionResult[] = [];
    if (selectedRegionDetailData?.data.length) {
      data = selectedRegionDetailData.data;
    } else if (miamiData.length) {
      data = miamiData.filter((d) => isRegionResult(d));
    } else if (regionData.length) {
      data = regionData;
    }
    return data;
  }, [regionData, miamiData, selectedRegionDetailData]);

  useEffect(() => {
    if (regionVariantData.length) {
      //do something
    }
  }, [regionVariantData]);

  // compute regionPlot data, which is a subset of the data currently visible in the MiamiPlot
  useEffect(() => {
    if (selectedRegion && regionRestartPoints) {
      const chr = selectedRegion.chr;
      let minBp = 0;
      let maxBp = Infinity;

      // first trim in case there's a nearby half-chromosome cutoff
      if (regionRestartPoints[chr]) {
        const chrPart = regionRestartPoints[chr];
        if (selectedRegion.end_bp < chrPart) {
          maxBp = regionRestartPoints[chr];
        } else {
          minBp = regionRestartPoints[chr];
        }
      }

      // we have to have <= 5 mb for gene fetch API, so trim there too
      if (selectedRegion.start_bp - minBp > 2500000) {
        minBp = selectedRegion.start_bp - 2500000;
      }

      if (maxBp - selectedRegion.start_bp > 2500000) {
        maxBp = selectedRegion.start_bp + 2500000;
      }

      // finally, if we're already zoomed in to single chr, trim to that range
      if (miamiData.length) {
        if (
          unique<RegionResult | VariantResult, "chr">(miamiData, "chr")
            .length === 1
        ) {
          const [minVisibleBp, maxVisibleBp] = extent(
            miamiData.flatMap((d) => [d.start_bp, d.end_bp]),
          ) as [number, number];
          if (maxVisibleBp < maxBp) {
            maxBp = maxVisibleBp;
          }
          if (minVisibleBp > minBp) {
            minBp = minVisibleBp;
          }
        }
      }

      const regionDetailData = miamiData.filter(
        (d) =>
          isRegionResult(d) &&
          d.end_bp < maxBp &&
          d.start_bp >= minBp &&
          d.chr == chr,
      ) as RegionResult[];

      setSelectedRegionDetailData({
        data: regionDetailData,
        region: selectedRegion,
        regions: unique(regionDetailData, "region"),
        bpRange: extent(
          regionDetailData.flatMap((d) => [d.start_bp, d.end_bp]),
        ) as [number, number],
      });
    }
  }, [miamiData, regionRestartPoints, selectedRegion]);

  useEffect(() => {
    setSelectedRegionDetailData(undefined);
  }, [upperVariable, lowerVariable]);

  //compute region display data, which is the data for the MiamiPlot
  useEffect(() => {
    if (upperVariable && lowerVariable) {
      let newMiamiData = (
        regionData as (RegionResult | VariantResult)[]
      ).concat(regionVariantData);
      if (!!brushFilterHistory.length) {
        const { x0Lim, x1Lim } =
          brushFilterHistory[brushFilterHistory.length - 1];

        newMiamiData = newMiamiData.filter((d) => {
          const x0Pass =
            d.chr > +x0Lim.chr ||
            (d.chr === +x0Lim.chr && d.start_bp >= x0Lim.pos);

          const x1Pass =
            d.chr < +x1Lim.chr ||
            (d.chr === +x1Lim.chr && d.end_bp <= x1Lim.pos);

          return x0Pass && x1Pass;
        });

        //optionally reset region chart data if we've zoomed out of range
        if (selectedRegionDetailData) {
          const { chr } = selectedRegionDetailData.region;
          const { bpRange } = selectedRegionDetailData;
          //if selected chr is no longer in view
          if (+x0Lim.chr > chr || +x1Lim.chr < chr) {
            setSelectedRegionDetailData(undefined);
          } else if (
            +x0Lim.chr == +x1Lim.chr &&
            +x1Lim.chr === chr &&
            (x0Lim.pos > bpRange[0] || x1Lim.pos < bpRange[0])
          ) {
            setSelectedRegionDetailData(undefined);
          }
        }
      }
      setMiamiData(newMiamiData);
    }
  }, [
    brushFilterHistory,
    upperVariable,
    lowerVariable,
    regionData,
    regionVariantData,
  ]);

  useEffect(() => {
    setQqVariables(
      [upperVariable, lowerVariable].filter(Boolean) as (keyof RegionResult)[],
    );
  }, [upperVariable, lowerVariable]);

  const pVars = useMemo(
    () =>
      [
        ...new Set(
          regionData.flatMap((r) =>
            Object.keys(r).filter((k) => k.endsWith("_p")),
          ),
        ),
      ].concat(regionVariantData.length ? "sglm_pvalue" : []) as (
        | keyof RegionResult
        | keyof VariantResult
      )[],
    [regionData, regionVariantData],
  );

  const getSampleData = () =>
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/example`).then((r) =>
      r.json().then(async (r) => {
        const regionData = transformRegionUpload(
          await parseTsv<RegionResultRaw>(r.region),
          1,
        );

        setRegionData(regionData);

        const chrs = unique(regionData, "chr");

        const range =
          chrs.length == 1
            ? null
            : (extent(regionData.flatMap((r) => [r.start_bp, r.end_bp])) as [
                number,
                number,
              ]);

        const variantData = await parseTsv<VariantResult>(r.variant);

        setRegionVariantData(transformRegionVariants(variantData, chrs, range));
      }),
    );

  const filterCb = useCallback(
    (f: BrushFilter) => setBrushFilterHistory(brushFilterHistory.concat(f)),
    [brushFilterHistory],
  );

  const resetVisualizationVariables = () => {
    setRegionVariantData([]);
    setSelectedRegion(undefined);
    setBrushFilterHistory([]);
    setSelectedRegionDetailData(undefined);
    setQqVariables([]);
    setUpperVariable("");
    setLowerVariable("");
  };
  const variablesSelected = !!lowerVariable && !!upperVariable;

  const miamiVarsSet =
    variablesSelected && !!miamiChartContainerRef.current && !!pvalScale;

  const regionVarsSet =
    miamiVarsSet && !!selectedRegion && !!selectedRegionDetailData?.data.length;

  return (
    /* Main column container */
    <Grid container direction="column" spacing={3}>
      {/* First row container */}
      <Grid container direction="row" spacing={2}>
        {/* miami plot controls */}
        <Grid
          size={{
            xs: !!regionData.length ? 2 : 12,
            xl: !!regionData.length ? 1.5 : 12,
          }}
          direction="column"
          alignItems="center"
          container
          spacing={2}
        >
          {!regionData.length && (
            <Grid>
              <Typography textAlign="center">
                Use the controls in the upper left menu to upload your region
                and variant data <br /> or{""}
                <Button size="small" variant="text" onClick={getSampleData}>
                  click here to use example data
                </Button>
              </Typography>
            </Grid>
          )}
          {!!regionData.length && (
            <>
              <Grid>
                <ShortTextField
                  label="Assembly"
                  select
                  value={assemblyInfo.assembly}
                  onChange={(e) =>
                    e.target.value === "GRCh37"
                      ? setAssemblyInfo({
                          assembly: "GRCh37",
                          lengths: chromLengths37,
                        })
                      : setAssemblyInfo({
                          assembly: "GRCh38",
                          lengths: chromLengths38,
                        })
                  }
                >
                  <MenuItem value="GRCh37">GRCh37</MenuItem>
                  <MenuItem value="GRCh38">GRCh38</MenuItem>
                </ShortTextField>
              </Grid>

              <Grid>
                <ShortTextField
                  fullWidth
                  onChange={(e) =>
                    setUpperVariable(e.target.value as keyof RegionResult)
                  }
                  label="Upper Variable"
                  select
                  value={upperVariable}
                >
                  {Object.keys(regionData[0])
                    .filter((k) => k.endsWith("_p"))
                    .concat(!!regionVariantData.length ? VARIANT_PVAL : [])
                    .filter((k) => k !== lowerVariable)
                    .map((k) => (
                      <MenuItem
                        value={k}
                        onChange={() =>
                          setUpperVariable(k as keyof RegionResult)
                        }
                        key={k}
                      >
                        {k}
                      </MenuItem>
                    ))}
                </ShortTextField>
              </Grid>
              <Grid>
                <ShortTextField
                  fullWidth
                  value={lowerVariable}
                  onChange={(e) =>
                    setLowerVariable(e.target.value as keyof RegionResult)
                  }
                  label="Lower Variable"
                  select
                >
                  {Object.keys(regionData[0])
                    .filter((k) => k.endsWith("_p"))
                    .concat(!!regionVariantData.length ? VARIANT_PVAL : [])
                    .filter((k) => k !== upperVariable)
                    .map((k) => (
                      <MenuItem value={k} key={k}>
                        {k}
                      </MenuItem>
                    ))}
                </ShortTextField>
              </Grid>
              <Grid>
                <NumberInput
                  value={upperThresh}
                  onChange={(v: number) => !!v && setUpperThresh(v)}
                  label="Upper Threshold"
                />
              </Grid>
              <Grid>
                <NumberInput
                  value={lowerThresh}
                  onChange={(v: number) => !!v && setLowerThresh(v)}
                  label="Lower Threshold"
                />
              </Grid>
            </>
          )}
          <Grid
            spacing={2}
            container
            alignItems="center"
            justifyContent="center"
          >
            {variablesSelected && (
              <>
                <Grid>
                  <IconButton
                    onClick={() =>
                      setBrushFilterHistory(brushFilterHistory.slice(0, -1))
                    }
                    disabled={brushFilterHistory.length == 0}
                    size="large"
                    title="Revert Zoom"
                    color="primary"
                  >
                    <UndoSharp fontSize="large" />
                  </IconButton>
                </Grid>
                <Grid>
                  <IconButton
                    onClick={() => {
                      setSelectedRegion(undefined);
                      setSelectedRegionDetailData(undefined);
                    }}
                    disabled={!selectedRegion}
                    color="primary"
                    size="large"
                    title="Deselect Region"
                  >
                    <DeselectSharp fontSize="large" />
                  </IconButton>
                </Grid>
              </>
            )}
          </Grid>
        </Grid>
        {/* Miami plot container */}
        <Grid
          container
          ref={miamiChartContainerRef}
          size={{ xs: 5, lg: 6, xl: 6.25 }}
        >
          <Grid>
            {miamiVarsSet && (
              <MiamiPlot
                assemblyInfo={assemblyInfo}
                pvalScale={pvalScale}
                bottomCol={lowerVariable}
                bottomThresh={lowerThresh}
                data={miamiData}
                onCircleClick={(d) => setSelectedRegion(d)}
                filter={brushFilterHistory[brushFilterHistory.length - 1]}
                filterCb={filterCb}
                selectedRegionDetailData={selectedRegionDetailData}
                topCol={upperVariable}
                topThresh={upperThresh}
                width={miamiChartContainerRef.current!.clientWidth}
              />
            )}
          </Grid>
        </Grid>
        {/* QQ Plot */}
        {!!pvalScale && (
          <Grid
            ref={qqChartContainerRef}
            size={{ xs: 5, lg: 4, xl: 4.25 }}
            container
            direction="column"
            spacing={2}
            justifyContent="flex-start"
          >
            {!!regionData.length && !!qqChartContainerRef.current && (
              <>
                <Grid>
                  <QQPlot
                    pvalScale={pvalScale}
                    data={regionData}
                    selector="qq"
                    visibleVariables={qqVariables}
                    variables={pVars}
                    width={qqChartContainerRef.current.clientWidth}
                  />
                </Grid>

                <Grid
                  marginLeft={4}
                  container
                  spacing={0}
                  direction="row"
                  wrap="wrap"
                >
                  {pVars.map((v) => (
                    <Grid key={v}>
                      <PvarCheckbox
                        checked={qqVariables.includes(v)}
                        onChange={(_, checked) =>
                          checked
                            ? setQqVariables(qqVariables.concat(v))
                            : setQqVariables(qqVariables.filter((c) => c !== v))
                        }
                        pvalScale={pvalScale}
                        value={v}
                      />
                    </Grid>
                  ))}
                </Grid>
              </>
            )}
          </Grid>
        )}
      </Grid>
      {regionVarsSet && (
        <RegionPlot
          assemblyInfo={assemblyInfo}
          pvalScale={pvalScale}
          pvars={pVars.filter((p) => isKeyOfRegionResult(p))}
          selector="region-plot"
          selectedRegionDetailData={selectedRegionDetailData}
          regionVars={
            [upperVariable, lowerVariable].filter(
              (k) => !!regionData.length && Object.hasOwn(regionData[0], k),
            ) as (keyof RegionResult)[]
          }
          mainWidth={miamiChartContainerRef.current!.clientWidth}
          variants={regionVariantData}
        />
      )}
      {!!tableData.length && (
        <Grid size={{ xs: 12 }} container flexWrap="nowrap">
          <Grid sx={{ width: "100%" }}>
            <PaginatedTable cols={RegionResultCols} data={tableData} />
          </Grid>
        </Grid>
      )}
    </Grid>
  );
}
