"use client";

import { signOut } from "next-auth/react";
import { Button } from "@calm-point/ui";

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </Button>
  );
}
