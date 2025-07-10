"use client";

import React from "react";
import Link, { LinkProps } from "next/link";
import { Link as MuiLink } from "@mui/material";
import { usePathname } from "next/navigation";

const NavLink: React.FC<
  LinkProps & { children: React.ReactNode; noDecoration?: boolean }
> = ({ children, href, noDecoration }) => {
  const pathname = usePathname();

  const active = pathname === href;

  return (
    <MuiLink
      sx={({ palette }) => ({
        color: palette.primary.contrastText,
        textDecoration: active && !noDecoration ? "underline" : "inherit",
        "&: hover": {
          textDecoration: "underline",
        },
      })}
      component={Link}
      href={href}
    >
      {children}
    </MuiLink>
  );
};

export default NavLink;
