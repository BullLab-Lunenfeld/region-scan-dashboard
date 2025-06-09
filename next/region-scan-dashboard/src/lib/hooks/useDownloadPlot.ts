import React, { useRef } from "react";

const useDownloadPlot = () => {
  const buttonRef = useRef<SVGSVGElement | null>(null);

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = (event: React.MouseEvent<HTMLElement>) => {
    if (event.relatedTarget === buttonRef.current) {
      return;
    } else {
      setAnchorEl(null);
    }
  };

  return {
    anchorEl,
    buttonRef,
    handlePopoverOpen,
    handlePopoverClose,
  };
};

export default useDownloadPlot;
