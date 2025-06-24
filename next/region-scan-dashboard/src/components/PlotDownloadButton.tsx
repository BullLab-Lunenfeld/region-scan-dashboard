"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Save } from "@mui/icons-material";
import {
  Button,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  Popper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import Modal from "./Modal";
import { downloadPng, downloadSvg } from "@/lib/ts/export";

interface PlotDownloadButtonProps {
  anchorEl: HTMLElement | null;
  buttonRef: React.RefObject<SVGSVGElement | null>;
  plotType: string;
  selector: string;
}

const PlotDownloadButton: React.FC<PlotDownloadButtonProps> = ({
  anchorEl,
  buttonRef,
  plotType,
  selector,
}) => {
  const [ModalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Popper
        placement="top-start"
        id="download-popover"
        sx={{ pointerEvents: "none" }}
        style={{ inset: "auto auto -10px 10px" }}
        aria-hidden={!!anchorEl}
        modifiers={[
          {
            name: "offset",
            options: {
              offset: [10, -10],
            },
          },
        ]}
        open={!!anchorEl}
        autoFocus={false}
        anchorEl={anchorEl}
      >
        <IconButton
          onClick={() => setModalOpen(true)}
          sx={{ margin: 0, padding: 0, pointerEvents: "all" }}
          size="small"
        >
          <Save ref={buttonRef} color="primary" fontSize="small" />
        </IconButton>
      </Popper>
      {ModalOpen && (
        <DownloadModal
          plotType={plotType}
          selector={selector}
          handleClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
};

interface DownloadModalProps {
  handleClose: () => void;
  plotType: string;
  selector: string;
}

const DownloadModal: React.FC<DownloadModalProps> = ({
  handleClose,
  plotType,
  selector,
}) => {
  const [filename, setFilename] = useState(
    `${plotType.toLowerCase().replaceAll(" ", "-")}.png`,
  );
  const [downloadType, setDownloadType] = useState<"svg" | "png">("png");

  const downloadPlot = useCallback(() => {
    if (downloadType === "png") {
      downloadPng(selector, filename);
    } else {
      downloadSvg(selector, filename);
    }
    handleClose();
  }, [filename, downloadType, selector]);

  useEffect(() => {
    if (downloadType === "png" && filename.endsWith("svg")) {
      setFilename(filename.slice(0, -4) + ".png");
    } else if (downloadType === "svg" && filename.endsWith("png")) {
      setFilename(filename.slice(0, -4) + ".svg");
    }
  }, [downloadType]);

  return (
    <Modal open={true} handleClose={handleClose}>
      <Grid spacing={3} container direction="column">
        <Grid>
          <Typography variant="h5" textAlign="center">
            Download {plotType}
          </Typography>
        </Grid>
        <Grid container direction="row" alignItems="center">
          <Grid>
            <RadioGroup
              onChange={(e) =>
                setDownloadType(e.currentTarget.value as "svg" | "png")
              }
            >
              <FormControlLabel
                checked={downloadType === "png"}
                value="png"
                control={<Radio />}
                label="PNG"
              />
              <FormControlLabel
                checked={downloadType === "svg"}
                value="svg"
                control={<Radio />}
                label="SVG"
              />
            </RadioGroup>
          </Grid>
          <Grid>
            <TextField
              value={filename}
              onChange={(e) => setFilename(e.currentTarget.value)}
              label="Filename"
            />
          </Grid>
          <Grid
            container
            direction="row"
            justifyContent="space-between"
            width="100%"
          >
            <Grid>
              <Button onClick={downloadPlot}>Download</Button>
            </Grid>
            <Grid>
              <Button onClick={handleClose}>Cancel</Button>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Modal>
  );
};

export default PlotDownloadButton;
