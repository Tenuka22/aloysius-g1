"use client"

import type { OrganizationAuthClient } from "@better-auth-ui/core/plugins/organization"
import { useAuth, useAuthPlugin } from "@better-auth-ui/react"
import {
  useCancelInvitation,
  useHasPermission
} from "@better-auth-ui/react/plugins/organization"
import type { Invitation } from "better-auth/client"
import { X } from "lucide-react"

import { Badge } from "@aloysius-admissions/ui/components/badge"
import { Button } from "@aloysius-admissions/ui/components/button"
import { Spinner } from "@aloysius-admissions/ui/components/spinner"
import { TableCell, TableRow } from "@aloysius-admissions/ui/components/table"
import { organizationPlugin } from "@/lib/auth/organization-plugin"
import { cn } from "@aloysius-admissions/ui/lib/utils"
import { INVITATION_STATUS } from "@/lib/color-classes"
import { OrganizationInvitationRowSkeleton } from "./organization-invitation-row-skeleton"

export type OrganizationInvitationRowProps = {
  invitation: Invitation
}

const statusBadgeClasses: Record<string, string> = {
  pending: INVITATION_STATUS.pending,
  accepted: INVITATION_STATUS.accepted,
  rejected: "bg-destructive/10 text-destructive",
  canceled: "bg-muted text-muted-foreground"
}

export function OrganizationInvitationRow({
  invitation
}: OrganizationInvitationRowProps) {
  const { authClient } = useAuth<OrganizationAuthClient>()
  const { localization: organizationLocalization, roles } =
    useAuthPlugin(organizationPlugin)

  const {
    data: cancelInvitationPermission,
    isPending: cancelPermissionPending
  } = useHasPermission(authClient, {
    permissions: { invitation: ["cancel"] }
  })

  const { mutate: cancelInvitation, isPending: cancelPending } =
    useCancelInvitation(authClient)

  const roleLabel = roles?.[invitation.role] ?? invitation.role

  const statusLabel =
    organizationLocalization[
      invitation.status as keyof typeof organizationLocalization
    ] ?? invitation.status

  if (cancelPermissionPending) {
    return <OrganizationInvitationRowSkeleton />
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{invitation.email}</TableCell>

      <TableCell className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
        {new Date(invitation.createdAt).toLocaleString(undefined, {
          dateStyle: "short",
          timeStyle: "short"
        })}
      </TableCell>

      <TableCell className="text-sm">{roleLabel}</TableCell>

      <TableCell className="text-sm">
        <Badge
          variant="secondary"
          className={cn(statusBadgeClasses[invitation.status])}
        >
          {String(statusLabel)}
        </Badge>
      </TableCell>

      <TableCell className="text-end">
        {cancelInvitationPermission?.success &&
          invitation.status === "pending" && (
            <Button
              size="icon"
              variant="outline"
              className="size-8 text-destructive"
              disabled={cancelPending}
              onClick={() => cancelInvitation({ invitationId: invitation.id })}
              aria-label={organizationLocalization.cancelInvitation}
            >
              {cancelPending ? <Spinner /> : <X />}
            </Button>
          )}
      </TableCell>
    </TableRow>
  )
}
