"use client";

import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "@/components/providers/auth-provider";

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
