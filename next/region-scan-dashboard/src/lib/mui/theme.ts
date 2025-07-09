"use client";
import { Roboto } from "next/font/google";
import { createTheme, lighten } from "@mui/material/styles";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export default createTheme({
  typography: {
    fontFamily: roboto.style.fontFamily,
  },
  palette: {
    mode: "light",
    primary: {
      main: lighten("#455F9E", 0.15),
    },
    secondary: {
      main: "#A69F98",
    },
  },
});
