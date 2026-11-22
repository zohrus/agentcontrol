import type { Client } from "@agentcontrol/sdk";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { type Controller, createController } from "./controller.ts";

const ControllerContext = createContext<Controller | undefined>(undefined);

export type DataProviderProps = {
  client: Client;
  /** Called with every failure the user should hear about. */
  onError: (error: unknown) => void;
  children: ReactNode;
};

/** Holds the app's data for every component below it, and keeps it live while mounted. */
export function DataProvider({ client, onError, children }: DataProviderProps) {
  const [controller] = useState(() => createController({ client, report: onError }));
  useEffect(() => controller.connect(), [controller]);
  return <ControllerContext value={controller}>{children}</ControllerContext>;
}

/** The data layer's controller: the store to read from and the actions the user can take. */
export function useController(): Controller {
  const controller = useContext(ControllerContext);
  if (!controller) throw new Error("useController must be used inside a DataProvider.");
  return controller;
}
