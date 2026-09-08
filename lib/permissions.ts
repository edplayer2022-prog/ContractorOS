import{redirect}from"next/navigation";import{getAuthContext}from"@/lib/data";import{hasPermission,type Permission}from"@/lib/permission-policy";export*from"@/lib/permission-policy";
export async function requirePermission(permission:Permission){const context=await getAuthContext();if(!hasPermission(context.membership?.role,permission))redirect("/access-denied");return context}
