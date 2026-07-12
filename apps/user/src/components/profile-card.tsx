"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

type SessionUser = NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"];

export function ProfileCard({ user }: { user: SessionUser }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(user.name);

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.user.me.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Your account</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <p>
            Role: <span className="font-medium">{user.role}</span>
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          className="flex-1"
          disabled={updateProfile.isPending || name === user.name}
          onClick={() => updateProfile.mutate({ name })}
        >
          Save
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => authClient.signOut()}>
          Sign out
        </Button>
      </CardFooter>
    </Card>
  );
}
