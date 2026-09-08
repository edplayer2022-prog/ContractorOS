"use client";
import {createContext,useContext} from "react";
import type {Permission} from "@/lib/permission-policy";
const PermissionContext=createContext<readonly Permission[]>([]);
export function PermissionProvider({permissions,children}:{permissions:readonly Permission[];children:React.ReactNode}){return <PermissionContext.Provider value={permissions}>{children}</PermissionContext.Provider>;}
export function usePermission(permission:Permission){return useContext(PermissionContext).includes(permission);}
export function Can({permission,children}:{permission:Permission;children:React.ReactNode}){return usePermission(permission)?children:null;}
