"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, ShoppingBag } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("q") ?? "";

  function setSearch(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set("q", v); else params.delete("q");
    router.replace(`${pathname}?${params.toString()}`);
  }

  const { data, isLoading } = trpc.adminUser.list.useQuery({
    search: search || undefined,
    limit: 100,
  });

  const users = data?.users ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-title font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            All registered customers. Click a row to view orders and activity.
          </p>
        </div>
        {data && (
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{data.total}</span> total
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-8 h-9 text-sm"
          placeholder="Name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow
                key={u.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => router.push(`/users/${u.id}`)}
              >
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <div className="flex items-center gap-1.5">
                    {u.email}
                    {u.emailVerified && (
                      <span className="inline-block size-1.5 rounded-full bg-green-500" title="Verified" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {u.phone ?? "—"}
                </TableCell>
                <TableCell>
                  {u.role === "admin" ? (
                    <Badge variant="default">Admin</Badge>
                  ) : (
                    <Badge variant="outline">User</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="size-3.5 text-muted-foreground" />
                    <span className="text-sm tabular-nums">{u.orderCount}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
