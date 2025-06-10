import { select } from "d3-selection";
import { saveAs } from "file-saver";

const getSvgSrc = (selector: string) => {
  const svg = ((select(selector).node() as Element).cloneNode(true) as Element)
    .getElementsByTagName("svg")
    .item(0)!;

  const downloadableSvg = select(svg)
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("version", 1.1)
    .node();

  return `data:image/svg+xml;base64,\n${window.btoa(downloadableSvg!.outerHTML)}`;
};

export const downloadPng = (selector: string, filename: string) => {
  const w = (select(selector).select("svg").node() as Element).clientWidth;
  const h = (select(selector).select("svg").node() as Element).clientHeight;

  const src = getSvgSrc(selector);

  const canvas = document.createElement("canvas")!;
  const context = canvas.getContext("2d")!;

  canvas.width = w;
  canvas.height = h;

  const image = new Image();
  document.querySelector("body")?.append(image);
  image.src = src;
  image.onload = function () {
    context.clearRect(0, 0, w, h);
    context.drawImage(image, 0, 0, w, h);

    canvas.toBlob(function (blob) {
      saveAs(blob!, filename);
    });
  };
};

export const downloadSvg = (selector: string, filename: string) => {
  const svgSrc = getSvgSrc(selector);
  saveAs(svgSrc, filename);
};
