"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

type SessionUser = NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"];

export function ProfileCard({ user }: { user: SessionUser }) {
  const isAdmin = user.role === "admin";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isAdmin ? "Welcome back" : "Not authorized"}</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {isAdmin ? (
          <p>
            Role: <span className="font-medium">{user.role}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">
            This account does not have admin access. Contact an administrator if this seems wrong.
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={() => authClient.signOut()}>
          Sign out
        </Button>
      </CardFooter>
    </Card>
  );
}
