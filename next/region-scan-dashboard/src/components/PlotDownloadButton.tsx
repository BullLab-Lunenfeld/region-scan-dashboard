import React from "react";
import { Save } from "@mui/icons-material";
import { IconButton, Popover } from "@mui/material";

interface PlotDownloadButtonProps {
  anchorEl: HTMLElement | null;
  buttonRef: React.RefObject<SVGSVGElement | null>;
  download: () => void;
}

//forward ref here?

const PlotDownloadButton: React.FC<PlotDownloadButtonProps> = ({
  anchorEl,
  buttonRef,
  download,
}) => {
  return (
    <Popover
      id="download-popover"
      sx={{ pointerEvents: "none" }}
      aria-hidden={!!anchorEl}
      open={!!anchorEl}
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      disableRestoreFocus
    >
      <IconButton
        onClick={download}
        sx={{ margin: 0, padding: 0, pointerEvents: "all" }}
        size="small"
      >
        <Save ref={buttonRef} color="primary" fontSize="small" />
      </IconButton>
    </Popover>
  );
};

export default PlotDownloadButton;
