import React from "react";

const useDownloadPlot = () => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  return {
    anchorEl,
    handlePopoverOpen,
  };
};

export default useDownloadPlot;
