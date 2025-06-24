"use client";

import React from "react";
import Link, { LinkProps } from "next/link";
import { Link as MuiLink } from "@mui/material";

const NavLink: React.FC<LinkProps & { children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <MuiLink
    sx={({ palette }) => ({ color: palette.primary.contrastText })}
    component={Link}
    href={href}
  >
    {children}
  </MuiLink>
);

export default NavLink;
