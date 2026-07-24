"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { STAFF_ROLES, STAFF_ROLE_LABELS, type StaffRole } from "@azimuth/api/permissions";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AUDIT_LABELS: Record<string, string> = {
  staff_created: "created",
  role_changed: "role changed",
  staff_removed: "removed",
  password_reset: "password reset",
};

export default function StaffPage() {
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();
  const meId = session?.user.id;

  const staffQuery = trpc.staff.list.useQuery();
  const auditQuery = trpc.staff.audit.useQuery({ limit: 50 });

  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<{ id: string; email: string } | null>(null);
  const [removeFor, setRemoveFor] = useState<{ id: string; email: string } | null>(null);

  const refresh = () =>
    Promise.all([utils.staff.list.invalidate(), utils.staff.audit.invalidate()]);

  const changeRole = trpc.staff.changeRole.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Role updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = trpc.staff.remove.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Staff access revoked");
      setRemoveFor(null);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title font-semibold">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create staff accounts and set what each person can access. Only owners see this page.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Add staff</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffQuery.data?.staff.map((s) => {
                const isSelf = s.id === meId;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.name} {isSelf && <span className="text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.email}</TableCell>
                    <TableCell>
                      {isSelf ? (
                        <Badge variant="secondary">{STAFF_ROLE_LABELS[s.staffRole as StaffRole] ?? "—"}</Badge>
                      ) : (
                        <Select
                          value={s.staffRole ?? undefined}
                          onValueChange={(v) => changeRole.mutate({ userId: s.id, staffRole: v as StaffRole })}
                        >
                          <SelectTrigger className="h-8 w-[170px]">
                            <SelectValue placeholder="Set role" />
                          </SelectTrigger>
                          <SelectContent>
                            {STAFF_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {STAFF_ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isSelf && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setResetFor({ id: s.id, email: s.email })}>
                            Reset password
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setRemoveFor({ id: s.id, email: s.email })}>
                            Remove
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {staffQuery.data?.staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No staff yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Append-only audit history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activity log</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {auditQuery.data?.entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                <span className="text-foreground">{e.actorEmail ?? "system"}</span>
                <span>{AUDIT_LABELS[e.action] ?? e.action}</span>
                <span className="text-foreground">{e.targetEmail}</span>
                {e.toRole && (
                  <span>
                    → {STAFF_ROLE_LABELS[e.toRole as StaffRole]}
                  </span>
                )}
                <span className="ml-auto tabular-nums">{new Date(e.createdAt).toLocaleString()}</span>
              </li>
            ))}
            {auditQuery.data?.entries.length === 0 && (
              <li className="text-muted-foreground">No activity yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <CreateStaffDialog open={createOpen} onOpenChange={setCreateOpen} onDone={refresh} />
      <ResetPasswordDialog target={resetFor} onOpenChange={(o) => !o && setResetFor(null)} />
      <Dialog open={!!removeFor} onOpenChange={(o) => !o && setRemoveFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove staff access</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {removeFor?.email} will lose all admin access and revert to a regular customer account. Their orders and
            history are kept.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveFor(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => removeFor && remove.mutate({ userId: removeFor.id })}
            >
              {remove.isPending ? "Removing…" : "Remove access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateStaffDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole | "">("");

  const create = trpc.staff.create.useMutation({
    onSuccess: async () => {
      await onDone();
      toast.success("Staff account created");
      setName("");
      setEmail("");
      setPassword("");
      setStaffRole("");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!staffRole) return toast.error("Pick a role");
    create.mutate({ name, email, password, staffRole });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Temporary password</Label>
            <Input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="At least 8 characters"
              required
            />
            <p className="text-xs text-muted-foreground">Share this with the person; they can change it later.</p>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={staffRole || undefined} onValueChange={(v) => setStaffRole(v as StaffRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a role" />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {STAFF_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  target,
  onOpenChange,
}: {
  target: { id: string; email: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");

  const reset = trpc.staff.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset");
      setPassword("");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (target) reset.mutate({ userId: target.id, password });
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set a new password for {target?.email}. Their active sessions will be signed out.
          </p>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={reset.isPending}>
              {reset.isPending ? "Saving…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
